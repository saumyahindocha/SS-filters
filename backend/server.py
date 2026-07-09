"""Cooling Tower Energy Audit Dashboard - FastAPI backend.

Runs the ingestion (in-process simulator + optional MQTT subscriber),
persists raw sensor readings + computed analytics to MongoDB (time-series
compatible), and exposes REST endpoints for the React dashboard.
"""
from __future__ import annotations

import asyncio
import logging
import math
import os
import random
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s - %(message)s",
)
log = logging.getLogger("ct-audit")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
DEFAULT_TARIFF = float(os.environ.get("TARIFF_RUPEES_PER_KWH", "9.0"))
NUM_TOWERS = int(os.environ.get("NUM_TOWERS", "2"))
SIM_INTERVAL_SEC = float(os.environ.get("SIM_INTERVAL_SEC", "15"))
SIMULATOR_ENABLED = os.environ.get("SIMULATOR_ENABLED", "true").lower() == "true"
ANALYTICS_INTERVAL_SEC = float(os.environ.get("ANALYTICS_INTERVAL_SEC", "60"))
MQTT_ENABLED = os.environ.get("MQTT_ENABLED", "false").lower() == "true"
MQTT_HOST = os.environ.get("MQTT_HOST", "localhost")
MQTT_PORT = int(os.environ.get("MQTT_PORT", "1883"))
MQTT_TOPIC = os.environ.get("MQTT_TOPIC", "factory/towers/+/telemetry")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# ---------- Constants / Physics ----------
CP_WATER = 4.186  # kJ/kg·K
RHO_WATER = 1000  # kg/m3
KW_PER_TR = 3.517  # 1 TR = 3.517 kW thermal
DESIGN_WET_BULB_C = 28.0

# Device catalog per tower
DEVICE_CATALOG = [
    ("flow_meter", "flow_m3h"),
    ("rtd_supply", "supply_temp_c"),
    ("rtd_return", "return_temp_c"),
    ("rtd_ambient", "ambient_temp_c"),
    ("rtd_wetbulb", "wet_bulb_c"),
    ("pressure_in", "pressure_in_kpa"),
    ("pressure_out", "pressure_out_kpa"),
    ("filter_dp", "filter_dp_kpa"),
    ("conductivity", "conductivity_us"),
    ("turbidity", "turbidity_ntu"),
    ("ph", "ph"),
    ("humidity", "humidity_rh"),
    ("power_fan", "fan_kw"),
    ("power_pump", "pump_kw"),
    ("power_chiller", "chiller_kw"),
]

# ---------- Models ----------
class Tower(BaseModel):
    id: str
    name: str
    location: str
    design_flow_m3h: float
    design_delta_t: float
    baseline_kw_per_tr: float  # commissioning-time baseline
    baseline_slope: float      # excess power ~ slope * TR_load + intercept
    baseline_intercept: float
    commissioned_at: datetime


class Reading(BaseModel):
    tower_id: str
    ts: datetime
    device_id: str
    metric: str
    value: float


class Snapshot(BaseModel):
    tower_id: str
    ts: datetime
    values: Dict[str, float]
    devices: Dict[str, Dict[str, Any]]  # device_id -> {last_seen, stale}


class AnalyticsRow(BaseModel):
    tower_id: str
    ts: datetime
    heat_rejection_kw: float
    effectiveness_pct: float
    kw_per_tr: float
    total_power_kw: float
    tr_load: float
    fouling_index: float
    fouling_category: str
    hours_to_cleaning: Optional[float]
    excess_power_kw: float
    savings_lost_rupees_delta: float


class Alert(BaseModel):
    id: str
    tower_id: str
    kind: str  # sensor_offline | fouling_breach | baseline_excess
    severity: str  # info | warn | critical
    message: str
    created_at: datetime
    acknowledged: bool = False


class Settings(BaseModel):
    tariff_rupees_per_kwh: float
    stale_after_seconds: int
    fouling_thresholds: Dict[str, float]


