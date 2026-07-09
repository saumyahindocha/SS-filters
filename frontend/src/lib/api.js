import axios from "axios";

const BACKEND = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND}/api`;

const client = axios.create({ baseURL: API });

export const api = {
  listTowers: () => client.get("/towers").then((r) => r.data),
  getTower: (id) => client.get(`/towers/${id}`).then((r) => r.data),
  snapshot: (id) => client.get(`/towers/${id}/snapshot`).then((r) => r.data),
  latestAnalytics: (id) =>
    client.get(`/towers/${id}/analytics/latest`).then((r) => r.data),
  history: (id, metric, hours = 24) =>
    client
      .get(`/towers/${id}/history`, { params: { metric, hours } })
      .then((r) => r.data),
  devices: (id) => client.get(`/towers/${id}/devices`).then((r) => r.data),
  fouling: (id) => client.get(`/towers/${id}/fouling`).then((r) => r.data),
  alerts: (params = {}) => client.get("/alerts", { params }).then((r) => r.data),
  ackAlert: (id) => client.patch(`/alerts/${id}`).then((r) => r.data),
  settings: () => client.get("/settings").then((r) => r.data),
  updateSettings: (patch) =>
    client.patch("/settings", patch).then((r) => r.data),
};
