"use client";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Html, Line, MapControls, Stars } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import * as THREE from "three";
import type { MapControls as MapControlsImpl } from "three-stdlib";
import type { Entity, EntityKind, Relation } from "@/lib/engine/types";
import { KIND_ICON, MAP_MIN_LEVEL } from "@/lib/engine/hierarchy";
import type { WorldVisualIdentity } from "@/lib/world/identity";
import { CHUNK, CHUNKS, REVEAL_RADIUS, SIZE, applyReveal, chunkGeometry, heightAt, makeRevealUniforms, resolutionFor, MAX_REVEAL, type RevealUniforms } from "./terrainMesh";

export const MAP_LEVELS = ["Monde", "Continent", "Région", "Local", "Exploration"] as const;
export function levelForDistance(d: number): number {
  if (d > 120) return 0;
  if (d > 65) return 1;
  if (d > 32) return 2;
  if (d > 14) return 3;
  return 4;
}

export type MapApi = {
  zoom: (factor: number) => void;
  reset: () => void;
  top: () => void;
  focus: (x: number, y: number, close?: boolean) => void;
};

type Props = {
  identity: WorldVisualIdentity;
  entities: Entity[];
  relations: Relation[];
  blank: boolean;
  selectedId: string | null;
  placing: EntityKind | null;
  showLabels: boolean;
  showTerritories: boolean;
  showRelations: boolean;
  apiRef: MutableRefObject<MapApi | null>;
  onSelect: (id: string | null) => void;
  onPlace: (x: number, y: number) => void;
  onLevel: (level: number) => void;
};

const CIV_COLORS = ["#a568ff", "#ff7a59", "#3ddc97", "#4fb3ff", "#f5b544", "#ff5d9e", "#7cf0e0", "#d0ff5c"];
function civColor(e: Entity, i: number) { return typeof e.data.color === "string" ? (e.data.color as string) : CIV_COLORS[i % CIV_COLORS.length]; }
const ended = (e: Entity) => e.status === "dead" || e.status === "destroyed" || e.status === "dissolved";

/* -------------------------------------------------------------- terrain */
function Terrain({ identity, uniforms, onPick, onHover }: { identity: WorldVisualIdentity; uniforms: RevealUniforms; onPick: (p: THREE.Vector3, delta: number) => void; onHover: (p: THREE.Vector3 | null) => void }) {
  const { camera } = useThree();
  const [levels, setLevels] = useState<number[]>(() => Array(CHUNKS * CHUNKS).fill(16));
  const last = useRef(0);
  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0.02, side: THREE.DoubleSide, flatShading: false });
    applyReveal(m, uniforms, true);
    return m;
  }, [uniforms]);
  useFrame(({ clock }) => {
    if (clock.elapsedTime - last.current < 0.3) return;
    last.current = clock.elapsedTime;
    const next = levels.map((_, i) => {
      const cx = i % CHUNKS, cy = Math.floor(i / CHUNKS);
      const center = new THREE.Vector3((cx + 0.5) * CHUNK, 2, (cy + 0.5) * CHUNK);
      return resolutionFor(camera.position.distanceTo(center));
    });
    if (next.some((v, i) => v !== levels[i])) setLevels(next);
  });
  return (
    <group
      onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onPick(e.point, e.delta); }}
      onPointerMove={(e: ThreeEvent<PointerEvent>) => onHover(e.point)}
      onPointerOut={() => onHover(null)}
    >
      {levels.map((res, i) => {
        const cx = i % CHUNKS, cy = Math.floor(i / CHUNKS);
        return <mesh key={`${i}:${res}`} geometry={chunkGeometry(identity, cx, cy, res)} material={material} receiveShadow />;
      })}
    </group>
  );
}

function Water({ identity, uniforms }: { identity: WorldVisualIdentity; uniforms: RevealUniforms }) {
  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color: identity.palette.shallow, transparent: true, opacity: 0.72, roughness: 0.25, metalness: 0.1 });
    applyReveal(m, uniforms, false);
    return m;
  }, [identity.palette.shallow, uniforms]);
  return <mesh rotation-x={-Math.PI / 2} position={[SIZE / 2, 0.02, SIZE / 2]} material={material}><planeGeometry args={[1400, 1400]} /></mesh>;
}