# ---------- Helpers ----------
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()


async def get_settings() -> Settings:
    doc = await db.settings.find_one({"_id": "global"})
    if not doc:
        s = Settings(
            tariff_rupees_per_kwh=DEFAULT_TARIFF,
            stale_after_seconds=90,
            fouling_thresholds={"watch": 0.35, "fouled": 0.6, "critical": 0.85},
        )
        await db.settings.insert_one({"_id": "global", **s.model_dump()})
        return s
    doc.pop("_id", None)
    return Settings(**doc)


def fouling_category(idx: float, th: Dict[str, float]) -> str:
    if idx >= th["critical"]:
        return "Critical"
    if idx >= th["fouled"]:
        return "Fouled"
    if idx >= th["watch"]:
        return "Watch"
    return "Clean"


# ---------- Tower bootstrap ----------
async def ensure_towers() -> List[Tower]:
    towers: List[Tower] = []
    locations = ["Utility Block A", "Utility Block B", "Cold Utility C", "Chiller Plant D"]
    for i in range(NUM_TOWERS):
        t = Tower(
            id=f"CT-{i+1:02d}",
            name=f"Cooling Tower {i+1}",
            location=locations[i % len(locations)],
            design_flow_m3h=520 + i * 40,
            design_delta_t=5.5,
            baseline_kw_per_tr=0.20 + i * 0.005,
            baseline_slope=0.17 + i * 0.005,
            baseline_intercept=4.0 + i * 0.5,
            commissioned_at=now_utc() - timedelta(days=365 * (2 + i)),
        )
        doc = t.model_dump()
        doc["commissioned_at"] = iso(t.commissioned_at)
        await db.towers.update_one({"id": t.id}, {"$set": doc}, upsert=True)
        # Seed devices catalog
        for dev_type, metric in DEVICE_CATALOG:
            dev_id = f"{t.id}-{dev_type}"
            await db.devices.update_one(
                {"tower_id": t.id, "device_id": dev_id},
                {
                    "$set": {
                        "tower_id": t.id,
                        "device_id": dev_id,
                        "device_type": dev_type,
                        "metric": metric,
                    },
                    "$setOnInsert": {"last_seen": None},
                },
                upsert=True,
            )
        towers.append(t)
    return towers


# ---------- Simulator ----------
class TowerSimState:
    def __init__(self, tower: Tower, tower_index: int):
        self.tower = tower
        self.i = tower_index
        # Each tower degrades over time slightly to demo fouling trend
        self.fouling_drift = 0.05 + 0.15 * tower_index  # start value
        self.step = 0

    def sample(self) -> Dict[str, float]:
        self.step += 1
        # Slow drift of fouling (0..1), oscillate + trend upward
        self.fouling_drift = min(0.98, self.fouling_drift + random.uniform(-0.002, 0.004))
        t = self.step
        # Ambient variation
        ambient = 32 + 3 * math.sin(t / 240) + random.uniform(-0.3, 0.3)
        wet_bulb = ambient - 5.5 + random.uniform(-0.3, 0.3)
        # Load factor 0.6..1.0
        load = 0.7 + 0.25 * math.sin(t / 120 + self.i) + random.uniform(-0.02, 0.02)
        flow = self.tower.design_flow_m3h * (0.85 + 0.15 * load) - self.fouling_drift * 20
        supply = wet_bulb + 4.0 + random.uniform(-0.2, 0.2)  # after cooling
        # As fouling grows, delta_t drops (worse cooling) and pressure drop rises
        delta_t = self.tower.design_delta_t * (1 - 0.35 * self.fouling_drift) + random.uniform(-0.15, 0.15)
        ret = supply + delta_t
        p_in = 320 + random.uniform(-4, 4)
        p_out = p_in - 40 - self.fouling_drift * 25 + random.uniform(-2, 2)
        filter_dp = 6 + 30 * self.fouling_drift + random.uniform(-0.5, 0.5)
        conductivity = 900 + 1400 * self.fouling_drift + random.uniform(-30, 30)
        turbidity = 1.5 + 12 * self.fouling_drift + random.uniform(-0.2, 0.2)
        ph = 7.6 - 0.6 * self.fouling_drift + random.uniform(-0.05, 0.05)
        humidity = 55 + 15 * math.sin(t / 300) + random.uniform(-2, 2)
        # Powers - fans and pumps scale with load; chiller with heat load
        fan_kw = 22 * load * (1 + 0.25 * self.fouling_drift) + random.uniform(-0.5, 0.5)
        pump_kw = 30 * load * (1 + 0.15 * self.fouling_drift) + random.uniform(-0.5, 0.5)
        chiller_kw = 210 * load * (1 + 0.12 * self.fouling_drift) + random.uniform(-2, 2)

        return {
            "flow_m3h": round(flow, 2),
            "supply_temp_c": round(supply, 2),
            "return_temp_c": round(ret, 2),
            "ambient_temp_c": round(ambient, 2),
            "wet_bulb_c": round(wet_bulb, 2),
            "pressure_in_kpa": round(p_in, 2),
            "pressure_out_kpa": round(p_out, 2),
            "filter_dp_kpa": round(filter_dp, 2),
            "conductivity_us": round(conductivity, 1),
            "turbidity_ntu": round(turbidity, 2),
            "ph": round(ph, 2),
            "humidity_rh": round(humidity, 1),
            "fan_kw": round(fan_kw, 2),
            "pump_kw": round(pump_kw, 2),
            "chiller_kw": round(chiller_kw, 2),
        }


