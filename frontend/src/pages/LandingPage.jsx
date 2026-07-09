import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";

const LOGO = "https://customer-assets.emergentagent.com/job_plant-coolefficiency/artifacts/fpengt98_WhatsApp%20Image%202026-07-08%20at%203.32.01%20PM%20%281%29.jpeg";

/* Palette */
const C = {
  amber:  [255, 122, 69],
  rust:   [228, 87, 46],
  teal:   [47, 184, 172],
  navy:   [7, 27, 43],
  mist:   [191, 227, 240],
  maroon: [139, 38, 53],
};
const lerp = (a, b, t) => a + (b - a) * t;
const lerpRGB = (A, B, t) => `rgb(${Math.round(lerp(A[0], B[0], t))}, ${Math.round(lerp(A[1], B[1], t))}, ${Math.round(lerp(A[2], B[2], t))})`;
function bgAt(p) {
  // p in [0,1]. Segments: amber->rust (0-0.25), rust->teal (0.25-0.65), teal->navy (0.65-1)
  if (p < 0.25) return lerpRGB(C.amber, C.rust, p / 0.25);
  if (p < 0.65) return lerpRGB(C.rust,  C.teal, (p - 0.25) / 0.4);
  return lerpRGB(C.teal, C.navy, (p - 0.65) / 0.35);
}

/* --- Background particles canvas, follows scroll color --- */
function ParticleBG({ progressRef }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize(); window.addEventListener("resize", resize);
    const N = Math.min(90, Math.floor(window.innerWidth / 22));
    const parts = Array.from({ length: N }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: 1.2 + Math.random() * 3.5,
      vy: -0.15 - Math.random() * 0.35,
      vx: (Math.random() - 0.5) * 0.2,
      a: 0.25 + Math.random() * 0.35,
    }));
    let raf;
    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const p = progressRef.current || 0;
      const col = bgAt(Math.min(1, p + 0.1));
      for (const q of parts) {
        q.x += q.vx; q.y += q.vy;
        if (q.y < -10) { q.y = canvas.height + 10; q.x = Math.random() * canvas.width; }
        if (q.x < -10) q.x = canvas.width + 10;
        if (q.x > canvas.width + 10) q.x = -10;
        ctx.beginPath();
        ctx.fillStyle = col.replace("rgb", "rgba").replace(")", `,${q.a})`);
        ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, [progressRef]);
  return <canvas ref={ref} className="fixed inset-0 pointer-events-none z-0" />;
}

/* --- Pointer-tilt card --- */
function TiltCard({ children, className = "" }) {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const onMove = (e) => {
    if (reduce || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    ref.current.style.transform = `perspective(1200px) rotateY(${px * 10}deg) rotateX(${-py * 10}deg) translateZ(0)`;
  };
  const onLeave = () => { if (ref.current) ref.current.style.transform = "perspective(1200px) rotateY(0) rotateX(0)"; };
  return (
    <div ref={ref} onMouseMove={onMove} onMouseLeave={onLeave}
      className={`transition-transform duration-200 will-change-transform ${className}`}>
      {children}
    </div>
  );
}

/* --- Scroll-reveal wrapper --- */
const Rise = ({ children, delay = 0, className = "" }) => (
  <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount: 0.4 }} transition={{ duration: 0.7, delay, ease: [0.2, 0.7, 0.2, 1] }}
    className={className}>
    {children}
  </motion.div>
);

/* --- Live audit-kit numbers --- */
function LiveKPI({ label, unit, seed, decimals = 1, testid }) {
  const [v, setV] = useState(seed);
  useEffect(() => {
    const id = setInterval(() => {
      setV((prev) => Math.max(0, prev + (Math.random() - 0.5) * seed * 0.04));
    }, 1500);
    return () => clearInterval(id);
  }, [seed]);
  return (
    <div className="p-4 rounded bg-black/25 border border-white/15 backdrop-blur">
      <div className="text-[10px] uppercase tracking-[0.18em] text-white/70 font-mono">{label}</div>
      <div className="mt-1 font-mono text-3xl text-white tabular-nums" data-testid={testid}>
        {v.toFixed(decimals)}<span className="text-sm text-white/60 ml-1">{unit}</span>
      </div>
    </div>
  );
}