/* -------------------------------------------------------------- markers */
function MarkerShape({ e, color }: { e: Entity; color: string }) {
  const grey = ended(e) ? "#6f6876" : null;
  const c = grey ?? color;
  const pop = typeof e.data.population === "number" ? (e.data.population as number) : e.kind === "city" ? 8000 : 400;
  switch (e.kind) {
    case "city": {
      const s = ended(e) ? 0.5 : Math.min(2.2, 0.7 + Math.log10(Math.max(pop, 100)) / 4);
      return (
        <group scale={s}>
          <mesh position={[0, 0.5, 0]}><boxGeometry args={[1.2, 1, 1.2]} /><meshStandardMaterial color={grey ?? "#d8cbe8"} /></mesh>
          <mesh position={[0.45, 1.2, 0.2]}><cylinderGeometry args={[0.22, 0.26, 1.6, 8]} /><meshStandardMaterial color={grey ?? "#bfb0d4"} /></mesh>
          <mesh position={[0.45, 2.15, 0.2]}><coneGeometry args={[0.32, 0.5, 8]} /><meshStandardMaterial color={c} emissive={c} emissiveIntensity={grey ? 0 : 0.35} /></mesh>
          <mesh position={[-0.4, 0.9, -0.3]}><boxGeometry args={[0.6, 0.8, 0.6]} /><meshStandardMaterial color={grey ?? "#c8b9dc"} /></mesh>
        </group>
      );
    }
    case "village": {
      const s = ended(e) ? 0.4 : Math.min(1.4, 0.55 + Math.log10(Math.max(pop, 30)) / 6);
      return (
        <group scale={s}>
          {[[-0.5, 0], [0.5, 0.2], [0, -0.55]].map(([x, z], i) => (
            <group key={i} position={[x, 0, z]}>
              <mesh position={[0, 0.25, 0]}><boxGeometry args={[0.5, 0.5, 0.5]} /><meshStandardMaterial color={grey ?? "#b08a6a"} /></mesh>
              <mesh position={[0, 0.65, 0]} rotation-y={Math.PI / 4}><coneGeometry args={[0.45, 0.4, 4]} /><meshStandardMaterial color={grey ?? "#7a4b37"} /></mesh>
            </group>
          ))}
        </group>
      );
    }
    case "civilization":
      return (
        <group>
          <mesh position={[0, 1.4, 0]}><cylinderGeometry args={[0.05, 0.05, 2.8, 6]} /><meshStandardMaterial color="#d6cde0" /></mesh>
          <mesh position={[0.45, 2.4, 0]}><boxGeometry args={[0.9, 0.55, 0.04]} /><meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.5} /></mesh>
        </group>
      );
    case "resource":
      return <mesh position={[0, 0.7, 0]}><octahedronGeometry args={[0.45]} /><meshStandardMaterial color={e.data.depleted ? "#555" : c} emissive={e.data.depleted ? "#000" : c} emissiveIntensity={0.6} /></mesh>;
    case "character": case "npc": case "deity":
      return (
        <group scale={e.kind === "npc" ? 0.7 : 1}>
          <mesh position={[0, 0.45, 0]}><coneGeometry args={[0.28, 0.9, 10]} /><meshStandardMaterial color={c} /></mesh>
          <mesh position={[0, 1.02, 0]}><sphereGeometry args={[0.2, 12, 12]} /><meshStandardMaterial color={grey ?? "#f1d8c4"} emissive={e.kind === "deity" ? "#fff2b0" : "#000"} emissiveIntensity={e.kind === "deity" ? 0.8 : 0} /></mesh>
        </group>
      );
    case "creature": case "animal":
      return <mesh position={[0, 0.5, 0]}><tetrahedronGeometry args={[0.5]} /><meshStandardMaterial color={c} /></mesh>;
    case "quest": case "item":
      return <mesh position={[0, 1.2, 0]}><icosahedronGeometry args={[0.32]} /><meshStandardMaterial color="#fff2b0" emissive="#f5b544" emissiveIntensity={0.9} /></mesh>;
    case "place":
      return <mesh position={[0, 0.6, 0]}><cylinderGeometry args={[0.1, 0.25, 1.2, 4]} /><meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.3} /></mesh>;
    default:
      return <mesh position={[0, 0.3, 0]}><sphereGeometry args={[0.25, 10, 10]} /><meshStandardMaterial color={c} /></mesh>;
  }
}