# ---------- Ingestion ----------
async def ingest_payload(tower_id: str, payload: Dict[str, float], ts: Optional[datetime] = None,
                         force_offline: Optional[List[str]] = None) -> None:
    """Persist a batch of sensor values as individual readings + update devices.last_seen."""
    ts = ts or now_utc()
    force_offline = force_offline or []
    docs = []
    for dev_type, metric in DEVICE_CATALOG:
        if dev_type in force_offline:
            continue
        if metric not in payload:
            continue
        dev_id = f"{tower_id}-{dev_type}"
        docs.append({
            "tower_id": tower_id,
            "ts": iso(ts),
            "device_id": dev_id,
            "device_type": dev_type,
            "metric": metric,
            "value": float(payload[metric]),
        })
        await db.devices.update_one(
            {"tower_id": tower_id, "device_id": dev_id},
            {"$set": {"last_seen": iso(ts)}},
        )
    if docs:
        await db.readings.insert_many(docs)


# ---------- Analytics ----------
async def get_latest_values(tower_id: str) -> Dict[str, float]:
    """Return latest value per metric for a tower."""
    pipeline = [
        {"$match": {"tower_id": tower_id}},
        {"$sort": {"ts": -1}},
        {"$group": {"_id": "$metric", "value": {"$first": "$value"}, "ts": {"$first": "$ts"}}},
    ]
    out: Dict[str, float] = {}
    async for row in db.readings.aggregate(pipeline):
        out[row["_id"]] = row["value"]
    return out


