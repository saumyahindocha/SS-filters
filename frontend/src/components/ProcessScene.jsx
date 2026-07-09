import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html, RoundedBox, Text } from "@react-three/drei";
import * as THREE from "three";

/* -------------------------------------------------------------------------- */
/* Individual equipment "models" — built from primitives so we ship no assets */
/* -------------------------------------------------------------------------- */

function ServerRack({ position, label }) {
  return (
    <group position={position}>
      <RoundedBox args={[1.2, 2.0, 0.8]} radius={0.05} smoothness={3}>
        <meshStandardMaterial color="#1f2937" metalness={0.7} roughness={0.4} />
      </RoundedBox>
      {[...Array(6)].map((_, i) => (
        <mesh key={i} position={[0, 0.85 - i * 0.32, 0.41]}>
          <boxGeometry args={[1.0, 0.15, 0.02]} />
          <meshStandardMaterial
            color="#0a84ff"
            emissive="#0a84ff"
            emissiveIntensity={0.6}
          />
        </mesh>
      ))}
      <Label position={[0, -1.35, 0]}>{label}</Label>
    </group>
  );
}

function Chiller({ position, label, color = "#30d158" }) {
  return (
    <group position={position}>
      <mesh>
        <cylinderGeometry args={[0.5, 0.5, 1.6, 24]} />
        <meshStandardMaterial color={color} metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.9, 0]}>
        <cylinderGeometry args={[0.55, 0.5, 0.2, 24]} />
        <meshStandardMaterial color="#374151" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, -0.9, 0]}>
        <cylinderGeometry args={[0.5, 0.55, 0.2, 24]} />
        <meshStandardMaterial color="#374151" metalness={0.7} roughness={0.3} />
      </mesh>
      <Label position={[0, -1.4, 0]}>{label}</Label>
    </group>
  );
}

function Compressor({ position, label }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.z = clock.getElapsedTime() * 4;
  });
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[1.1, 1.1, 1.0]} />
        <meshStandardMaterial color="#4b5563" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh ref={ref} position={[0, 0, 0.6]}>
        <torusGeometry args={[0.35, 0.08, 12, 24]} />
        <meshStandardMaterial color="#ff9f0a" emissive="#ff9f0a" emissiveIntensity={0.4} />
      </mesh>
      <Label position={[0, -0.9, 0]}>{label}</Label>
    </group>
  );
}

function CoolingTower({ position, label }) {
  const fanRef = useRef();
  useFrame(({ clock }) => {
    if (fanRef.current) fanRef.current.rotation.y = clock.getElapsedTime() * 6;
  });
  return (
    <group position={position}>
      <mesh position={[0, -0.5, 0]}>
        <cylinderGeometry args={[1.0, 1.2, 1.6, 24]} />
        <meshStandardMaterial color="#6b7280" metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.85, 1.0, 0.6, 24]} />
        <meshStandardMaterial color="#9ca3af" metalness={0.4} roughness={0.5} />
      </mesh>
      {/* Fan */}
      <group ref={fanRef} position={[0, 0.9, 0]}>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} rotation={[0, (i * Math.PI) / 2, 0]}>
            <boxGeometry args={[0.7, 0.05, 0.15]} />
            <meshStandardMaterial color="#111318" />
          </mesh>
        ))}
      </group>
      {/* Steam/vapor puff */}
      {[0, 1, 2].map((i) => (
        <VaporPuff key={i} position={[0, 1.4 + i * 0.5, 0]} delay={i * 0.7} />
      ))}
      <Label position={[0, -1.7, 0]}>{label}</Label>
    </group>
  );
}

function VaporPuff({ position, delay }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = (clock.getElapsedTime() + delay) % 2.5;
    ref.current.position.y = position[1] + t * 0.6;
    ref.current.material.opacity = Math.max(0, 0.4 - t * 0.16);
    const s = 0.4 + t * 0.4;
    ref.current.scale.set(s, s, s);
  });
  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[0.4, 12, 12]} />
      <meshBasicMaterial color="#e5e7eb" transparent opacity={0.4} />
    </mesh>
  );
}

function CRAC({ position, label }) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[1.0, 1.8, 0.8]} />
        <meshStandardMaterial color="#374151" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.3, 0.41]}>
        <circleGeometry args={[0.35, 24]} />
        <meshStandardMaterial color="#0a84ff" emissive="#0a84ff" emissiveIntensity={0.5} />
      </mesh>
      <Label position={[0, -1.15, 0]}>{label}</Label>
    </group>
  );
}

function Label({ position, children }) {
  return (
    <Text
      position={position}
      fontSize={0.16}
      color="#ffffff"
      anchorX="center"
      anchorY="middle"
      outlineWidth={0.008}
      outlineColor="#000"
    >
      {children}
    </Text>
  );
}