function Ring({ identity, x, y, r, color, dashed, width = 2 }: { identity: WorldVisualIdentity; x: number; y: number; r: number; color: string; dashed?: boolean; width?: number }) {
  const pts = useMemo(() => {
    const out: [number, number, number][] = [];
    for (let i = 0; i <= 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      out.push([px, heightAt(identity, px, py) + 0.35, py]);
    }
    return out;
  }, [identity, x, y, r]);
  return <Line points={pts} color={color} lineWidth={width} dashed={dashed} dashSize={1.2} gapSize={0.8} transparent opacity={0.9} />;
}

function Arc({ a, b, color }: { a: THREE.Vector3; b: THREE.Vector3; color: string }) {
  const pts = useMemo(() => {
    const mid = a.clone().add(b).multiplyScalar(0.5);
    mid.y += a.distanceTo(b) * 0.35 + 2;
    return new THREE.QuadraticBezierCurve3(a, mid, b).getPoints(32).map(p => [p.x, p.y, p.z] as [number, number, number]);
  }, [a, b]);
  return <Line points={pts} color={color} lineWidth={1.6} dashed dashSize={0.8} gapSize={0.6} />;
}

/* ------------------------------------------------------------ controls */
function CameraRig({ apiRef, controls, onLevel }: { apiRef: MutableRefObject<MapApi | null>; controls: MutableRefObject<MapControlsImpl | null>; onLevel: (l: number) => void }) {
  const { camera } = useThree();
  const anim = useRef<{ pos: THREE.Vector3; target: THREE.Vector3; t: number } | null>(null);
  const lastLevel = useRef(-1);
  useEffect(() => {
    const fly = (pos: THREE.Vector3, target: THREE.Vector3) => { anim.current = { pos, target, t: 0 }; };
    apiRef.current = {
      zoom: f => {
        const c = controls.current; if (!c) return;
        const dir = camera.position.clone().sub(c.target).multiplyScalar(f);
        if (dir.length() < 3 || dir.length() > 230) return;
        fly(c.target.clone().add(dir), c.target.clone());
      },
      reset: () => fly(new THREE.Vector3(50, 95, 140), new THREE.Vector3(50, 0, 50)),
      top: () => { const c = controls.current; if (c) fly(new THREE.Vector3(c.target.x, Math.max(40, camera.position.distanceTo(c.target)), c.target.z + 0.01), c.target.clone()); },
      focus: (x, y, close = true) => { const d = close ? 18 : 45; fly(new THREE.Vector3(x, d * 0.9, y + d * 0.75), new THREE.Vector3(x, 0, y)); }
    };
  }, [apiRef, camera, controls]);
  useFrame((_, dt) => {
    const c = controls.current;
    if (anim.current && c) {
      const a = anim.current;
      a.t = Math.min(1, a.t + dt * 1.8);
      const k = 1 - Math.pow(1 - a.t, 3);
      camera.position.lerp(a.pos, k * 0.25 + 0.05);
      c.target.lerp(a.target, k * 0.25 + 0.05);
      c.update();
      if (a.t >= 1 && camera.position.distanceTo(a.pos) < 0.05) anim.current = null;
    }
    if (c) {
      const l = levelForDistance(camera.position.distanceTo(c.target));
      if (l !== lastLevel.current) { lastLevel.current = l; onLevel(l); }
    }
  });
  return null;
}