async def compute_analytics_row(tower: Tower, settings: Settings) -> Optional[AnalyticsRow]:
    vals = await get_latest_values(tower.id)
    required = ["flow_m3h", "supply_temp_c", "return_temp_c", "fan_kw", "pump_kw", "chiller_kw", "wet_bulb_c"]
    if not all(k in vals for k in required):
        return None
    # Heat rejection Q = ṁ * Cp * ΔT ; ṁ (kg/s) = flow(m3/h)/3.6 * rho(kg/m3)/1000
    m_dot_kg_s = vals["flow_m3h"] / 3600.0 * RHO_WATER
    delta_t = max(0.01, vals["return_temp_c"] - vals["supply_temp_c"])
    q_kw = m_dot_kg_s * CP_WATER * delta_t  # kW
    # Effectiveness = (T_in - T_out) / (T_in - T_wetbulb)
    denom = max(0.01, vals["return_temp_c"] - vals["wet_bulb_c"])
    effectiveness = max(0.0, min(1.0, (vals["return_temp_c"] - vals["supply_temp_c"]) / denom))
    total_power = vals["fan_kw"] + vals["pump_kw"] + vals["chiller_kw"]
    tr_load = q_kw / KW_PER_TR if q_kw > 0 else 0.0
    kw_per_tr = total_power / tr_load if tr_load > 0 else 0.0
    # Fouling index: normalised weighted sum of (filter_dp, conductivity, turbidity, dp across tower)
    dp_tower = max(0.0, vals.get("pressure_in_kpa", 0) - vals.get("pressure_out_kpa", 0))
    f_dp = min(1.0, vals.get("filter_dp_kpa", 0) / 45.0)
    f_cond = min(1.0, max(0.0, (vals.get("conductivity_us", 800) - 800) / 1600.0))
    f_turb = min(1.0, vals.get("turbidity_ntu", 0) / 15.0)
    f_dpt = min(1.0, dp_tower / 100.0)
    fouling_index = 0.35 * f_dp + 0.25 * f_cond + 0.2 * f_turb + 0.2 * f_dpt
    cat = fouling_category(fouling_index, settings.fouling_thresholds)
    # Predict hours-to-cleaning: linear extrapolation from last 2h
    hours_to_clean = await predict_hours_to_threshold(tower.id, settings.fouling_thresholds["fouled"])
    # Baseline expected power = slope * TR + intercept
    expected_power = tower.baseline_slope * tr_load + tower.baseline_intercept
    excess_power = max(0.0, total_power - expected_power)
    # Savings lost delta over interval
    interval_hours = ANALYTICS_INTERVAL_SEC / 3600.0
    savings_lost_delta = excess_power * interval_hours * settings.tariff_rupees_per_kwh

    row = AnalyticsRow(
        tower_id=tower.id,
        ts=now_utc(),
        heat_rejection_kw=round(q_kw, 2),
        effectiveness_pct=round(effectiveness * 100, 2),
        kw_per_tr=round(kw_per_tr, 3),
        total_power_kw=round(total_power, 2),
        tr_load=round(tr_load, 2),
        fouling_index=round(fouling_index, 3),
        fouling_category=cat,
        hours_to_cleaning=round(hours_to_clean, 1) if hours_to_clean is not None else None,
        excess_power_kw=round(excess_power, 2),
        savings_lost_rupees_delta=round(savings_lost_delta, 2),
    )
    doc = row.model_dump()
    doc["ts"] = iso(row.ts)
    await db.analytics.insert_one(doc)
    # Update running cumulative savings-lost
    await db.savings_totals.update_one(
        {"tower_id": tower.id},
        {"$inc": {"cumulative_rupees": savings_lost_delta},
         "$set": {"updated_at": iso(row.ts)}},
        upsert=True,
    )
    # Alerts
    await maybe_raise_alerts(tower, row, vals, settings)
    return row


async def predict_hours_to_threshold(tower_id: str, threshold: float) -> Optional[float]:
    cutoff = now_utc() - timedelta(hours=6)
    rows = await db.analytics.find(
        {"tower_id": tower_id, "ts": {"$gte": iso(cutoff)}},
        {"_id": 0, "ts": 1, "fouling_index": 1},
    ).sort("ts", 1).to_list(500)
    if len(rows) < 4:
        return None
    # Linear regression on (t_seconds, fouling_index)
    t0 = datetime.fromisoformat(rows[0]["ts"])
    xs = [(datetime.fromisoformat(r["ts"]) - t0).total_seconds() for r in rows]
    ys = [r["fouling_index"] for r in rows]
    n = len(xs)
    mx = sum(xs) / n
    my = sum(ys) / n
    num = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    den = sum((x - mx) ** 2 for x in xs) or 1e-9
    slope = num / den  # per second
    intercept = my - slope * mx
    if slope <= 1e-9:
        return None
    # Solve intercept + slope * t = threshold => t seconds since t0
    t_at_threshold = (threshold - intercept) / slope
    now_sec = (now_utc() - t0).total_seconds()
    remaining_sec = t_at_threshold - now_sec
    if remaining_sec <= 0:
        return 0.0
    return remaining_sec / 3600.0


