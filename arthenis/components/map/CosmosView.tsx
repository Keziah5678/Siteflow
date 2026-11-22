"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, OrbitControls, Stars } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { Entity } from "@/lib/engine/types";
import { hash32, rng } from "@/lib/engine/rng";

/**
 * The cosmic scales: galaxies, star systems and planets. Clicking a planet
 * descends to its surface map. Positions come from the entities' own x/y
 * (or a stable hash of their id when they were never placed).
 */
type Props = { entities: Entity[]; selectedId: string | null; onSelect: (id: string) => void; onEnterPlanet: (id: string) => void; active?: boolean };

const coord = (e: Entity, salt = "") => {
  const h = hash32(e.id + salt);
  return { x: e.x ?? (h % 1000) / 10, y: e.y ?? ((h >>> 10) % 1000) / 10 };
};

function Galaxy({ e, position, selected, onSelect }: { e: Entity; position: THREE.Vector3; selected: boolean; onSelect: () => void }) {
  const ref = useRef<THREE.Points>(null);
  const geo = useMemo(() => {
    const r = rng(hash32(e.id));
    const n = 1800, arms = 2 + Math.floor(r.next() * 3);
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    const c1 = new THREE.Color("#c9a6ff"), c2 = new THREE.Color("#5fb3ff");
    for (let i = 0; i < n; i++) {
      const t = r.next(), arm = i % arms, a = t * 9 + (arm / arms) * Math.PI * 2;
      const rad = t * 14, jitter = (1 - t) * 1.2 + 0.4;
      pos[i * 3] = Math.cos(a) * rad + (r.next() - 0.5) * jitter;
      pos[i * 3 + 1] = (r.next() - 0.5) * jitter * 0.4;
      pos[i * 3 + 2] = Math.sin(a) * rad + (r.next() - 0.5) * jitter;
      const c = c1.clone().lerp(c2, t);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return g;
  }, [e.id]);
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.y += dt * 0.03; });
  return (
    <group position={position} onClick={ev => { ev.stopPropagation(); onSelect(); }}>
      <points ref={ref} geometry={geo}><pointsMaterial size={0.35} vertexColors transparent opacity={0.9} depthWrite={false} blending={THREE.AdditiveBlending} /></points>
      <mesh><sphereGeometry args={[1.4, 16, 16]} /><meshBasicMaterial color="#f3ecff" /></mesh>
      <Html position={[0, 4, 0]} center style={{ pointerEvents: "none" }}><div className={`map-label big ${selected ? "sel" : ""}`}>{e.name.toUpperCase()}</div></Html>
    </group>
  );
}

function System({ e, position, planets, selectedId, onSelect, onEnterPlanet }: { e: Entity; position: THREE.Vector3; planets: Entity[]; selectedId: string | null; onSelect: (id: string) => void; onEnterPlanet: (id: string) => void }) {
  const group = useRef<THREE.Group>(null);
  useFrame((_, dt) => { if (group.current) group.current.rotation.y += dt * 0.12; });
  return (
    <group position={position}>
      <mesh onClick={ev => { ev.stopPropagation(); onSelect(e.id); }}><sphereGeometry args={[0.9, 24, 24]} /><meshBasicMaterial color="#ffe3a3" /></mesh>
      <pointLight color="#ffe3a3" intensity={30} distance={30} />
      <Html position={[0, 2, 0]} center style={{ pointerEvents: "none" }}><div className={`map-label ${selectedId === e.id ? "sel" : ""}`}>☀ {e.name}</div></Html>
      <group ref={group}>
        {planets.map((p, i) => {
          const r = 2.6 + i * 1.6, a = (hash32(p.id) % 628) / 100;
          const color = new THREE.Color().setHSL(((hash32(p.id) >>> 8) % 360) / 360, 0.45, 0.55);
          return (
            <group key={p.id}>
              <mesh rotation-x={-Math.PI / 2}><ringGeometry args={[r - 0.02, r + 0.02, 64]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.15} side={THREE.DoubleSide} /></mesh>
              <group position={[Math.cos(a) * r, 0, Math.sin(a) * r]}>
                <mesh onClick={ev => { ev.stopPropagation(); onSelect(p.id); }} onDoubleClick={ev => { ev.stopPropagation(); onEnterPlanet(p.id); }}>
                  <sphereGeometry args={[0.42, 24, 24]} /><meshStandardMaterial color={color} roughness={0.8} />
                </mesh>
                <Html position={[0, 0.9, 0]} center style={{ pointerEvents: "none" }}><div className={`map-label ${selectedId === p.id ? "sel" : ""}`}>◍ {p.name}</div></Html>
              </group>
            </group>
          );
        })}
      </group>
    </group>
  );
}

export default function CosmosView({ entities, selectedId, onSelect, onEnterPlanet, active = true }: Props) {
  const galaxies = entities.filter(e => e.kind === "galaxy");
  const systems = entities.filter(e => e.kind === "star_system");
  const planets = entities.filter(e => e.kind === "planet");
  const gpos = new Map(galaxies.map(g => { const c = coord(g); return [g.id, new THREE.Vector3((c.x - 50) * 2.2, 0, (c.y - 50) * 2.2)]; }));
  const spos = new Map(systems.map(s => {
    const c = coord(s, "s");
    const base = s.parentId && gpos.get(s.parentId) ? gpos.get(s.parentId)! : new THREE.Vector3();
    return [s.id, base.clone().add(new THREE.Vector3((c.x - 50) * 0.35, 3, (c.y - 50) * 0.35))];
  }));
  const loose = planets.filter(p => !p.parentId || !spos.has(p.parentId));
  return (
    <Canvas className="map-canvas" frameloop={active ? "always" : "never"} dpr={[1, 1.75]} camera={{ position: [0, 70, 120], fov: 50, far: 2000 }} data-testid="cosmos-canvas">
      <color attach="background" args={["#030208"]} />
      <Stars radius={400} depth={120} count={6000} factor={6} fade speed={0.6} />
      <ambientLight intensity={0.25} />
      {galaxies.map(g => <Galaxy key={g.id} e={g} position={gpos.get(g.id)!} selected={selectedId === g.id} onSelect={() => onSelect(g.id)} />)}
      {systems.map(s => <System key={s.id} e={s} position={spos.get(s.id)!} planets={planets.filter(p => p.parentId === s.id)} selectedId={selectedId} onSelect={onSelect} onEnterPlanet={onEnterPlanet} />)}
      {loose.length > 0 && <System e={{ ...loose[0], id: "__loose", name: "Planètes sans système" } as Entity} position={new THREE.Vector3(0, 0, 0)} planets={loose} selectedId={selectedId} onSelect={onSelect} onEnterPlanet={onEnterPlanet} />}
      <OrbitControls enableDamping maxDistance={500} minDistance={4} />
    </Canvas>
  );
}
