# PRD — Cooling Tower Energy Audit Dashboard (On-Prem)

## Original Problem Statement
Multi-tower cooling-tower energy audit dashboard, deployed entirely on-prem
at a factory (no cloud dependency). Each cooling tower has its own set of
field devices (flow meter, 4× RTD temp, 2× pressure, 1× filter DP,
conductivity, turbidity, pH, ambient T/RH, 3× power meters) reporting via
Modbus RTU to a PLC, which an IoT gateway bridges to MQTT (JSON payload
tagged with `tower_id`, 15s cadence) on the factory LAN. All towers publish
to one on-prem Mosquitto broker.

Build (1) ingestion service subscribing via wildcard topic and writing raw
readings into TimescaleDB keyed by `tower_id`; (2) analytics worker every
5–15 min looping over every tower computing heat rejection Q=ṁCpΔT, cooling
tower effectiveness, specific power (kW/TR), fouling index, and excess
power vs a per-tower commissioning-time baseline regression; (3) REST API
with `tower_id` as a required/selectable parameter on every endpoint;
(4) React dashboard with multi-tower overview + per-tower drill-down
showing live gauges, power widgets, power-vs-time trend chart with baseline
overlay, fouling risk panel with category + predicted hours-to-cleaning,
and running cumulative ₹ savings-lost counter. Auto ingestion, per-device
last-seen staleness detection, alerts table (dashboard-only for now, SMS/email
wiring reserved). Deploy the whole stack via Docker Compose on a single
on-prem server, accessible over the factory LAN.

## User Personas
- Factory energy auditor / utility engineer — monitors kW/TR and ₹ lost
- Plant maintenance — reacts to fouling and offline-sensor alerts
- Facility manager — control-room overview screen

## Architecture (as delivered)
- **Ingestion**: FastAPI background task — in-process simulator (dev) or
  MQTT wildcard subscriber (prod, `paho-mqtt`) → writes to `readings`
  collection keyed by `tower_id`. Updates `devices.last_seen`.
- **Analytics worker**: asyncio loop every `ANALYTICS_INTERVAL_SEC` (60s
  dev / 300–900s prod). Computes Q, effectiveness, kW/TR, fouling index,
  hours-to-cleaning (linear regression on last 6h fouling index),
  excess power vs per-tower baseline regression, ₹ savings-lost delta.
- **REST API** (`/api/*`): `/towers`, `/towers/{id}`, `/towers/{id}/snapshot`,
  `/towers/{id}/analytics/latest`, `/towers/{id}/history`, `/towers/{id}/devices`,
  `/towers/{id}/fouling`, `/alerts`, `/settings`.
- **Storage**: MongoDB (dev preview) + provided TimescaleDB schema
  (`on-prem/timescale_schema.sql`) with hypertables on `readings` &
  `analytics`.
- **Deploy**: `docker-compose.yml` with Mosquitto, TimescaleDB, Mongo,
  backend, frontend (Nginx-served build), and optional MQTT publisher
  simulator container.
- **Frontend**: React (CRA), dark SCADA theme, IBM Plex Sans + JetBrains
  Mono, Recharts. Routes: `/`, `/tower/:id`, `/alerts`.

## What's implemented (Phase 1 — 2026-02-XX)
- 2-tower demo with realistic simulator generating drifting fouling
- Full ingestion → analytics → API pipeline
- Overview grid, per-tower drill-down (6 sensor tiles, 4 power widgets,
  power-vs-time chart w/ baseline overlay, fouling gauge, device health table)
- Alerts table with acknowledge action; auto-raised on fouling breach,
  excess-vs-baseline, and offline device
- Tariff settings modal editable at runtime
- Docker Compose stack + TimescaleDB schema + sample MQTT publisher

## Backlog
- **P1**: Historical CSV export per tower & metric
- **P1**: Real SMS/email wiring on top of `alerts` table (Twilio/SES)
- **P1**: Auto-migration script `mongo → timescale` (right now dev is Mongo
  and prod schema is Timescale; a small adapter would unify)
- **P2**: Baseline re-fit tool (re-run OLS on last 30d + button to save)
- **P2**: Multi-tower comparison view (side-by-side charts)
- **P2**: Role-based auth for factory LAN
