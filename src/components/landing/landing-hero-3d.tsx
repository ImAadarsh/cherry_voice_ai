"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import * as THREE from "three";

function HeroGradientFallback() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-cherry-50/80 via-background/40 to-background dark:from-cherry-950/30 dark:via-background/60" />
      <div className="absolute right-[10%] top-[20%] h-32 w-32 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute left-[15%] top-[30%] h-24 w-24 rounded-full bg-teal-500/10 blur-2xl" />
      <div className="absolute left-1/2 top-[35%] h-40 w-40 -translate-x-1/2 rounded-full bg-cherry-500/5 blur-3xl" />
    </div>
  );
}

function PulsingRings() {
  const ring1 = useRef<THREE.Mesh>(null);
  const ring2 = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (ring1.current) {
      const scale = 1 + Math.sin(t * 1.8) * 0.08;
      ring1.current.scale.setScalar(scale);
      (ring1.current.material as THREE.MeshBasicMaterial).opacity =
        0.35 + Math.sin(t * 1.8) * 0.15;
    }
    if (ring2.current) {
      const scale = 1.15 + Math.sin(t * 1.8 + 0.6) * 0.1;
      ring2.current.scale.setScalar(scale);
      (ring2.current.material as THREE.MeshBasicMaterial).opacity =
        0.2 + Math.sin(t * 1.8 + 0.6) * 0.12;
    }
  });

  return (
    <group>
      <mesh ref={ring1} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.35, 0.02, 16, 64]} />
        <meshBasicMaterial color="#dc2626" transparent opacity={0.35} />
      </mesh>
      <mesh ref={ring2} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.65, 0.015, 16, 64]} />
        <meshBasicMaterial color="#14b8a6" transparent opacity={0.25} />
      </mesh>
    </group>
  );
}

function FloatingPhone() {
  const group = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (group.current) {
      group.current.rotation.y = Math.sin(clock.getElapsedTime() * 0.4) * 0.25;
      group.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.3) * 0.08;
    }
  });

  return (
    <group ref={group}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.72, 1.4, 0.1]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0, 0.051]}>
        <planeGeometry args={[0.62, 1.2]} />
        <meshStandardMaterial
          color="#dc2626"
          emissive="#dc2626"
          emissiveIntensity={0.15}
          metalness={0.2}
          roughness={0.4}
        />
      </mesh>
      <mesh position={[0, -0.52, 0.055]}>
        <circleGeometry args={[0.06, 24]} />
        <meshStandardMaterial color="#333" metalness={0.8} roughness={0.2} />
      </mesh>
      <PulsingRings />
    </group>
  );
}

function OrbitingItems() {
  const items = useMemo(
    () => [
      { color: "#f87171", radius: 2.4, speed: 0.55, offset: 0 },
      { color: "#14b8a6", radius: 2.8, speed: 0.42, offset: 1.2 },
      { color: "#fbbf24", radius: 2.2, speed: 0.65, offset: 2.4 },
      { color: "#a78bfa", radius: 3.0, speed: 0.38, offset: 3.6 },
    ],
    [],
  );

  return (
    <>
      {items.map((item, i) => (
        <Orbiter key={i} {...item} />
      ))}
    </>
  );
}

function Orbiter({
  color,
  radius,
  speed,
  offset,
}: {
  color: string;
  radius: number;
  speed: number;
  offset: number;
}) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime() * speed + offset;
    ref.current.position.x = Math.cos(t) * radius;
    ref.current.position.z = Math.sin(t) * radius;
    ref.current.position.y = Math.sin(t * 2) * 0.25;
    ref.current.rotation.x += 0.01;
    ref.current.rotation.y += 0.015;
  });

  return (
    <Float speed={1.5} rotationIntensity={0.4} floatIntensity={0.6}>
      <mesh ref={ref}>
        <icosahedronGeometry args={[0.18, 0]} />
        <meshStandardMaterial color={color} metalness={0.3} roughness={0.5} />
      </mesh>
    </Float>
  );
}

function SteamParticles() {
  const count = 40;
  const ref = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 1.2;
      arr[i * 3 + 1] = Math.random() * 1.5 - 0.5;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 0.8;
    }
    return arr;
  }, []);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const pos = ref.current.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 1] += 0.008;
      if (pos[i * 3 + 1] > 1.8) {
        pos[i * 3 + 1] = -0.5;
        pos[i * 3] = (Math.random() - 0.5) * 1.2;
      }
      pos[i * 3] += Math.sin(clock.getElapsedTime() + i) * 0.001;
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#ffffff"
        size={0.04}
        transparent
        opacity={0.35}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[4, 6, 4]} intensity={1.2} />
      <directionalLight position={[-4, 2, -2]} intensity={0.4} color="#14b8a6" />
      <pointLight position={[0, 2, 2]} intensity={0.6} color="#dc2626" />
      <Float speed={1.2} rotationIntensity={0.2} floatIntensity={0.5}>
        <FloatingPhone />
      </Float>
      <OrbitingItems />
      <SteamParticles />
    </>
  );
}

export function LandingHero3D() {
  const [canRender, setCanRender] = useState(false);

  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 768px)").matches;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let webgl = false;
    try {
      const canvas = document.createElement("canvas");
      webgl = !!(canvas.getContext("webgl") || canvas.getContext("webgl2"));
    } catch {
      webgl = false;
    }
    setCanRender(!mobile && !prefersReduced && webgl);
  }, []);

  if (!canRender) return <HeroGradientFallback />;

  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute inset-0 bg-gradient-to-b from-cherry-50/40 via-transparent to-background dark:from-cherry-950/20" />
      <Canvas
        className="!absolute inset-0"
        camera={{ position: [0, 0.2, 5.5], fov: 42 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
      >
        <Scene />
      </Canvas>
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/20 to-background" />
    </div>
  );
}
