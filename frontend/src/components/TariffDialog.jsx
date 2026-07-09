import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { IDS } from "@/constants/testIds";

export default function TariffDialog({ open, onOpenChange, onSaved }) {
  const [tariff, setTariff] = useState("");
  const [stale, setStale] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    api.settings().then((s) => {
      setTariff(String(s.tariff_rupees_per_kwh));
      setStale(String(s.stale_after_seconds));
    });
  }, [open]);

  const save = async () => {
    setSaving(true);
    try {
      await api.updateSettings({
        tariff_rupees_per_kwh: Number(tariff),
        stale_after_seconds: Number(stale),
      });
      toast.success("Settings updated");
      onOpenChange(false);
      onSaved?.();
    } catch (e) {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#111318] border-[#2a2d35]">
        <DialogHeader>
          <DialogTitle className="tracking-tight">Facility Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="scada-label">Electricity Tariff (₹/kWh)</Label>
            <Input
              data-testid={IDS.tariffInput}
              type="number"
              step="0.01"
              value={tariff}
              onChange={(e) => setTariff(e.target.value)}
              className="mono bg-[#0b0d11] border-[#2a2d35]"
            />
          </div>
          <div className="space-y-2">
            <Label className="scada-label">Device Stale Threshold (seconds)</Label>
            <Input
              type="number"
              value={stale}
              onChange={(e) => setStale(e.target.value)}
              className="mono bg-[#0b0d11] border-[#2a2d35]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            data-testid={IDS.tariffSave}
            onClick={save}
            disabled={saving}
            className="bg-[#0a84ff] hover:bg-[#0a84ff]/80 text-white"
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