const SECTIONS = [
  { id: "hero",     n: "00", short: "Intro" },
  { id: "stage-1",  n: "01", short: "Data Hall" },
  { id: "stage-2",  n: "02", short: "Chiller" },
  { id: "stage-3",  n: "03", short: "Cooling Tower" },
  { id: "stage-4",  n: "04", short: "Fouling" },
  { id: "stage-5",  n: "05", short: "Audit Kit" },
  { id: "stage-6",  n: "06", short: "Filter" },
  { id: "cta",      n: "07", short: "Contact" },
];

function SideNav({ active }) {
  return (
    <nav className="hidden md:flex fixed right-6 top-1/2 -translate-y-1/2 z-40 flex-col gap-3">
      {SECTIONS.map((s) => (
        <a key={s.id} href={`#${s.id}`}
          className="group flex items-center gap-3 justify-end focus:outline-none focus:ring-2 focus:ring-white/60 rounded"
          data-testid={`nav-dot-${s.id}`}>
          <span className={`font-mono text-[10px] tracking-[0.2em] transition-opacity ${active === s.id ? "opacity-100 text-white" : "opacity-0 group-hover:opacity-80 text-white"}`}>
            {s.n} · {s.short}
          </span>
          <span className={`w-2.5 h-2.5 rounded-full border ${active === s.id ? "bg-white border-white scale-125" : "bg-transparent border-white/60"} transition-all`} />
        </a>
      ))}
    </nav>
  );
}

function Section({ id, children, first }) {
  return (
    <section id={id}
      className={`snap-start min-h-screen w-full flex items-center relative ${first ? "" : "pt-16"}`}>
      <div className="max-w-6xl mx-auto px-6 md:px-12 w-full">{children}</div>
    </section>
  );
}

function TempTag({ children }) {
  return <span className="inline-block font-mono text-xs px-2 py-0.5 rounded bg-white/15 border border-white/25 text-white ml-1">{children}</span>;
}

