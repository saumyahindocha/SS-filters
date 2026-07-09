import { AlertTriangle } from "lucide-react";

export default function SensorTile({ label, value, unit, testid, stale, warn, hint }) {
  const color = stale
    ? "text-[#8e8e93]"
    : warn
    ? "text-[#ff9f0a]"
    : "text-white";
  return (
    <div className="scada-card p-4 flex flex-col gap-1.5 h-full">
      <div className="flex items-center justify-between">
        <div className="scada-label">{label}</div>
        {stale ? (
          <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-[#ff9f0a]">
            <AlertTriangle className="w-3 h-3" />
            stale
          </span>
        ) : null}
      </div>
      <div className={`mono text-3xl font-bold tabular-nums ${color}`} data-testid={testid}>
        {value ?? "—"}
        {value != null && unit ? (
          <span className="text-sm text-[#6b7280] ml-1.5 font-normal">{unit}</span>
        ) : null}
      </div>
      {hint ? <div className="text-[11px] text-[#6b7280]">{hint}</div> : null}
    </div>
  );
}
