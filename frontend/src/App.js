import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { AlertTriangle, IndianRupee } from "lucide-react";
import TariffDialog from "@/components/TariffDialog";
import Overview from "@/pages/Overview";
import TowerDetail from "@/pages/TowerDetail";
import AlertsPage from "@/pages/AlertsPage";
import ProcessPage from "@/pages/ProcessPage";
import { api } from "@/lib/api";
import { IDS } from "@/constants/testIds";
import "@/App.css";

const LOGO_URL =
  "https://customer-assets.emergentagent.com/job_plant-coolefficiency/artifacts/fpengt98_WhatsApp%20Image%202026-07-08%20at%203.32.01%20PM%20%281%29.jpeg";

function TopBar() {
  const [alertCount, setAlertCount] = useState(0);
  const [tariff, setTariff] = useState(null);
  const [openTariff, setOpenTariff] = useState(false);
  const loc = useLocation();

  const refresh = async () => {
    try {
      const [alerts, settings] = await Promise.all([
        api.alerts({ acknowledged: false, limit: 200 }),
        api.settings(),
      ]);
      setAlertCount(alerts.length);
      setTariff(settings.tariff_rupees_per_kwh);
    } catch (error) {
      console.error("Failed to refresh topbar data:", error);
    }
  };
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 8000);
    return () => clearInterval(t);
  }, []);

  const nav = (to, label, testid) => {
    const active = loc.pathname === to || (to !== "/" && loc.pathname.startsWith(to));
    return (
      <Link
        to={to}
        data-testid={testid}
        className={`px-3 py-1.5 rounded-sm text-sm tracking-wide transition-colors ${
          active ? "bg-[#1a1d24] text-white" : "text-[#a1a6b4] hover:text-white hover:bg-[#151820]"
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <header className="border-b border-[#2a2d35] bg-[#0b0d11] sticky top-0 z-30">
      <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center gap-6">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-sm bg-white p-1 flex items-center justify-center">
            <img
              src={LOGO_URL}
              alt="SS Filters Pvt. Ltd."
              className="max-h-full max-w-full object-contain"
            />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight">SS Filters · Cooling Tower Audit</div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-[#6b7280] mono">
              On-Prem · Factory LAN
            </div>
          </div>
        </Link>
        <nav className="flex items-center gap-1 ml-6">
          {nav("/", "Overview", IDS.navOverview)}
          {nav("/process", "Process", "nav-process")}
          {nav("/alerts", "Alerts", IDS.navAlerts)}
        </nav>
        <div className="flex-1" />
        <button
          data-testid={IDS.tariffButton}
          onClick={() => setOpenTariff(true)}
          className="scada-sub px-3 py-1.5 flex items-center gap-2 hover:border-[#3e4352] transition-colors"
        >
          <IndianRupee className="w-3.5 h-3.5 text-[#a1a6b4]" />
          <span className="scada-label">Tariff</span>
          <span className="mono text-sm text-white">
            {tariff == null ? "—" : `₹${tariff.toFixed(2)}/kWh`}
          </span>
        </button>
        <div className="scada-sub px-3 py-1.5 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-[#ff9f0a]" />
          <span className="scada-label">Alerts</span>
          <span className="mono text-sm text-white">{alertCount}</span>
        </div>
      </div>
      <TariffDialog open={openTariff} onOpenChange={setOpenTariff} onSaved={refresh} />
    </header>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="App min-h-screen">
        <TopBar />
        <main className="max-w-[1600px] mx-auto px-6 py-6">
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/process" element={<ProcessPage />} />
            <Route path="/tower/:towerId" element={<TowerDetail />} />
            <Route path="/alerts" element={<AlertsPage />} />
          </Routes>
        </main>
        <Toaster theme="dark" position="bottom-right" />
      </div>
    </BrowserRouter>
  );
}
