import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { IDS } from "@/constants/testIds";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const SEV = {
  info: "text-[#a1a6b4] border-[#2a2d35]",
  warn: "text-[#ff9f0a] border-[#ff9f0a]/40 bg-[#ff9f0a]/5",
  critical: "text-[#ff3b30] border-[#ff3b30]/40 bg-[#ff3b30]/5",
};

export default function AlertsPage() {
  const [rows, setRows] = useState([]);
  const [showAcked, setShowAcked] = useState(false);

  const load = async () => {
    const params = showAcked ? {} : { acknowledged: false };
    const d = await api.alerts(params);
    setRows(d);
  };
  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [showAcked]);

  const ack = async (id) => {
    await api.ackAlert(id);
    toast.success("Alert acknowledged");
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Alerts</h1>
          <p className="text-sm text-[#a1a6b4]">
            Offline devices and fouling-index breaches · dashboard-only (SMS/Email wiring reserved)
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-[#a1a6b4]">
          <input
            type="checkbox"
            checked={showAcked}
            onChange={(e) => setShowAcked(e.target.checked)}
          />
          Show acknowledged
        </label>
      </div>
      <div className="scada-card p-0 overflow-x-auto">
        <table className="scada-table w-full" data-testid={IDS.alertsTable}>
          <thead>
            <tr>
              <th>Severity</th>
              <th>Tower</th>
              <th>Kind</th>
              <th>Message</th>
              <th>Created</th>
              <th className="w-24">State</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center text-[#6b7280] py-8">
                  No alerts. All systems nominal.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} data-testid={IDS.alertRow(r.id)}>
                  <td>
                    <span className={`px-2 py-0.5 border rounded-sm text-[10px] uppercase tracking-wider ${SEV[r.severity] || SEV.info}`}>
                      {r.severity}
                    </span>
                  </td>
                  <td className="text-white">{r.tower_id}</td>
                  <td className="text-[#a1a6b4]">{r.kind}</td>
                  <td className="text-white" style={{ fontFamily: "IBM Plex Sans" }}>
                    {r.message}
                  </td>
                  <td className="text-[#a1a6b4]">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td>
                    {r.acknowledged ? (
                      <span className="flex items-center gap-1 text-[#30d158] text-xs">
                        <CheckCircle2 className="w-3.5 h-3.5" /> acked
                      </span>
                    ) : (
                      <button
                        data-testid={IDS.alertAck(r.id)}
                        onClick={() => ack(r.id)}
                        className="px-2 py-1 text-xs rounded-sm border border-[#2a2d35] hover:border-[#0a84ff] hover:text-[#0a84ff]"
                      >
                        Acknowledge
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
