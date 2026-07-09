import ProcessScene from "@/components/ProcessScene";

const STEPS = [
  { n: 1, name: "Servers Generate Heat", body: "Server racks generate heat during operation; heat load must be removed from the data hall." },
  { n: 2, name: "Chilled Water Absorbs Heat", body: "Cold water (6–10°C) flows through cooling coils in CRAC/CRAH units and absorbs heat from air." },
  { n: 3, name: "Evaporator", body: "Warm chilled water enters the evaporator. Refrigerant boils at low pressure and absorbs heat from water." },
  { n: 4, name: "Compressor", body: "Compressor increases refrigerant pressure and temperature — low-pressure vapor becomes high-pressure, high-temperature vapor." },
  { n: 5, name: "Condenser", body: "Hot refrigerant releases heat to condenser water and condenses into liquid at high pressure." },
  { n: 6, name: "Cooling Tower", body: "Warm water (32–36°C) from condenser goes to the cooling tower. Heat is rejected to atmosphere by evaporation." },
  { n: 7, name: "Atmosphere", body: "Heat is finally dissipated to atmosphere; cooled water returns to the condenser." },
];

const AUDIT_KIT = [
  { name: "Clamp-on Ultrasonic Flow Meter", metrics: "Flow (m³/hr) · Velocity · Totalizer" },
  { name: "RTD Temperature Sensors", metrics: "Supply Temp · Return Temp (4× per tower)" },
  { name: "Pressure Sensors", metrics: "Suction · Discharge · Filter DP" },
  { name: "Conductivity Sensor", metrics: "Conductivity (µS/cm) · TDS" },
  { name: "Turbidity Sensor", metrics: "Turbidity (NTU)" },
  { name: "Clamp-on Power Analyzers", metrics: "V · I · kW · PF · kWh — Fan, Pump, Chiller" },
  { name: "PLC / IoT Gateway", metrics: "Modbus RTU → MQTT bridge on factory LAN" },
];

export default function ProcessPage() {
  return (
    <div className="space-y-6" data-testid="process-root">
      <section>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Working Principle</h1>
        <p className="text-sm text-[#a1a6b4] mt-1">
          Heat Absorption → Heat Rejection → Heat Dissipation · click and drag to rotate
        </p>
      </section>

      <ProcessScene />

      <section className="scada-card p-5">
        <div className="scada-label mb-3">Complete Loop</div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {STEPS.map((s) => (
            <div key={s.n} className="scada-sub p-3">
              <div className="flex items-center gap-2">
                <span className="mono w-6 h-6 flex items-center justify-center rounded-sm bg-[#0a84ff]/20 text-[#0a84ff] text-xs font-bold">
                  {s.n}
                </span>
                <span className="text-sm font-semibold tracking-tight text-white">{s.name}</span>
              </div>
              <p className="text-xs text-[#a1a6b4] mt-2 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="scada-card p-5">
        <div className="scada-label mb-3">Cooling Water Energy Audit Kit</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {AUDIT_KIT.map((k) => (
            <div key={k.name} className="scada-sub p-3 flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">{k.name}</div>
                <div className="text-xs text-[#a1a6b4] mt-1 mono">{k.metrics}</div>
              </div>
              <div className="dot dot-ok mt-1.5" />
            </div>
          ))}
        </div>
        <div className="mt-4 text-[11px] text-[#6b7280] leading-relaxed">
          All sensors publish via Modbus RTU → PLC → IoT gateway → MQTT topic
          <span className="mono text-[#a1a6b4]"> factory/towers/&lt;tower_id&gt;/telemetry</span>.
          The FastAPI ingestion service subscribes with a wildcard subscription and
          writes each reading into the time-series store keyed by <span className="mono">tower_id</span>.
        </div>
      </section>
    </div>
  );
}