async def maybe_raise_alerts(tower: Tower, row: AnalyticsRow, vals: Dict[str, float], settings: Settings) -> None:
    th = settings.fouling_thresholds
    if row.fouling_index >= th["critical"]:
        await raise_alert(tower.id, "fouling_breach", "critical",
                          f"Fouling index {row.fouling_index} > critical ({th['critical']})")
    elif row.fouling_index >= th["fouled"]:
        await raise_alert(tower.id, "fouling_breach", "warn",
                          f"Fouling index {row.fouling_index} > fouled ({th['fouled']})")
    if row.excess_power_kw > 25:
        await raise_alert(tower.id, "baseline_excess", "warn",
                          f"Excess power {row.excess_power_kw} kW vs baseline")


async def raise_alert(tower_id: str, kind: str, severity: str, message: str) -> None:
    # Deduplicate: don't raise same tower+kind+message in last 5 min
    recent = await db.alerts.find_one(
        {"tower_id": tower_id, "kind": kind, "message": message,
         "created_at": {"$gte": iso(now_utc() - timedelta(minutes=5))}}
    )
    if recent:
        return
    alert = Alert(
        id=str(uuid.uuid4()),
        tower_id=tower_id,
        kind=kind,
        severity=severity,
        message=message,
        created_at=now_utc(),
        acknowledged=False,
    )
    doc = alert.model_dump()
    doc["created_at"] = iso(alert.created_at)
    await db.alerts.insert_one(doc)


async def check_staleness() -> None:
    settings = await get_settings()
    cutoff = now_utc() - timedelta(seconds=settings.stale_after_seconds)
    async for d in db.devices.find({}):
        last_seen = d.get("last_seen")
        if not last_seen:
            continue
        ls_dt = datetime.fromisoformat(last_seen)
        if ls_dt < cutoff:
            await raise_alert(d["tower_id"], "sensor_offline", "warn",
                              f"Device {d['device_id']} offline (last seen {last_seen})")


# ---------- Background loops ----------
_bg_tasks: List[asyncio.Task] = []
_sim_states: Dict[str, TowerSimState] = {}


async def simulator_loop():
    towers = await ensure_towers()
    for idx, t in enumerate(towers):
        _sim_states[t.id] = TowerSimState(t, idx)
    log.info("Simulator started for %d towers @ %.1fs", len(towers), SIM_INTERVAL_SEC)
    while True:
        try:
            for tid, state in _sim_states.items():
                payload = state.sample()
                # Randomly drop a sensor 1% of the time to trigger staleness alerts
                offline = []
                if random.random() < 0.005:
                    offline = [random.choice([d for d, _ in DEVICE_CATALOG])]
                await ingest_payload(tid, payload, force_offline=offline)
        except Exception:
            log.exception("simulator tick error")
        await asyncio.sleep(SIM_INTERVAL_SEC)


async def analytics_loop():
    log.info("Analytics worker started @ %.1fs", ANALYTICS_INTERVAL_SEC)
    while True:
        try:
            settings = await get_settings()
            towers = await ensure_towers()
            for t in towers:
                await compute_analytics_row(t, settings)
            await check_staleness()
        except Exception:
            log.exception("analytics tick error")
        await asyncio.sleep(ANALYTICS_INTERVAL_SEC)


