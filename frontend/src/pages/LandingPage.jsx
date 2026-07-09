import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, useGLTF, ContactShadows } from "@react-three/drei";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import * as THREE from "three";

const LOGO = "https://customer-assets.emergentagent.com/job_plant-coolefficiency/artifacts/fpengt98_WhatsApp%20Image%202026-07-08%20at%203.32.01%20PM%20%281%29.jpeg";
const MODEL_COOLING = "https://customer-assets.emergentagent.com/job_plant-coolefficiency/artifacts/u480hns4_data_centre_cooling_system.glb";
const MODEL_AUDIT   = "https://customer-assets.emergentagent.com/job_plant-coolefficiency/artifacts/iuvv0em7_cooling_water_audit_kit.glb";

useGLTF.preload(MODEL_COOLING);
useGLTF.preload(MODEL_AUDIT);

/* Fit + monochrome-ify a GLB */
function Model({ url, scroll, xOffset = 0 }) {
  const { scene } = useGLTF(url);
  const ref = useRef();
  const prepared = useMemo(() => {
    const clone = scene.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3(); box.getSize(size);
    const center = new THREE.Vector3(); box.getCenter(center);
    const scale = 2.6 / Math.max(size.x, size.y, size.z);
    clone.position.set(-center.x * scale + xOffset, -center.y * scale, -center.z * scale);
    clone.scale.setScalar(scale);
    clone.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true; o.receiveShadow = true;
        const m = o.material;
        if (m) {
          // Desaturate any colored surfaces toward neutral gray
          if (m.color) {
            const hsl = { h: 0, s: 0, l: 0 };
            m.color.getHSL(hsl);
            m.color.setHSL(0, 0, THREE.MathUtils.clamp(hsl.l * 0.9 + 0.05, 0.05, 0.75));
          }
          if ("metalness" in m) m.metalness = 0.55;
          if ("roughness" in m) m.roughness = 0.4;
        }
      }
    });
    return clone;
  }, [scene, xOffset]);

  useFrame(() => {
    if (!ref.current) return;
    const p = scroll.current;
    ref.current.rotation.y = p * Math.PI * 2.2;
  });

  return <primitive ref={ref} object={prepared} />;
}

function Rig({ scroll }) {
  const { camera } = useThree();
  useFrame(() => {
    const p = scroll.current;
    // Zoom / travel through the model as user scrolls
    const targetZ = 5.0 - p * 2.4;
    const targetY = 0.6 - p * 0.6;
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, 0, 0.05);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetY, 0.05);
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetZ, 0.05);
    camera.lookAt(0, 0, 0);
  });
  return null;
}

function StageScene({ url, scroll }) {
  return (
    <Canvas
      dpr={[1, 1.8]}
      camera={{ position: [0, 0.8, 5], fov: 35 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
    >
      <color attach="background" args={["#000000"]} />
      <ambientLight intensity={0.15} />
      <spotLight position={[3, 5, 4]} angle={0.35} penumbra={0.8} intensity={70} castShadow color="#ffffff" />
      <spotLight position={[-4, 2, -2]} angle={0.5} penumbra={1} intensity={20} color="#ffffff" />
      <Suspense fallback={null}>
        <Model url={url} scroll={scroll} />
        <Environment preset="warehouse" />
        <ContactShadows position={[0, -1.4, 0]} opacity={0.55} scale={8} blur={2.4} far={4} />
      </Suspense>
      <Rig scroll={scroll} />
    </Canvas>
  );
}

/* --- Content sections --- */
const Rise = ({ children, delay = 0, className = "" }) => (
  <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount: 0.5 }} transition={{ duration: 0.9, delay, ease: [0.16, 0.84, 0.24, 1] }}
    className={className}>{children}</motion.div>
);

function LiveKPI({ label, unit, seed, decimals = 1 }) {
  const [v, setV] = useState(seed);
  useEffect(() => {
    const id = setInterval(() => setV((p) => Math.max(0, p + (Math.random() - 0.5) * seed * 0.03)), 1500);
    return () => clearInterval(id);
  }, [seed]);
  return (
    <div className="border-b border-white/15 pb-3">
      <div className="text-[10px] uppercase tracking-[0.24em] text-white/45 font-mono">{label}</div>
      <div className="mt-2 font-mono text-2xl md:text-3xl text-white tabular-nums font-light">
        {v.toFixed(decimals)}<span className="text-xs text-white/40 ml-2">{unit}</span>
      </div>
    </div>
  );
}

