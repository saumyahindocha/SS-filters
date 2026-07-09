import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Fan, Droplets, Snowflake, Zap } from "lucide-react";
import { api } from "@/lib/api";
import SensorTile from "@/components/SensorTile";
import PowerTrendChart from "@/components/PowerTrendChart";
import FoulingPanel from "@/components/FoulingPanel";
import { IDS } from "@/constants/testIds";

const REFRESH_MS = 5000;

export default function TowerDetail() {
  const { towerId } = useParams();
  const [snapshot, setSnapshot] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [fouling, setFouling] = useState(null);
  const [history, setHistory] = useState(null);
  const [range, setRange] = useState(24);
  const [devices, setDevices] = useState([]);

  const staleOf = (metric) => {
    const dt = devices.find((d) => d.metric === metric);
    return dt ? dt.stale : false;
  };

  const load = async () => {
    try {
      const [s, a, f, d] = await Promise.all([
        api.snapshot(towerId),
        api.latestAnalytics(towerId).catch(() => null),
        api.fouling(towerId).catch(() => null),
        api.devices(towerId),
      ]);
      setSnapshot(s);
      setAnalytics(a);
      setFouling(f);
      setDevices(d);
    } catch (e) {
      void e;
    }
  };

  const loadHistory = async () => {
    try {
      const h = await api.history(towerId, "total_power_kw", range);
      setHistory(h);
    } catch (e) {
      void e;
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [towerId]);

  useEffect(() => {
    loadHistory();
    const t = setInterval(loadHistory, 15000);
    return () => clearInterval(t);
  }, [towerId, range]);

  const v = snapshot?.values || {};
  const a = analytics || {};

  return (
    <div data-testid={IDS.detailRoot(towerId)} className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-[#a1a6b4] hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="text-xs uppercase tracking-[0.14em] text-[#6b7280] mono">
              {towerId}
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Cooling Tower Drill-Down</h1>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="scada-sub p-3">
            <div className="scada-label">Effectiveness</div>
            <div className="mono text-xl text-white tabular-nums">
              {a.effectiveness_pct?.toFixed(1) ?? "—"}<span className="text-xs text-[#6b7280] ml-1">%</span>
            </div>
          </div>
          <div className="scada-sub p-3">
            <div className="scada-label">kW / TR</div>
            <div className="mono text-xl text-white tabular-nums">
              {a.kw_per_tr?.toFixed(3) ?? "—"}
            </div>
          </div>
          <div className="scada-sub p-3">
            <div className="scada-label">Cumulative ₹ Lost</div>
            <div className="mono text-xl text-[#30d158] font-bold tabular-nums"
                 data-testid={IDS.savings(towerId)}>
              ₹{(a.cumulative_savings_lost || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <SensorTile label="Flow" unit="m³/h" value={v.flow_m3h?.toFixed(1)}
          testid={IDS.sensor(towerId, "flow")} stale={staleOf("flow_m3h")} />
        <SensorTile label="Supply Temp" unit="°C" value={v.supply_temp_c?.toFixed(2)}
          testid={IDS.sensor(towerId, "supply")} stale={staleOf("supply_temp_c")} />
        <SensorTile label="Return Temp" unit="°C" value={v.return_temp_c?.toFixed(2)}
          testid={IDS.sensor(towerId, "return")} stale={staleOf("return_temp_c")} />
        <SensorTile label="Conductivity" unit="µS/cm" value={v.conductivity_us?.toFixed(0)}
          testid={IDS.sensor(towerId, "conductivity")}
          warn={v.conductivity_us > 1800} stale={staleOf("conductivity_us")} />
        <SensorTile label="Turbidity" unit="NTU" value={v.turbidity_ntu?.toFixed(2)}
          testid={IDS.sensor(towerId, "turbidity")}
          warn={v.turbidity_ntu > 8} stale={staleOf("turbidity_ntu")} />
        <SensorTile label="Filter ΔP" unit="kPa" value={v.filter_dp_kpa?.toFixed(1)}
          testid={IDS.sensor(towerId, "filter_dp")}
          warn={v.filter_dp_kpa > 25} stale={staleOf("filter_dp_kpa")} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="scada-card p-4 flex items-center gap-3">
          <Fan className="w-6 h-6 text-[#0a84ff]" />
          <div>
            <div className="scada-label">Fan Power</div>
            <div className="mono text-2xl text-white tabular-nums"
                 data-testid={IDS.power(towerId, "fan")}>
              {v.fan_kw?.toFixed(1) ?? "—"}<span className="text-xs text-[#6b7280] ml-1">kW</span>
            </div>
          </div>
        </div>
        <div className="scada-card p-4 flex items-center gap-3">
          <Droplets className="w-6 h-6 text-[#0a84ff]" />
          <div>
            <div className="scada-label">Pump Power</div>
            <div className="mono text-2xl text-white tabular-nums"
                 data-testid={IDS.power(towerId, "pump")}>
              {v.pump_kw?.toFixed(1) ?? "—"}<span className="text-xs text-[#6b7280] ml-1">kW</span>
            </div>
          </div>
        </div>
        <div className="scada-card p-4 flex items-center gap-3">
          <Snowflake className="w-6 h-6 text-[#0a84ff]" />
          <div>
            <div className="scada-label">Chiller Power</div>
            <div className="mono text-2xl text-white tabular-nums"
                 data-testid={IDS.power(towerId, "chiller")}>
              {v.chiller_kw?.toFixed(1) ?? "—"}<span className="text-xs text-[#6b7280] ml-1">kW</span>
            </div>
          </div>
        </div>
        <div className="scada-card p-4 flex items-center gap-3 border-[#0a84ff]/40">
          <Zap className="w-6 h-6 text-[#30d158]" />
          <div>
            <div className="scada-label">Total Power</div>
            <div className="mono text-2xl text-white tabular-nums"
                 data-testid={IDS.power(towerId, "total")}>
              {a.total_power_kw?.toFixed(1) ?? "—"}<span className="text-xs text-[#6b7280] ml-1">kW</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <PowerTrendChart
            towerId={towerId}
            data={history}
            baseline={history?.baseline}
            range={range}
            onRangeChange={setRange}
          />
        </div>
        <FoulingPanel towerId={towerId} fouling={fouling} />
      </div>

      <div className="scada-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="scada-label">Device Health · Last Seen</div>
            <div className="text-sm text-[#a1a6b4]">Modbus RTU → PLC → MQTT gateway</div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="scada-table w-full">
            <thead>
              <tr>
                <th>Device ID</th>
                <th>Type</th>
                <th>Metric</th>
                <th>Last Seen</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => (
                <tr key={d.device_id}>
                  <td className="text-white">{d.device_id}</td>
                  <td className="text-[#a1a6b4]">{d.device_type}</td>
                  <td className="text-[#a1a6b4]">{d.metric}</td>
                  <td className="text-[#a1a6b4]">
                    {d.last_seen ? new Date(d.last_seen).toLocaleTimeString() : "—"}
                  </td>
                  <td>
                    <span className={`dot ${d.stale ? "dot-offline" : "dot-ok"}`} />
                    <span className="ml-2 text-xs uppercase tracking-wider">
                      {d.stale ? "offline" : "online"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
