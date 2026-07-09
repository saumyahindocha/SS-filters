-- TimescaleDB schema for the Cooling Tower Energy Audit (§3).
-- Applied automatically by docker-entrypoint-initdb.d on first boot.

CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS towers (
  id                   TEXT PRIMARY KEY,
  name                 TEXT NOT NULL,
  location             TEXT NOT NULL,
  design_flow_m3h      DOUBLE PRECISION NOT NULL,
  design_delta_t       DOUBLE PRECISION NOT NULL,
  baseline_kw_per_tr   DOUBLE PRECISION NOT NULL,
  baseline_slope       DOUBLE PRECISION NOT NULL,
  baseline_intercept   DOUBLE PRECISION NOT NULL,
  commissioned_at      TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS devices (
  tower_id     TEXT REFERENCES towers(id) ON DELETE CASCADE,
  device_id    TEXT PRIMARY KEY,
  device_type  TEXT NOT NULL,
  metric       TEXT NOT NULL,
  last_seen    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS readings (
  ts          TIMESTAMPTZ NOT NULL,
  tower_id    TEXT NOT NULL,
  device_id   TEXT NOT NULL,
  device_type TEXT NOT NULL,
  metric      TEXT NOT NULL,
  value       DOUBLE PRECISION NOT NULL
);
SELECT create_hypertable('readings', 'ts', if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS ix_readings_tower_metric_ts
  ON readings (tower_id, metric, ts DESC);

CREATE TABLE IF NOT EXISTS analytics (
  ts                        TIMESTAMPTZ NOT NULL,
  tower_id                  TEXT NOT NULL,
  heat_rejection_kw         DOUBLE PRECISION,
  effectiveness_pct         DOUBLE PRECISION,
  kw_per_tr                 DOUBLE PRECISION,
  total_power_kw            DOUBLE PRECISION,
  tr_load                   DOUBLE PRECISION,
  fouling_index             DOUBLE PRECISION,
  fouling_category          TEXT,
  hours_to_cleaning         DOUBLE PRECISION,
  excess_power_kw           DOUBLE PRECISION,
  savings_lost_rupees_delta DOUBLE PRECISION
);
SELECT create_hypertable('analytics', 'ts', if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS ix_analytics_tower_ts
  ON analytics (tower_id, ts DESC);

CREATE TABLE IF NOT EXISTS alerts (
  id            TEXT PRIMARY KEY,
  tower_id      TEXT NOT NULL,
  kind          TEXT NOT NULL,
  severity      TEXT NOT NULL,
  message       TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL,
  acknowledged  BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS ix_alerts_tower_created
  ON alerts (tower_id, created_at DESC);

CREATE TABLE IF NOT EXISTS settings (
  id                       TEXT PRIMARY KEY DEFAULT 'global',
  tariff_rupees_per_kwh    DOUBLE PRECISION NOT NULL,
  stale_after_seconds      INTEGER NOT NULL,
  fouling_thresholds       JSONB NOT NULL
);
INSERT INTO settings (id, tariff_rupees_per_kwh, stale_after_seconds, fouling_thresholds)
VALUES ('global', 9.0, 90, '{"watch":0.35,"fouled":0.6,"critical":0.85}'::jsonb)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS savings_totals (
  tower_id           TEXT PRIMARY KEY,
  cumulative_rupees  DOUBLE PRECISION NOT NULL DEFAULT 0,
  updated_at         TIMESTAMPTZ
);
