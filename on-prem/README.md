# On-Prem Deployment — Cooling Tower Energy Audit

Everything runs on a single factory server on the LAN. No cloud calls.

## Stack

| Service       | Purpose                                                            |
| ------------- | ------------------------------------------------------------------ |
| `mosquitto`   | On-prem MQTT broker; all PLC gateways publish here                 |
| `timescaledb` | Time-series DB per §3 schema (schema in `on-prem/timescale_schema.sql`) |
| `mongo`       | Dev-preview data store (swap out for pure Timescale in prod if desired) |
| `backend`     | FastAPI — MQTT subscriber ingestion + analytics worker + REST API  |
| `frontend`    | Built React dashboard served via Nginx                             |
| `simulator`   | Optional test publisher (remove once real PLCs are wired)          |

## Bring it up

```bash
cd /app
docker compose up -d
```

Then browse to `http://<factory-server-ip>/` on the factory LAN.

## Wiring real PLCs

Configure each IoT gateway to publish JSON to:

```
factory/towers/<tower_id>/telemetry
```

Sample payload (see `on-prem/mqtt_publisher_sample.py`):

```json
{
  "tower_id": "CT-01",
  "flow_m3h": 512.3,
  "supply_temp_c": 30.4,
  "return_temp_c": 35.9,
  "wet_bulb_c": 27.1,
  "ambient_temp_c": 33.0,
  "pressure_in_kpa": 320,
  "pressure_out_kpa": 278,
  "filter_dp_kpa": 12.4,
  "conductivity_us": 1420,
  "turbidity_ntu": 3.8,
  "ph": 7.4,
  "humidity_rh": 62,
  "fan_kw": 18.4,
  "pump_kw": 26.1,
  "chiller_kw": 185.2
}
```

Publish cadence: 15 s (matches the ingestion service).

## Environment variables (backend)

| Var                          | Default                          | Purpose                                    |
| ---------------------------- | -------------------------------- | ------------------------------------------ |
| `MQTT_ENABLED`               | `false`                          | Turn on real MQTT ingestion               |
| `MQTT_HOST` / `MQTT_PORT`    | `mosquitto` / `1883`             | Broker location                            |
| `MQTT_TOPIC`                 | `factory/towers/+/telemetry`     | Wildcard topic                             |
| `TARIFF_RUPEES_PER_KWH`      | `9.0`                            | Electricity tariff (also editable in UI)   |
| `NUM_TOWERS`                 | `2`                              | Seed count for towers table                |
| `SIM_INTERVAL_SEC`           | `15`                             | In-process simulator cadence (turn off in prod) |
| `ANALYTICS_INTERVAL_SEC`     | `60`                             | Analytics worker cadence                   |

## TimescaleDB schema

See `on-prem/timescale_schema.sql` — creates `readings` and `analytics` as
hypertables partitioned by `ts`, keyed by `tower_id`, plus `towers`, `devices`,
`alerts`, `settings`, `savings_totals`.