export default function LandingPage() {
  const wrapRef = useRef(null);
  const { scrollYProgress } = useScroll({ container: wrapRef });
  const progressRef = useRef(0);
  const [bg, setBg] = useState(bgAt(0));
  const [active, setActive] = useState("hero");

  useEffect(() => {
    return scrollYProgress.on("change", (v) => {
      progressRef.current = v;
      setBg(bgAt(v));
    });
  }, [scrollYProgress]);

  // Active-section observer
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { threshold: 0.55 },
    );
    SECTIONS.forEach((s) => { const el = document.getElementById(s.id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, []);

  const [form, setForm] = useState({ name: "", company: "", email: "", note: "" });
  const [submitted, setSubmitted] = useState(false);
  const submit = (e) => { e.preventDefault(); setSubmitted(true); };

  return (
    <div ref={wrapRef}
      style={{ backgroundColor: bg, fontFamily: "'Space Grotesk', system-ui, sans-serif" }}
      className="relative w-full min-h-screen text-white overflow-x-hidden snap-y snap-mandatory h-screen overflow-y-scroll">
      <ParticleBG progressRef={progressRef} />
      <SideNav active={active} />

      {/* Top brand strip */}
      <div className="fixed top-4 left-6 z-40 flex items-center gap-3">
        <div className="w-10 h-10 rounded bg-white p-1 flex items-center justify-center shadow-lg">
          <img src={LOGO} alt="SS Filters logo" className="max-h-full max-w-full object-contain" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-tight">SS FILTERS PVT. LTD.</div>
          <div className="text-[10px] font-mono tracking-[0.18em] opacity-80">THE TRUST FOR PROCESS FILTRATION</div>
        </div>
      </div>
      <div className="fixed top-4 right-6 z-40 hidden md:block">
        <Link to="/dashboard" data-testid="cta-open-dashboard"
          className="font-mono text-xs px-3 py-2 rounded border border-white/40 hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/60">
          Live Dashboard →
        </Link>
      </div>

      {/* Hero */}
      <Section id="hero" first>
        <div className="relative z-10">
          <motion.div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-white p-3 shadow-2xl mb-8 mx-auto md:mx-0"
            animate={{ y: [0, -10, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}>
            <img src={LOGO} alt="SS Filters logo" className="w-full h-full object-contain" />
          </motion.div>
          <div className="font-mono text-xs tracking-[0.28em] opacity-85">THE HEAT JOURNEY · 07 STAGES</div>
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight mt-4 leading-[1.02] max-w-4xl">
            Every degree of fouling has a price.
          </h1>
          <p className="mt-6 text-lg md:text-xl max-w-2xl opacity-95">
            SS Filters engineers side-stream filtration for industrial cooling water —
            measured, retrofitted, and paid back in kilowatts.
          </p>
          <div className="mt-10 flex flex-col md:flex-row items-start md:items-center gap-4">
            <a href="#cta" data-testid="cta-request-audit-hero"
              className="px-6 py-3 bg-white text-[#8B2635] font-semibold rounded-sm hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-white/60">
              Request an audit
            </a>
            <a href="#stage-1" className="font-mono text-xs tracking-[0.2em] opacity-90 underline underline-offset-4">
              SCROLL — FOLLOW THE HEAT ↓
            </a>
          </div>
        </div>
      </Section>

      {/* Stage 1 */}
      <Section id="stage-1">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <Rise>
            <div className="font-mono text-xs tracking-[0.24em] opacity-85">STAGE 01 · DATA HALL</div>
            <h2 className="text-4xl md:text-5xl font-bold mt-3 leading-tight">Heat is born the moment a server boots.</h2>
            <p className="mt-5 text-white/95 max-w-lg">
              Server racks convert electrical work directly into heat. Chilled water flowing through
              CRAC/CRAH coils absorbs it and carries it out of the hall.
            </p>
            <div className="mt-6 font-mono text-sm space-y-1">
              <div>Chilled Water Supply <TempTag>6–10 °C</TempTag></div>
              <div>Return Water <TempTag>12–15 °C</TempTag></div>
            </div>
          </Rise>
          <TiltCard>
            <Rise delay={0.1} className="rounded-lg border border-white/25 bg-black/25 backdrop-blur-md p-6">
              <div className="grid grid-cols-4 gap-2 mb-4">
                {Array.from({ length: 20 }).map((_, i) => (
                  <div key={i} className="h-6 rounded-sm bg-white/10 border border-white/20 flex items-center justify-center">
                    <div className="w-3/4 h-1.5 rounded-sm bg-[#2FB8AC]" />
                  </div>
                ))}
              </div>
              <div className="font-mono text-xs opacity-90">
                20 racks × ~12 kW/rack ≈ 240 kW of pure heat to remove.
              </div>
            </Rise>
          </TiltCard>
        </div>
      </Section>

      {/* Stage 2 */}
      <Section id="stage-2">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <TiltCard>
            <Rise className="rounded-lg border border-white/25 bg-black/25 backdrop-blur-md p-6">
              <div className="grid grid-cols-3 gap-3 items-center">
                {["EVAP", "COMP", "COND"].map((k) => (
                  <div key={k} className="h-28 rounded bg-white/10 border border-white/25 flex flex-col items-center justify-center">
                    <div className="font-mono text-2xl text-white">{k}</div>
                    <div className="text-[10px] opacity-80 mt-1 font-mono">stage</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 font-mono text-[11px] opacity-90">
                low-pressure vapor → high-pressure vapor → liquid
              </div>
            </Rise>
          </TiltCard>
          <Rise delay={0.1}>
            <div className="font-mono text-xs tracking-[0.24em] opacity-85">STAGE 02 · CHILLER</div>
            <h2 className="text-4xl md:text-5xl font-bold mt-3 leading-tight">Compress. Reject. Repeat.</h2>
            <p className="mt-5 text-white/95 max-w-lg">
              The refrigerant loop absorbs heat at the evaporator, is pressurised by the compressor,
              and dumps the heat into condenser water.
            </p>
            <div className="mt-6 font-mono text-sm space-y-1">
              <div>Condenser Water Inlet <TempTag>28–32 °C</TempTag></div>
              <div>Condenser Water Outlet <TempTag>32–36 °C</TempTag></div>
            </div>
          </Rise>
        </div>
      </Section>

      {/* Stage 3 */}
      <Section id="stage-3">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <Rise>
            <div className="font-mono text-xs tracking-[0.24em] opacity-85">STAGE 03 · COOLING TOWER</div>
            <h2 className="text-4xl md:text-5xl font-bold mt-3 leading-tight">Heat leaves as vapour.</h2>
            <p className="mt-5 text-white/95 max-w-lg">
              Warm condenser water is sprayed over fill media. A fraction evaporates and the rest
              returns to the chiller, several degrees cooler.
            </p>
            <div className="mt-6 font-mono text-sm">
              Cooling Tower Leaving Water <TempTag>28–32 °C</TempTag>
            </div>
          </Rise>
          <TiltCard>
            <Rise delay={0.1} className="rounded-lg border border-white/25 bg-black/25 backdrop-blur-md p-6 relative overflow-hidden h-64">
              <div className="absolute inset-x-0 top-0 flex justify-around">
                {[0,1,2,3].map((i) => (
                  <motion.div key={i} className="w-6 h-6 rounded-full bg-white/50"
                    animate={{ y: [0, -30, 0], opacity: [0.7, 0, 0.7] }}
                    transition={{ duration: 3, delay: i * 0.4, repeat: Infinity }} />
                ))}
              </div>
              <div className="absolute inset-x-6 bottom-6 top-16 border-2 border-white/40 rounded bg-white/5">
                <div className="w-full h-full bg-[repeating-linear-gradient(45deg,transparent_0,transparent_8px,rgba(255,255,255,0.15)_8px,rgba(255,255,255,0.15)_10px)]" />
              </div>
            </Rise>
          </TiltCard>
        </div>
      </Section>

      {/* Stage 4 - The problem */}
      <Section id="stage-4">
        <Rise>
          <div className="font-mono text-xs tracking-[0.24em] opacity-85">STAGE 04 · THE PROBLEM</div>
          <h2 className="text-4xl md:text-6xl font-bold mt-3 leading-tight max-w-4xl">
            Fouling is a thermal insulator you pay to install.
          </h2>
        </Rise>
        <div className="grid md:grid-cols-3 gap-4 mt-10">
          {[
            { t: "Scale", d: "Calcium carbonate crystallises on condenser tubes as cycles of concentration rise." },
            { t: "Biofilm", d: "Micro-organisms build a slime layer with a thermal conductivity ~200× lower than steel." },
            { t: "Suspended solids", d: "Dust, silt and corrosion products settle in the low-velocity zones of the loop." },
          ].map((x, i) => (
            <TiltCard key={x.t}>
              <Rise delay={i * 0.1} className="rounded-lg border border-white/25 bg-black/30 backdrop-blur-md p-5 h-full">
                <div className="font-mono text-xs tracking-[0.18em] opacity-80">{`0${i+1}`}</div>
                <div className="text-2xl font-bold mt-1">{x.t}</div>
                <p className="text-sm text-white/90 mt-2">{x.d}</p>
              </Rise>
            </TiltCard>
          ))}
        </div>
        <Rise delay={0.3} className="mt-8 max-w-3xl font-mono text-sm bg-black/30 border border-white/25 p-4 rounded">
          Per <span className="text-[#BFE3F0]">ASHRAE 550-98</span>, a 0.001-inch fouling layer on condenser tubes
          measurably raises compressor power. Left untreated, that layer keeps growing every hour the plant runs.
        </Rise>
      </Section>

      {/* Stage 5 - Audit kit */}
      <Section id="stage-5">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <Rise>
            <div className="font-mono text-xs tracking-[0.24em] opacity-85">STAGE 05 · MEASURE IT</div>
            <h2 className="text-4xl md:text-5xl font-bold mt-3 leading-tight">The Cooling Water Energy Audit Kit.</h2>
            <p className="mt-5 text-white/95 max-w-lg">
              Clamp-on ultrasonic flow, RTD temps, conductivity, turbidity, filter DP and clamp-on power analysers —
              all bridged through a PLC/IoT gateway to a live telemetry stream.
            </p>
            <ul className="mt-6 space-y-2 font-mono text-sm">
              <li>› Fouling risk classification updated live</li>
              <li>› Excess power vs commissioning baseline</li>
              <li>› Cumulative ₹ savings-lost counter</li>
            </ul>
            <a href="/dashboard" data-testid="cta-open-dashboard-inline"
              className="mt-6 inline-block px-5 py-2 border border-white rounded-sm font-mono text-xs tracking-[0.2em]
                         hover:bg-white hover:text-[#071B2B] focus:outline-none focus:ring-2 focus:ring-white/60">
              OPEN LIVE DASHBOARD →
            </a>
          </Rise>
          <TiltCard>
            <Rise delay={0.1} className="rounded-lg border border-white/30 bg-black/40 backdrop-blur-md p-5">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <LiveKPI label="Flow" unit="m³/hr" seed={980} decimals={0} testid="live-flow" />
                <LiveKPI label="Supply Temp" unit="°C" seed={30.2} decimals={1} testid="live-supply" />
                <LiveKPI label="Return Temp" unit="°C" seed={35.5} decimals={1} testid="live-return" />
                <LiveKPI label="Conductivity" unit="µS/cm" seed={2300} decimals={0} testid="live-cond" />
                <LiveKPI label="Turbidity" unit="NTU" seed={20.5} decimals={1} testid="live-turb" />
                <LiveKPI label="Total Power" unit="kW" seed={648.2} decimals={1} testid="live-power" />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="p-3 rounded bg-[#8B2635]/30 border border-[#8B2635]/60">
                  <div className="font-mono text-[10px] tracking-[0.18em] opacity-85">FOULING RISK</div>
                  <div className="font-bold text-xl">HIGH</div>
                </div>
                <div className="p-3 rounded bg-[#FF7A45]/25 border border-[#FF7A45]/60">
                  <div className="font-mono text-[10px] tracking-[0.18em] opacity-85">EST. LOSS</div>
                  <div className="font-mono text-xl">23 kW</div>
                </div>
                <div className="p-3 rounded bg-[#2FB8AC]/25 border border-[#2FB8AC]/60">
                  <div className="font-mono text-[10px] tracking-[0.18em] opacity-85">EST. ₹ SAVE / YR</div>
                  <div className="font-mono text-xl">₹ 20.1 L</div>
                </div>
              </div>
            </Rise>
          </TiltCard>
        </div>
      </Section>

      {/* Stage 6 - Filter product */}
      <Section id="stage-6">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <TiltCard>
            <Rise className="rounded-lg border border-white/25 bg-black/30 backdrop-blur-md p-6 h-full">
              <svg viewBox="0 0 200 240" className="w-40 mx-auto">
                <circle cx="100" cy="120" r="95" fill="none" stroke="#8B2635" strokeWidth="6" />
                {[0,1,2].map((i) => (
                  <polygon key={i} points={`60,${60+i*45} 140,${60+i*45} 100,${105+i*45}`}
                    fill={i === 0 ? "#333" : i === 1 ? "#888" : "none"}
                    stroke="#111" strokeWidth="2" />
                ))}
              </svg>
              <div className="mt-4 font-mono text-[11px] opacity-90 text-center">
                Three-stage cascade — coarse → fine → polish
              </div>
            </Rise>
          </TiltCard>
          <Rise delay={0.1}>
            <div className="font-mono text-xs tracking-[0.24em] opacity-85">STAGE 06 · STOP IT</div>
            <h2 className="text-4xl md:text-5xl font-bold mt-3 leading-tight">Side-stream filtration. Zero downtime.</h2>
            <p className="mt-5 text-white/95 max-w-lg">
              Continuously polishes 3–10 % of the loop flow. Retrofits existing piping. No production stop.
              Every day the filter runs, less scale is deposited on the condenser.
            </p>
            <div className="mt-6 grid grid-cols-3 gap-3 font-mono text-sm">
              <div className="p-3 rounded bg-white/10 border border-white/20"><div className="opacity-80 text-xs">FLOW POLISHED</div><div className="text-xl">3–10%</div></div>
              <div className="p-3 rounded bg-white/10 border border-white/20"><div className="opacity-80 text-xs">RETROFIT</div><div className="text-xl">YES</div></div>
              <div className="p-3 rounded bg-white/10 border border-white/20"><div className="opacity-80 text-xs">DOWNTIME</div><div className="text-xl">0 hr</div></div>
            </div>
          </Rise>
        </div>
      </Section>

      {/* CTA */}
      <Section id="cta">
        <div className="grid md:grid-cols-2 gap-10 items-start">
          <Rise>
            <div className="font-mono text-xs tracking-[0.24em] opacity-85">STAGE 07 · TALK TO US</div>
            <h2 className="text-4xl md:text-5xl font-bold mt-3 leading-tight">Request an audit.</h2>
            <p className="mt-5 text-white/90 max-w-lg">
              We install the audit kit on your loop, measure your current fouling penalty, and hand
              you a payback calculation. Then, if the numbers work, we retrofit the filter.
            </p>
            <div className="mt-8 flex items-center gap-3">
              <div className="w-12 h-12 rounded bg-white p-1"><img src={LOGO} alt="" className="w-full h-full object-contain" /></div>
              <div className="leading-tight">
                <div className="font-semibold">SS FILTERS PVT. LTD.</div>
                <div className="font-mono text-xs opacity-80">The Trust for Process Filtration</div>
              </div>
            </div>
          </Rise>
          <Rise delay={0.1}>
            {submitted ? (
              <div className="rounded-lg border border-white/40 bg-black/40 backdrop-blur-md p-8 text-center" data-testid="form-success">
                <div className="text-2xl font-bold">Thank you.</div>
                <p className="mt-2 text-sm opacity-90">Our team will reach out within 1 working day.</p>
              </div>
            ) : (
              <form onSubmit={submit} className="rounded-lg border border-white/25 bg-black/35 backdrop-blur-md p-6 space-y-3" data-testid="contact-form">
                {[
                  ["name", "Name"], ["company", "Company / Plant"], ["email", "Work email"],
                ].map(([k, label]) => (
                  <div key={k}>
                    <label className="font-mono text-[10px] tracking-[0.18em] opacity-80 uppercase">{label}</label>
                    <input required type={k === "email" ? "email" : "text"} value={form[k]}
                      onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                      data-testid={`form-${k}`}
                      className="w-full mt-1 bg-black/40 border border-white/25 rounded-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-white/70" />
                  </div>
                ))}
                <div>
                  <label className="font-mono text-[10px] tracking-[0.18em] opacity-80 uppercase">Loop details (optional)</label>
                  <textarea value={form.note} rows={3} onChange={(e) => setForm({ ...form, note: e.target.value })}
                    data-testid="form-note"
                    className="w-full mt-1 bg-black/40 border border-white/25 rounded-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-white/70" />
                </div>
                <button type="submit" data-testid="form-submit"
                  className="w-full py-3 bg-white text-[#071B2B] font-semibold rounded-sm hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-white/70">
                  Request an audit →
                </button>
              </form>
            )}
          </Rise>
        </div>
      </Section>
    </div>
  );
}