async def mqtt_loop():
    """Optional: subscribe to MQTT wildcard topic. Enabled via MQTT_ENABLED env var."""
    if not MQTT_ENABLED:
        return
    try:
        from asyncio_mqtt import Client
    except Exception:
        log.warning("asyncio-mqtt not available, skipping MQTT")
        return
    log.info("Connecting MQTT %s:%s topic=%s", MQTT_HOST, MQTT_PORT, MQTT_TOPIC)
    while True:
        try:
            async with Client(MQTT_HOST, port=MQTT_PORT) as c:
                await c.subscribe(MQTT_TOPIC)
                async with c.messages() as messages:
                    async for msg in messages:
                        try:
                            import json as _json
                            payload = _json.loads(msg.payload.decode())
                            tid = payload.get("tower_id") or msg.topic.value.split("/")[-2]
                            await ingest_payload(tid, payload)
                        except Exception:
                            log.exception("bad mqtt payload")
        except Exception:
            log.exception("MQTT connection failed, retrying in 10s")
            await asyncio.sleep(10)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await ensure_towers()
    # Kick a warm-up ingest so the API returns data immediately
    settings = await get_settings()
    towers = await ensure_towers()
    for idx, t in enumerate(towers):
        _sim_states[t.id] = TowerSimState(t, idx)
        if not SIMULATOR_ENABLED:
            continue
        # Seed a few historical points for the trend chart
        base = now_utc() - timedelta(hours=6)
        for i in range(24):
            payload = _sim_states[t.id].sample()
            await ingest_payload(t.id, payload, ts=base + timedelta(minutes=15 * i))
            await compute_analytics_row(t, settings)
    _bg_tasks.append(asyncio.create_task(simulator_loop()))
    _bg_tasks.append(asyncio.create_task(analytics_loop()))
    _bg_tasks.append(asyncio.create_task(mqtt_loop()))
    log.info("Background workers started")
    try:
        yield
    finally:
        for t in _bg_tasks:
            t.cancel()
        client.close()


app = FastAPI(title="Cooling Tower Energy Audit", lifespan=lifespan)
api = APIRouter(prefix="/api")


# ---------- API Endpoints ----------
@api.get("/")
async def root():
    return {"service": "cooling-tower-audit", "num_towers": NUM_TOWERS}


@api.get("/towers", response_model=List[Dict[str, Any]])
async def list_towers():
    towers = await ensure_towers()
    settings = await get_settings()
    out = []
    for t in towers:
        latest_a = await db.analytics.find_one({"tower_id": t.id}, {"_id": 0}, sort=[("ts", -1)])
        latest_vals = await get_latest_values(t.id)
        savings = await db.savings_totals.find_one({"tower_id": t.id}, {"_id": 0}) or {"cumulative_rupees": 0}
        # Online devices count
        cutoff = now_utc() - timedelta(seconds=settings.stale_after_seconds)
        total_devs = await db.devices.count_documents({"tower_id": t.id})
        online_devs = await db.devices.count_documents(
            {"tower_id": t.id, "last_seen": {"$gte": iso(cutoff)}}
        )
        active_alerts = await db.alerts.count_documents({"tower_id": t.id, "acknowledged": False})
        out.append({
            "id": t.id,
            "name": t.name,
            "location": t.location,
            "design_flow_m3h": t.design_flow_m3h,
            "baseline_kw_per_tr": t.baseline_kw_per_tr,
            "latest_analytics": latest_a,
            "latest_values": latest_vals,
            "cumulative_savings_lost": round(savings.get("cumulative_rupees", 0), 2),
            "devices": {"total": total_devs, "online": online_devs},
            "active_alerts": active_alerts,
            "status": _status_from(latest_a, online_devs, total_devs),
        })
    return out


def _status_from(analytics: Optional[Dict[str, Any]], online: int, total: int) -> str:
    if online < total:
        return "degraded"
    if not analytics:
        return "unknown"
    if analytics.get("fouling_category") in ("Critical",):
        return "critical"
    if analytics.get("fouling_category") in ("Fouled",):
        return "warn"
    return "ok"


@api.get("/towers/{tower_id}")
async def get_tower(tower_id: str):
    t = await db.towers.find_one({"id": tower_id}, {"_id": 0})
    if not t:
        raise HTTPException(404, "tower not found")
    return t