const SECTIONS = ["hero", "stage-1", "stage-2", "stage-3", "stage-4", "stage-5", "stage-6", "cta"];

export default function LandingPage() {
  const wrapRef = useRef(null);
  const { scrollYProgress } = useScroll({ container: wrapRef });
  const scroll = useRef(0);
  useEffect(() => scrollYProgress.on("change", (v) => { scroll.current = v; }), [scrollYProgress]);

  const [active, setActive] = useState("hero");
  useEffect(() => {
    const obs = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { threshold: 0.55 },
    );
    SECTIONS.forEach((s) => { const el = document.getElementById(s); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, []);

  // Which model to render behind: cooling for 1-3, audit for 4-6, cooling for hero+cta
  const useAuditModel = ["stage-4", "stage-5", "stage-6"].includes(active);

  const [form, setForm] = useState({ name: "", company: "", email: "", note: "" });
  const [sent, setSent] = useState(false);

  const Section = ({ id, children, right }) => (
    <section id={id}
      className="snap-start h-screen w-full flex items-center relative">
      <div className="max-w-6xl mx-auto px-6 md:px-14 w-full grid md:grid-cols-2 items-center">
        <div className={right ? "md:col-start-1" : "md:col-start-1"}>{children}</div>
        <div />
      </div>
    </section>
  );

  const Eyebrow = ({ children }) => (
    <div className="font-mono text-[11px] tracking-[0.28em] text-white/55">{children}</div>
  );

  return (
    <div ref={wrapRef}
      style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}
      className="relative w-full h-screen overflow-y-scroll snap-y snap-mandatory bg-black text-white">

      {/* Fixed 3D canvas behind everything */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <StageScene url={useAuditModel ? MODEL_AUDIT : MODEL_COOLING} scroll={scroll} />
        {/* right-side vignette to keep text legible on left */}
        <div className="absolute inset-0"
          style={{ background: "linear-gradient(90deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.55) 30%, rgba(0,0,0,0) 55%, rgba(0,0,0,0) 100%)" }} />
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(circle at 50% 100%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.9) 90%)" }} />
      </div>

      {/* Top bar */}
      <header className="fixed top-0 left-0 right-0 z-40 px-6 md:px-10 py-5 flex items-center justify-between backdrop-blur-sm bg-black/20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-white p-1">
            <img src={LOGO} alt="SS Filters" className="w-full h-full object-contain" />
          </div>
          <div className="leading-tight">
            <div className="text-[13px] font-semibold tracking-[0.14em]">SS FILTERS</div>
            <div className="text-[9px] font-mono tracking-[0.28em] text-white/50">THE TRUST FOR PROCESS FILTRATION</div>
          </div>
        </div>
        <nav className="hidden md:flex items-center gap-8 font-mono text-[11px] tracking-[0.2em] text-white/70">
          <a href="#stage-1" className="hover:text-white">Process</a>
          <a href="#stage-5" className="hover:text-white">Audit Kit</a>
          <a href="#stage-6" className="hover:text-white">Filter</a>
          <Link to="/dashboard" data-testid="cta-open-dashboard"
            className="text-white/85 hover:text-white border-b border-white/40 pb-0.5">Live Dashboard →</Link>
        </nav>
      </header>

      {/* Side dot nav */}
      <nav className="hidden md:flex fixed right-6 top-1/2 -translate-y-1/2 z-40 flex-col gap-4">
        {SECTIONS.map((s, i) => (
          <a key={s} href={`#${s}`} data-testid={`nav-dot-${s}`}
            className="group flex items-center gap-3 justify-end focus:outline-none">
            <span className={`font-mono text-[9px] tracking-[0.22em] transition-opacity ${active === s ? "opacity-90" : "opacity-0 group-hover:opacity-60"}`}>
              {String(i).padStart(2, "0")}
            </span>
            <span className={`w-1.5 h-1.5 rounded-full transition-all ${active === s ? "bg-white scale-[1.8]" : "bg-white/40"}`} />
          </a>
        ))}
      </nav>

      <div className="relative z-10">
        {/* HERO */}
        <Section id="hero">
          <div>
            <Rise><Eyebrow>THE HEAT JOURNEY · 07 STAGES</Eyebrow></Rise>
            <Rise delay={0.15}>
              <h1 className="mt-6 text-5xl md:text-7xl lg:text-8xl font-light tracking-tight leading-[0.98]">
                Every degree of<br />fouling has a price.
              </h1>
            </Rise>
            <Rise delay={0.3}>
              <p className="mt-8 max-w-md text-base text-white/70 leading-relaxed">
                Side-stream filtration engineered for industrial cooling water — measured, retrofitted, and paid back in kilowatts.
              </p>
            </Rise>
            <Rise delay={0.45}>
              <div className="mt-10 flex items-center gap-8">
                <a href="#cta" className="px-6 py-3 bg-white text-black text-sm font-medium tracking-wide hover:bg-white/90 transition-colors"
                  data-testid="cta-request-audit-hero">
                  Request an audit
                </a>
                <a href="#stage-1" className="font-mono text-[11px] tracking-[0.24em] text-white/60 hover:text-white">
                  SCROLL ↓
                </a>
              </div>
            </Rise>
          </div>
        </Section>

        {/* STAGE 1 */}
        <Section id="stage-1">
          <div>
            <Rise><Eyebrow>01 · DATA HALL</Eyebrow></Rise>
            <Rise delay={0.1}><h2 className="mt-4 text-4xl md:text-6xl font-light leading-tight">Heat is born.</h2></Rise>
            <Rise delay={0.2}><p className="mt-6 text-white/65 max-w-md">Server racks convert electricity into heat. Chilled water absorbs it and carries it out of the hall.</p></Rise>
            <Rise delay={0.3}>
              <div className="mt-8 font-mono text-sm text-white/70 space-y-2">
                <div>SUPPLY <span className="text-white ml-4">6–10 °C</span></div>
                <div>RETURN <span className="text-white ml-4">12–15 °C</span></div>
              </div>
            </Rise>
          </div>
        </Section>

        {/* STAGE 2 */}
        <Section id="stage-2">
          <div>
            <Rise><Eyebrow>02 · CHILLER</Eyebrow></Rise>
            <Rise delay={0.1}><h2 className="mt-4 text-4xl md:text-6xl font-light leading-tight">Compress.<br />Reject.<br />Repeat.</h2></Rise>
            <Rise delay={0.2}><p className="mt-6 text-white/65 max-w-md">Refrigerant absorbs heat at the evaporator, is pressurised by the compressor, and dumps it into condenser water.</p></Rise>
            <Rise delay={0.3}>
              <div className="mt-8 font-mono text-sm text-white/70 space-y-2">
                <div>COND. WATER IN  <span className="text-white ml-4">28–32 °C</span></div>
                <div>COND. WATER OUT <span className="text-white ml-4">32–36 °C</span></div>
              </div>
            </Rise>
          </div>
        </Section>

        {/* STAGE 3 */}
        <Section id="stage-3">
          <div>
            <Rise><Eyebrow>03 · COOLING TOWER</Eyebrow></Rise>
            <Rise delay={0.1}><h2 className="mt-4 text-4xl md:text-6xl font-light leading-tight">Heat leaves as vapour.</h2></Rise>
            <Rise delay={0.2}><p className="mt-6 text-white/65 max-w-md">Warm condenser water is sprayed over fill media. A fraction evaporates; the rest returns to the chiller, cooler.</p></Rise>
          </div>
        </Section>

        {/* STAGE 4 */}
        <Section id="stage-4">
          <div>
            <Rise><Eyebrow>04 · THE PROBLEM</Eyebrow></Rise>
            <Rise delay={0.1}><h2 className="mt-4 text-4xl md:text-6xl font-light leading-tight">Fouling is a thermal<br />insulator you pay<br />to install.</h2></Rise>
            <Rise delay={0.25}>
              <div className="mt-8 space-y-3 font-mono text-xs tracking-[0.18em] text-white/60">
                <div className="border-l border-white/30 pl-4">SCALE — Calcium carbonate crystallises on tubes.</div>
                <div className="border-l border-white/30 pl-4">BIOFILM — Slime layer, ~200× lower conductivity than steel.</div>
                <div className="border-l border-white/30 pl-4">SOLIDS — Dust, silt, corrosion products settle in the loop.</div>
                <div className="border-l border-white pl-4 text-white/85 mt-6">ASHRAE 550-98 · a 0.001 in. fouling layer measurably raises compressor power.</div>
              </div>
            </Rise>
          </div>
        </Section>

        {/* STAGE 5 - AUDIT KIT */}
        <Section id="stage-5">
          <div>
            <Rise><Eyebrow>05 · MEASURE IT</Eyebrow></Rise>
            <Rise delay={0.1}><h2 className="mt-4 text-4xl md:text-6xl font-light leading-tight">The Audit Kit.</h2></Rise>
            <Rise delay={0.2}><p className="mt-4 text-white/65 max-w-md text-sm">Ultrasonic flow, RTD temps, conductivity, turbidity, filter DP, clamp-on power — bridged through a PLC/IoT gateway to a live telemetry stream.</p></Rise>
            <Rise delay={0.3}>
              <div className="mt-6 grid grid-cols-2 gap-x-8 gap-y-4 max-w-md">
                <LiveKPI label="Flow" unit="m³/hr" seed={980} decimals={0} />
                <LiveKPI label="Supply" unit="°C" seed={30.2} decimals={1} />
                <LiveKPI label="Return" unit="°C" seed={35.5} decimals={1} />
                <LiveKPI label="Total Power" unit="kW" seed={648.2} decimals={1} />
              </div>
            </Rise>
            <Rise delay={0.45}>
              <Link to="/dashboard" data-testid="cta-open-dashboard-inline"
                className="mt-8 inline-block font-mono text-[11px] tracking-[0.24em] text-white/85 border-b border-white/40 pb-1 hover:text-white">
                OPEN LIVE DASHBOARD →
              </Link>
            </Rise>
          </div>
        </Section>

        {/* STAGE 6 - PRODUCT */}
        <Section id="stage-6">
          <div>
            <Rise><Eyebrow>06 · STOP IT</Eyebrow></Rise>
            <Rise delay={0.1}><h2 className="mt-4 text-4xl md:text-6xl font-light leading-tight">Side-stream<br />filtration.<br />Zero downtime.</h2></Rise>
            <Rise delay={0.2}><p className="mt-6 text-white/65 max-w-md">Continuously polishes 3–10 % of the loop flow. Retrofits existing piping. No production stop.</p></Rise>
            <Rise delay={0.3}>
              <div className="mt-8 grid grid-cols-3 gap-8 max-w-md font-mono text-xs">
                <div><div className="text-white/45 tracking-[0.18em]">POLISHED</div><div className="text-white text-2xl font-light mt-1">3–10%</div></div>
                <div><div className="text-white/45 tracking-[0.18em]">RETROFIT</div><div className="text-white text-2xl font-light mt-1">YES</div></div>
                <div><div className="text-white/45 tracking-[0.18em]">DOWNTIME</div><div className="text-white text-2xl font-light mt-1">0 hr</div></div>
              </div>
            </Rise>
          </div>
        </Section>

        {/* CTA */}
        <Section id="cta">
          <div>
            <Rise><Eyebrow>07 · TALK TO US</Eyebrow></Rise>
            <Rise delay={0.1}><h2 className="mt-4 text-4xl md:text-6xl font-light leading-tight">Request an audit.</h2></Rise>
            <Rise delay={0.2}><p className="mt-4 text-white/65 max-w-md text-sm">We install the audit kit on your loop, measure your fouling penalty, and hand you a payback calculation.</p></Rise>
            <Rise delay={0.3}>
              {sent ? (
                <div className="mt-8 max-w-md p-6 border border-white/25 bg-black/60" data-testid="form-success">
                  <div className="text-xl font-light">Thank you.</div>
                  <p className="mt-2 text-sm text-white/60">Our team will reach out within 1 working day.</p>
                </div>
              ) : (
                <form onSubmit={(e) => { e.preventDefault(); setSent(true); }}
                  className="mt-8 max-w-md space-y-4" data-testid="contact-form">
                  {[["name", "NAME"], ["company", "COMPANY"], ["email", "WORK EMAIL"]].map(([k, l]) => (
                    <div key={k}>
                      <label className="font-mono text-[10px] tracking-[0.22em] text-white/45">{l}</label>
                      <input required type={k === "email" ? "email" : "text"} value={form[k]}
                        onChange={(e) => setForm({ ...form, [k]: e.target.value })} data-testid={`form-${k}`}
                        className="w-full bg-transparent border-b border-white/25 py-2 text-white focus:outline-none focus:border-white transition-colors" />
                    </div>
                  ))}
                  <button type="submit" data-testid="form-submit"
                    className="mt-4 px-6 py-3 bg-white text-black text-sm font-medium tracking-wide hover:bg-white/90">
                    Request an audit →
                  </button>
                </form>
              )}
            </Rise>
          </div>
        </Section>
      </div>
    </div>
  );
}