/* ------------------------------------------------------------------ scene */
function Scene(p: Props) {
  const { identity, entities, relations, blank, selectedId, placing } = p;
  const controls = useRef<MapControlsImpl | null>(null);
  const uniforms = useMemo(() => makeRevealUniforms(), []);
  const [hover, setHover] = useState<THREE.Vector3 | null>(null);
  const [level, setLevel] = useState(0);
  const [cam, setCam] = useState(new THREE.Vector3(50, 95, 140));
  const placed = useMemo(() => entities.filter(e => e.x != null && e.y != null && e.status !== "archived"), [entities]);
  const civIndex = useMemo(() => new Map(placed.filter(e => e.kind === "civilization").map((e, i) => [e.id, i])), [placed]);
  const pos = useMemo(() => new Map(placed.map(e => [e.id, new THREE.Vector3(e.x!, heightAt(identity, e.x!, e.y!), e.y!)])), [placed, identity]);

  // Reveal targets; radii grow smoothly when something new is created.
  const reveal = useRef(new Map<string, { x: number; y: number; r: number; target: number }>());
  useEffect(() => {
    const m = reveal.current;
    const seen = new Set<string>();
    for (const e of placed) {
      const target = typeof e.data.radius === "number" ? Math.max(e.data.radius as number, REVEAL_RADIUS[e.kind] ?? 2) * 1.15 : REVEAL_RADIUS[e.kind] ?? 2;
      seen.add(e.id);
      const cur = m.get(e.id);
      if (cur) Object.assign(cur, { x: e.x!, y: e.y!, target });
      else m.set(e.id, { x: e.x!, y: e.y!, r: 0, target });
    }
    for (const k of [...m.keys()]) if (!seen.has(k)) m.delete(k);
    uniforms.uFull.value = blank ? 0 : 1;
  }, [placed, blank, uniforms]);
  useFrame(({ camera }, dt) => {
    if (blank) {
      const list = [...reveal.current.values()].sort((a, b) => b.target - a.target).slice(0, MAX_REVEAL);
      list.forEach((v, i) => { v.r += (v.target - v.r) * Math.min(1, dt * 2.2); uniforms.uPts.value[i].set(v.x, v.y, v.r); });
      uniforms.uCount.value = list.length;
    }
    if (camera.position.distanceTo(cam) > 2) setCam(camera.position.clone());
  });

  const visible = useMemo(() => {
    const ranked = placed
      .filter(e => e.id === selectedId || (MAP_MIN_LEVEL[e.kind] ?? 2) <= level + 1)
      .map(e => ({ e, d: pos.get(e.id)!.distanceTo(cam) }))
      .sort((a, b) => Number(b.e.id === selectedId) - Number(a.e.id === selectedId) || b.e.importance - a.e.importance || a.d - b.d);
    return ranked.slice(0, 160);
  }, [placed, level, cam, pos, selectedId]);
  const labelled = new Set(visible.slice(0, 28).map(v => v.e.id));

  return (
    <>
      <color attach="background" args={["#07040d"]} />
      <fog attach="fog" args={["#0b0816", 160, 420]} />
      <Stars radius={260} depth={60} count={2500} factor={5} fade speed={0.4} />
      <hemisphereLight args={["#dfe7ff", "#2a1d3a", 0.75]} />
      <directionalLight position={[-60, 90, -20]} intensity={1.6} color="#fff4e6" />
      <directionalLight position={[80, 40, 120]} intensity={0.35} color="#a568ff" />
      <Terrain identity={identity} uniforms={uniforms}
        onPick={(pt, delta) => { if (delta > 6) return; if (placing) p.onPlace(Math.max(0, Math.min(100, pt.x)), Math.max(0, Math.min(100, pt.z))); else p.onSelect(null); }}
        onHover={pt => placing ? setHover(pt) : hover && setHover(null)} />
      <Water identity={identity} uniforms={uniforms} />

      {placing && hover && (
        <mesh position={[hover.x, hover.y + 0.8, hover.z]}><coneGeometry args={[0.5, 1.6, 12]} /><meshStandardMaterial color="#a568ff" emissive="#a568ff" emissiveIntensity={0.8} transparent opacity={0.75} /></mesh>
      )}

      {p.showTerritories && placed.map(e => {
        if (e.kind === "civilization" && !ended(e)) return <Ring key={`t${e.id}`} identity={identity} x={e.x!} y={e.y!} r={typeof e.data.territoryRadius === "number" ? (e.data.territoryRadius as number) : 8} color={civColor(e, civIndex.get(e.id) ?? 0)} width={2.4} />;
        if (e.kind === "continent" || e.kind === "country" || e.kind === "region") return <Ring key={`t${e.id}`} identity={identity} x={e.x!} y={e.y!} r={typeof e.data.radius === "number" ? (e.data.radius as number) : e.kind === "continent" ? 28 : e.kind === "country" ? 16 : 10} color={e.kind === "region" ? "#ffffff88" : "#f3ecff"} dashed width={e.kind === "region" ? 1 : 1.6} />;
        return null;
      })}

      {p.showRelations && relations.filter(r => r.untilTick == null && (r.type === "war" || r.type === "ally" || r.type === "trade")).map(r => {
        const a = pos.get(r.sourceId), b = pos.get(r.targetId);
        if (!a || !b) return null;
        return <Arc key={r.id} a={a.clone().setY(a.y + 2.5)} b={b.clone().setY(b.y + 2.5)} color={r.type === "war" ? "#ff5d7a" : r.type === "ally" ? "#3ddc97" : "#f5b544"} />;
      })}

      {visible.map(({ e }) => {
        const v = pos.get(e.id)!;
        const color = e.kind === "civilization" ? civColor(e, civIndex.get(e.id) ?? 0) : e.kind === "resource" ? "#7cf0e0" : e.kind === "creature" ? "#ff7a59" : e.kind === "animal" ? "#c9a37a" : "#a568ff";
        const big = e.kind === "continent" || e.kind === "country";
        const sel = e.id === selectedId;
        return (
          <group key={e.id} position={v} onClick={ev => { ev.stopPropagation(); if (!placing) p.onSelect(e.id); }}
            onPointerOver={() => { document.body.style.cursor = "pointer"; }} onPointerOut={() => { document.body.style.cursor = ""; }}>
            {!big && e.kind !== "region" && <MarkerShape e={e} color={color} />}
            {sel && <mesh rotation-x={-Math.PI / 2} position={[0, 0.15, 0]}><ringGeometry args={[1.1, 1.4, 32]} /><meshBasicMaterial color="#a568ff" transparent opacity={0.9} /></mesh>}
            {p.showLabels && (labelled.has(e.id) || sel) && (
              <Html position={[0, big ? 4 : e.kind === "city" ? 3.4 : 2.2, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
                <div className={`map-label ${big ? "big" : ""} ${sel ? "sel" : ""} ${ended(e) ? "dead" : ""}`}>{big ? e.name.toUpperCase() : `${KIND_ICON[e.kind]} ${e.name}`}</div>
              </Html>
            )}
          </group>
        );
      })}

      <MapControls ref={controls} makeDefault target={[50, 0, 50]} enableDamping dampingFactor={0.12} minDistance={3} maxDistance={230} maxPolarAngle={1.38} screenSpacePanning={false} />
      <CameraRig apiRef={p.apiRef} controls={controls} onLevel={l => { setLevel(l); p.onLevel(l); }} />
    </>
  );
}

export function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch { return false; }
}

export default function WorldMap3D(props: Props & { active?: boolean }) {
  return (
    <Canvas className="map-canvas" frameloop={props.active === false ? "never" : "always"} dpr={[1, 1.75]} camera={{ position: [50, 95, 140], fov: 45, near: 0.3, far: 900 }} gl={{ antialias: true, powerPreference: "high-performance" }} data-testid="map-canvas">
      <Scene {...props} />
    </Canvas>
  );
}