@api.get("/towers/{tower_id}/snapshot")
async def snapshot(tower_id: str):
    if not await db.towers.find_one({"id": tower_id}):
        raise HTTPException(404, "tower not found")
    vals = await get_latest_values(tower_id)
    settings = await get_settings()
    cutoff = now_utc() - timedelta(seconds=settings.stale_after_seconds)
    devices = []
    async for d in db.devices.find({"tower_id": tower_id}, {"_id": 0}):
        ls = d.get("last_seen")
        stale = (not ls) or (datetime.fromisoformat(ls) < cutoff)
        devices.append({**d, "stale": stale})
    return {"tower_id": tower_id, "ts": iso(now_utc()), "values": vals, "devices": devices}


@api.get("/towers/{tower_id}/analytics/latest")
async def latest_analytics(tower_id: str):
    row = await db.analytics.find_one({"tower_id": tower_id}, {"_id": 0}, sort=[("ts", -1)])
    if not row:
        raise HTTPException(404, "no analytics yet")
    savings = await db.savings_totals.find_one({"tower_id": tower_id}, {"_id": 0}) or {"cumulative_rupees": 0}
    row["cumulative_savings_lost"] = round(savings.get("cumulative_rupees", 0), 2)
    return row


@api.get("/towers/{tower_id}/history")
async def history(
    tower_id: str,
    metric: str = Query(..., description="One of: total_power_kw, kw_per_tr, effectiveness_pct, heat_rejection_kw, fouling_index"),
    hours: int = Query(24, ge=1, le=168),
):
    cutoff = now_utc() - timedelta(hours=hours)
    rows = await db.analytics.find(
        {"tower_id": tower_id, "ts": {"$gte": iso(cutoff)}},
        {"_id": 0, "ts": 1, metric: 1, "tr_load": 1},
    ).sort("ts", 1).to_list(2000)
    tower = await db.towers.find_one({"id": tower_id}, {"_id": 0})
    baseline = None
    if tower and metric == "total_power_kw":
        baseline = {
            "slope": tower["baseline_slope"],
            "intercept": tower["baseline_intercept"],
        }
    return {"tower_id": tower_id, "metric": metric, "points": rows, "baseline": baseline}


@api.get("/towers/{tower_id}/readings")
async def raw_readings(
    tower_id: str,
    metric: str = Query(...),
    hours: int = Query(6, ge=1, le=72),
):
    cutoff = now_utc() - timedelta(hours=hours)
    rows = await db.readings.find(
        {"tower_id": tower_id, "metric": metric, "ts": {"$gte": iso(cutoff)}},
        {"_id": 0, "ts": 1, "value": 1},
    ).sort("ts", 1).to_list(5000)
    return {"tower_id": tower_id, "metric": metric, "points": rows}


@api.get("/towers/{tower_id}/devices")
async def tower_devices(tower_id: str):
    settings = await get_settings()
    cutoff = now_utc() - timedelta(seconds=settings.stale_after_seconds)
    out = []
    async for d in db.devices.find({"tower_id": tower_id}, {"_id": 0}):
        ls = d.get("last_seen")
        stale = (not ls) or (datetime.fromisoformat(ls) < cutoff)
        out.append({**d, "stale": stale})
    return out


@api.get("/towers/{tower_id}/fouling")
async def fouling_panel(tower_id: str):
    settings = await get_settings()
    row = await db.analytics.find_one({"tower_id": tower_id}, {"_id": 0}, sort=[("ts", -1)])
    if not row:
        raise HTTPException(404, "no analytics yet")
    return {
        "tower_id": tower_id,
        "fouling_index": row["fouling_index"],
        "category": row["fouling_category"],
        "hours_to_cleaning": row["hours_to_cleaning"],
        "thresholds": settings.fouling_thresholds,
    }