/* -------------------------------------------------------------------------- */
/* Pipe with animated flow between two nodes                                  */
/* -------------------------------------------------------------------------- */

function Pipe({ from, to, color = "#0a84ff", flowColor = "#60a5fa" }) {
  const curve = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(...from),
        new THREE.Vector3((from[0] + to[0]) / 2, (from[1] + to[1]) / 2 + 0.2, (from[2] + to[2]) / 2),
        new THREE.Vector3(...to),
      ]),
    [from, to],
  );
  const dropRef = useRef();
  useFrame(({ clock }) => {
    if (!dropRef.current) return;
    const t = (clock.getElapsedTime() * 0.35) % 1;
    const p = curve.getPointAt(t);
    dropRef.current.position.set(p.x, p.y, p.z);
  });
  return (
    <group>
      <mesh>
        <tubeGeometry args={[curve, 40, 0.07, 12, false]} />
        <meshStandardMaterial color={color} metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh ref={dropRef}>
        <sphereGeometry args={[0.11, 12, 12]} />
        <meshStandardMaterial
          color={flowColor}
          emissive={flowColor}
          emissiveIntensity={1.2}
        />
      </mesh>
    </group>
  );
}

/* -------------------------------------------------------------------------- */
/* Scene                                                                       */
/* -------------------------------------------------------------------------- */

const STAGES = [
  { pos: [-8, 0, 0], label: "1. Server Racks", body: <ServerRack position={[-8, 0, 0]} label="SERVERS" /> },
  { pos: [-5, 0, 0], label: "2. CRAC / CRAH", body: <CRAC position={[-5, 0, 0]} label="CRAC/CRAH" /> },
  { pos: [-2, 0, 0], label: "3. Evaporator", body: <Chiller position={[-2, 0, 0]} label="EVAP" color="#30d158" /> },
  { pos: [0.5, 0, 0], label: "4. Compressor", body: <Compressor position={[0.5, 0, 0]} label="COMP" /> },
  { pos: [3, 0, 0], label: "5. Condenser", body: <Chiller position={[3, 0, 0]} label="COND" color="#ff3b30" /> },
  { pos: [6, 0, 0], label: "6. Cooling Tower", body: <CoolingTower position={[6, 0, 0]} label="CT" /> },
];

function Scene() {
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 8, 5]} intensity={1.1} castShadow />
      <directionalLight position={[-6, 4, -3]} intensity={0.4} color="#0a84ff" />

      {STAGES.map((s) => (
        <group key={s.label}>{s.body}</group>
      ))}

      {/* Chilled water loop (blue) - CRAC <-> Evaporator */}
      <Pipe from={[-4.4, 0.4, 0]} to={[-2.5, 0.4, 0]} color="#1e40af" flowColor="#60a5fa" />
      <Pipe from={[-2.5, -0.4, 0]} to={[-4.4, -0.4, 0]} color="#b91c1c" flowColor="#f87171" />

      {/* Refrigerant loop - evap -> comp -> cond */}
      <Pipe from={[-1.4, 0.3, 0]} to={[0.0, 0.3, 0]} color="#065f46" flowColor="#34d399" />
      <Pipe from={[1.0, 0.3, 0]} to={[2.4, 0.3, 0]} color="#b45309" flowColor="#fbbf24" />
      <Pipe from={[2.4, -0.3, 0]} to={[1.0, -0.3, 0]} color="#7f1d1d" flowColor="#ef4444" />
      <Pipe from={[0.0, -0.3, 0]} to={[-1.4, -0.3, 0]} color="#1d4ed8" flowColor="#60a5fa" />

      {/* Condenser water loop - cond <-> cooling tower */}
      <Pipe from={[3.6, 0.4, 0]} to={[5.4, 0.4, 0]} color="#b91c1c" flowColor="#f87171" />
      <Pipe from={[5.4, -0.4, 0]} to={[3.6, -0.4, 0]} color="#1e40af" flowColor="#60a5fa" />

      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.2, 0]}>
        <planeGeometry args={[40, 20]} />
        <meshStandardMaterial color="#0b0d11" />
      </mesh>

      <OrbitControls
        enablePan={false}
        minDistance={6}
        maxDistance={22}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.1}
      />
    </>
  );
}

export default function ProcessScene() {
  return (
    <div className="w-full h-[560px] rounded-sm overflow-hidden border border-[#2a2d35] bg-[#050608]">
      <Canvas camera={{ position: [0, 4, 14], fov: 45 }} dpr={[1, 1.6]}>
        <Scene />
      </Canvas>
    </div>
  );
}
