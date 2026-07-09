import { Link } from "react-router-dom";
import { ChevronRight, Cpu, AlertCircle, Waves } from "lucide-react";
import { IDS } from "@/constants/testIds";

const STATUS = {
  ok: { dot: "dot-ok", label: "Nominal" },
  warn: { dot: "dot-warn", label: "Fouling Watch" },
  critical: { dot: "dot-critical", label: "Critical" },
  degraded: { dot: "dot-warn", label: "Sensor Offline" },
  unknown: { dot: "dot-unknown", label: "Warming Up" },
};

function KV({ label, value, unit, testid }) {
  return (
    <div className="flex flex-col">
      <div className="scada-label">{label}</div>
      <div className="mono text-lg text-white tabular-nums" data-testid={testid}>
        {value ?? "—"}
        {value != null && unit ? <span className="text-[#6b7280] text-xs ml-1">{unit}</span> : null}
      </div>
    </div>
  );
}

export default function TowerCard({ tower }) {
  const s = STATUS[tower.status] || STATUS.unknown;
  const a = tower.latest_analytics || {};
  const v = tower.latest_values || {};
  return (
    <Link
      to={`/tower/${tower.id}`}
      data-testid={IDS.towerCardOpen(tower.id)}
      className="scada-card p-4 flex flex-col gap-4 hover:border-[#3e4352] transition-colors group"
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className={`dot ${s.dot}`} />
            <span className="text-xs uppercase tracking-[0.12em] text-[#a1a6b4]">
              {s.label}
            </span>
          </div>
          <div className="mt-1 text-xl font-semibold tracking-tight text-white">
            {tower.name}
          </div>
          <div className="text-xs text-[#6b7280]">{tower.location}</div>
        </div>
        <div className="text-right">
          <div className="scada-label">Tower ID</div>
          <div className="mono text-sm text-white">{tower.id}</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <KV label="Total Power" value={a.total_power_kw?.toFixed(1)} unit="kW"
            testid={IDS.power(tower.id, "total")} />
        <KV label="kW/TR" value={a.kw_per_tr?.toFixed(3)} />
        <KV label="Effectiveness" value={a.effectiveness_pct?.toFixed(1)} unit="%" />
        <KV label="Heat Rejection" value={a.heat_rejection_kw?.toFixed(0)} unit="kW" />
        <KV label="Flow" value={v.flow_m3h?.toFixed(1)} unit="m³/h" />
        <KV label="ΔT" value={
          (v.return_temp_c != null && v.supply_temp_c != null)
            ? (v.return_temp_c - v.supply_temp_c).toFixed(2)
            : null
        } unit="°C" />
      </div>

      <div className="mt-auto pt-3 border-t border-[#2a2d35] flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs text-[#a1a6b4]">
          <span className="flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5" />
            <span className="mono">
              {tower.devices.online}/{tower.devices.total}
            </span>
            <span>online</span>
          </span>
          <span className="flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-[#ff9f0a]" />
            <span className="mono">{tower.active_alerts}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Waves className="w-3.5 h-3.5 text-[#0a84ff]" />
            <span className="mono">{a.fouling_category || "—"}</span>
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <div className="text-right">
            <div className="scada-label">Savings Lost</div>
            <div className="mono text-[#30d158] font-semibold" data-testid={IDS.savings(tower.id)}>
              ₹{(tower.cumulative_savings_lost || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-[#6b7280] group-hover:text-white transition-colors" />
        </div>
      </div>
    </Link>
  );
}
