import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import TowerCard from "@/components/TowerCard";
import { IDS } from "@/constants/testIds";

export default function Overview() {
  const [towers, setTowers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const load = async () => {
    try {
      const d = await api.listTowers();
      setTowers(d);
      setErr(null);
    } catch (e) {
      setErr(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  const totalSaved = towers.reduce((s, t) => s + (t.cumulative_savings_lost || 0), 0);
  const totalPower = towers.reduce(
    (s, t) => s + (t.latest_analytics?.total_power_kw || 0), 0
  );
  const totalAlerts = towers.reduce((s, t) => s + (t.active_alerts || 0), 0);

  return (
    <div data-testid={IDS.overviewRoot} className="space-y-6">
      <section className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Facility Overview</h1>
          <p className="text-sm text-[#a1a6b4] mt-1">
            {towers.length} cooling towers · live telemetry over MQTT/Modbus · updated every 15s
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3 min-w-[560px]">
          <div className="scada-sub p-3">
            <div className="scada-label">Total Load</div>
            <div className="mono text-2xl text-white tabular-nums">
              {totalPower.toFixed(0)}<span className="text-xs text-[#6b7280] ml-1">kW</span>
            </div>
          </div>
          <div className="scada-sub p-3">
            <div className="scada-label">Active Alerts</div>
            <div className="mono text-2xl text-white tabular-nums">
              {totalAlerts}
            </div>
          </div>
          <div className="scada-sub p-3">
            <div className="scada-label">Cumulative ₹ Lost</div>
            <div className="mono text-2xl text-[#30d158] tabular-nums font-bold">
              ₹{totalSaved.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </div>
          </div>
        </div>
      </section>

      {err ? (
        <div className="scada-card p-4 text-[#ff3b30] mono text-sm">{err}</div>
      ) : loading ? (
        <div className="text-[#6b7280] mono text-sm">Loading telemetry…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {towers.map((t) => (
            <div key={t.id} data-testid={IDS.towerCard(t.id)}>
              <TowerCard tower={t} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