@api.get("/alerts")
async def list_alerts(tower_id: Optional[str] = None, acknowledged: Optional[bool] = None, limit: int = 200):
    q: Dict[str, Any] = {}
    if tower_id:
        q["tower_id"] = tower_id
    if acknowledged is not None:
        q["acknowledged"] = acknowledged
    rows = await db.alerts.find(q, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return rows


@api.patch("/alerts/{alert_id}")
async def ack_alert(alert_id: str):
    res = await db.alerts.update_one({"id": alert_id}, {"$set": {"acknowledged": True}})
    if res.matched_count == 0:
        raise HTTPException(404, "alert not found")
    return {"ok": True}


@api.get("/settings", response_model=Settings)
async def read_settings():
    return await get_settings()


class SettingsPatch(BaseModel):
    tariff_rupees_per_kwh: Optional[float] = None
    stale_after_seconds: Optional[int] = None
    fouling_thresholds: Optional[Dict[str, float]] = None


@api.patch("/settings", response_model=Settings)
async def update_settings(patch: SettingsPatch):
    cur = await get_settings()
    data = cur.model_dump()
    for k, v in patch.model_dump(exclude_none=True).items():
        data[k] = v
    await db.settings.update_one({"_id": "global"}, {"$set": data}, upsert=True)
    return Settings(**data)


class IngestPayload(BaseModel):
    tower_id: str
    values: Dict[str, float]
    ts: Optional[datetime] = None


@api.post("/ingest")
async def http_ingest(payload: IngestPayload):
    """HTTP alternative to MQTT for gateways that speak REST/webhook.

    Body: {"tower_id": "CT-01", "values": {"flow_m3h": 512.3, ...}, "ts": "..."}
    """
    if not await db.towers.find_one({"id": payload.tower_id}):
        raise HTTPException(404, "tower not found")
    await ingest_payload(payload.tower_id, payload.values, ts=payload.ts)
    return {"ok": True, "tower_id": payload.tower_id, "count": len(payload.values)}


app.include_router(api)

# ============ Emergent-managed Google Auth ============
# REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
import httpx
from fastapi import Request, Response, Cookie

class OnboardingIn(BaseModel):
    company_name: str
    phone: Optional[str] = None
    designation: Optional[str] = None
    plant_location: Optional[str] = None

async def _current_user(request: Request):
    token = request.cookies.get("session_token")
    if not token:
        h = request.headers.get("authorization", "")
        if h.startswith("Bearer "):
            token = h[7:]
    if not token:
        raise HTTPException(401, "not authenticated")
    sess = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not sess:
        raise HTTPException(401, "invalid session")
    exp = sess["expires_at"]
    if isinstance(exp, str):
        exp = datetime.fromisoformat(exp)
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < now_utc():
        raise HTTPException(401, "session expired")
    user = await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(401, "user not found")
    return user

@api.post("/auth/session")
async def auth_session(request: Request, response: Response):
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(400, "session_id required")
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id},
        )
    if r.status_code != 200:
        raise HTTPException(401, "invalid session_id")
    data = r.json()
    email = data["email"]
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one({"user_id": user_id},
            {"$set": {"name": data.get("name"), "picture": data.get("picture")}})
        onboarded = bool(existing.get("company_name"))
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id, "email": email,
            "name": data.get("name"), "picture": data.get("picture"),
            "created_at": iso(now_utc()),
        })
        onboarded = False
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": data["session_token"],
        "expires_at": iso(now_utc() + timedelta(days=7)),
        "created_at": iso(now_utc()),
    })
    response.set_cookie(
        "session_token", data["session_token"],
        httponly=True, secure=True, samesite="none", path="/",
        max_age=7 * 24 * 3600,
    )
    return {"user_id": user_id, "email": email, "name": data.get("name"),
            "picture": data.get("picture"), "onboarded": onboarded}

@api.get("/auth/me")
async def auth_me(request: Request):
    return await _current_user(request)

@api.post("/auth/onboarding")
async def auth_onboarding(request: Request, body: OnboardingIn):
    user = await _current_user(request)
    await db.users.update_one({"user_id": user["user_id"]},
        {"$set": body.model_dump(exclude_none=True)})
    return await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})

@api.post("/auth/logout")
async def auth_logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_many({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}

app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)
