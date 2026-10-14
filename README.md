# Cooling Tower Energy Audit Dashboard

A real-time energy-audit dashboard for factory cooling towers, built during my internship at SS Filters (July 2026).
It turns raw sensor readings from each tower into heat rejection, effectiveness, specific power (kW/TR), a fouling
index and the rupees lost to excess power, and raises alerts when a tower drifts from its baseline.

The whole stack is designed to run on one on-prem server on the factory LAN, with no cloud dependency.

**Live demo:** https://ss-filters.onrender.com (simulated data for two towers, CT-01 and CT-02).

## What it shows

- **Overview:** every tower as a card with its live KPIs.
- **Tower detail:** six sensor tiles, four power widgets, a power-vs-time chart with the baseline overlaid
  (6 h, 24 h, 72 h and 7-day ranges), the fouling gauge with predicted hours to cleaning, a running ₹ savings-lost
  counter and a device health table with last-seen times.
- **Alerts:** raised automatically on a fouling breach, excess power against the baseline, or an offline device,
  with an acknowledge action.
- **Process:** a 3D walk-through of the chilled-water loop and the audit sensor kit.
- **Tariff:** the ₹/kWh rate (default 9.0) is editable at runtime and every rupee figure updates.

## How it works

```
Field devices ──Modbus RTU──▶ PLC ──▶ IoT gateway ──MQTT──▶ Mosquitto ──▶ FastAPI backend ──▶ React dashboard
 (per tower)                                    factory/towers/<id>/telemetry   ingestion + analytics + REST
```

Each tower has 15 field devices: a flow meter, 4 RTDs, 2 pressure sensors, filter DP, conductivity, turbidity,
pH, ambient temperature and humidity, and 3 power meters (fan, pump, chiller). The gateway publishes one JSON
payload per tower every 15 s.

The backend has three parts:

1. **Ingestion:** subscribes to `factory/towers/+/telemetry` (or, in development, runs a built-in simulator) and
   stores every reading keyed by `tower_id`, updating each device's last-seen time.
2. **Analytics worker:** runs every `ANALYTICS_INTERVAL_SEC` (60 s in development, 5–15 min in production) and,
   for each tower, computes:
   - heat rejection `Q = ṁ · Cp · ΔT`
   - effectiveness `(T_return − T_supply) / (T_return − T_wet-bulb)`
   - specific power: total fan + pump + chiller kW per ton of refrigeration (1 TR = 3.517 kW)
   - a fouling index from filter DP, conductivity, turbidity and pressure drop across the tower, weighted
     0.35 / 0.25 / 0.20 / 0.20 and graded Clean, Watch (≥ 0.35), Fouled (≥ 0.6) or Critical (≥ 0.85)
   - hours to cleaning, extrapolated from the recent fouling trend
   - excess power against the tower's commissioning-time baseline regression, and the ₹ it costs
3. **REST API** under `/api`: `/towers`, `/towers/{id}`, `/towers/{id}/snapshot`, `/towers/{id}/analytics/latest`,
   `/towers/{id}/history`, `/towers/{id}/readings`, `/towers/{id}/devices`, `/towers/{id}/fouling`, `/alerts`,
   `/settings` and `/ingest`.

## Tech stack

| Part | Tech |
|---|---|
| Backend | Python, FastAPI, Motor (MongoDB), paho-mqtt |
| Frontend | React 19, React Router, Tailwind CSS, Recharts, three.js / React Three Fiber |
| Messaging | Mosquitto MQTT broker |
| Storage | MongoDB for the development preview; a TimescaleDB schema with hypertables is provided for production |
| Deployment | Docker Compose |

## Run it

### Whole stack with Docker Compose

```bash
docker compose up -d
```

This starts Mosquitto, TimescaleDB, MongoDB, the backend on port 8001, the frontend on port 80 and an optional
sample MQTT publisher that simulates two towers. Browse to `http://<server-ip>/`.

See [on-prem/README.md](on-prem/README.md) for wiring real PLC gateways, the payload format and every backend
environment variable.

### Development

Backend (needs a MongoDB instance):

```bash
cd backend
pip install -r requirements.txt
MONGO_URL=mongodb://localhost:27017 DB_NAME=ct_audit SIMULATOR_ENABLED=true \
  uvicorn server:app --reload --port 8001
```

Frontend:

```bash
cd frontend
yarn install
REACT_APP_BACKEND_URL=http://localhost:8001 yarn start
```

## Repository layout

```
backend/     FastAPI app (server.py): ingestion, analytics worker, REST API
frontend/    React dashboard
on-prem/     MQTT broker config, TimescaleDB schema, sample publisher, deployment notes
memory/      Product requirements (PRD.md)
```

## Status and next steps

The prototype is complete with simulated data for two towers; it has not yet been connected to real field devices.
Planned next:

- CSV export per tower and metric
- SMS and email delivery for alerts
- A migration path from the MongoDB preview store to TimescaleDB
- A tool to re-fit each tower's baseline from recent data
- A side-by-side comparison view and role-based access on the factory LAN
