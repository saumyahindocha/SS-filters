export const HOME = {
  emergentLink: "home-emergent-link",
};

export const IDS = {
  // Navigation
  navOverview: "nav-overview",
  navAlerts: "nav-alerts",
  tariffButton: "topbar-tariff-btn",
  tariffInput: "tariff-input",
  tariffSave: "tariff-save",
  // Overview
  overviewRoot: "overview-root",
  towerCard: (id) => `tower-card-${id}`,
  towerCardOpen: (id) => `tower-card-open-${id}`,
  // Tower detail
  detailRoot: (id) => `tower-detail-${id}`,
  sensor: (id, metric) => `sensor-${id}-${metric}`,
  power: (id, kind) => `power-${id}-${kind}`,
  savings: (id) => `savings-${id}`,
  foulingCategory: (id) => `fouling-cat-${id}`,
  foulingHours: (id) => `fouling-hours-${id}`,
  trendChart: (id) => `trend-chart-${id}`,
  trendRange: (r) => `trend-range-${r}`,
  // Alerts
  alertsTable: "alerts-table",
  alertRow: (id) => `alert-row-${id}`,
  alertAck: (id) => `alert-ack-${id}`,
};
