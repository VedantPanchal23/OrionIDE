import { Suspense, useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Float, MeshDistortMaterial, Sphere } from '@react-three/drei';

function Orb({ color = '#d4a84b', position = [0, 0, 0], scale = 1.2 }) {
  return (
    <Float speed={1.4} rotationIntensity={0.6} floatIntensity={1.2}>
      <Sphere args={[1, 64, 64]} position={position} scale={scale}>
        <MeshDistortMaterial
          color={color}
          attach="material"
          distort={0.35}
          speed={2}
          roughness={0.25}
          metalness={0.55}
        />
      </Sphere>
    </Float>
  );
}

function Scene({ variant = 'login' }) {
  const lights = useMemo(() => (
    <>
      <ambientLight intensity={0.35} />
      <directionalLight position={[4, 6, 2]} intensity={1.1} color="#fff2d6" />
      <pointLight position={[-4, -2, -2]} intensity={0.6} color="#7aa2c8" />
    </>
  ), []);

  if (variant === 'workspace') {
    return (
      <>
        {lights}
        <Orb color="#d4a84b" position={[-2.8, 1.2, -4]} scale={0.55} />
        <Orb color="#3d3f4a" position={[3.2, -1.4, -5]} scale={0.9} />
        <Orb color="#a87a20" position={[0.5, 2.2, -6]} scale={0.35} />
      </>
    );
  }

  return (
    <>
      {lights}
      <Orb color="#d4a84b" position={[1.2, 0.2, 0]} scale={1.45} />
      <Orb color="#2a2d3a" position={[-1.8, -0.6, -1.5]} scale={1.1} />
      <Orb color="#7aa2c8" position={[0.2, 1.6, -2]} scale={0.4} />
    </>
  );
}

export default function OrionScene({ variant = 'login', className }) {
  const reduced = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  const [visible, setVisible] = useState(
    typeof document === 'undefined' ? true : !document.hidden,
  );

  useEffect(() => {
    const onVis = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  if (reduced) return null;

  return (
    <div className={className} aria-hidden>
      <Suspense fallback={null}>
        <Canvas
          dpr={[1, 1.5]}
          camera={{ position: [0, 0, 5], fov: 45 }}
          frameloop={visible ? 'always' : 'never'}
          gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
          style={{ width: '100%', height: '100%' }}
          onCreated={({ gl }) => {
            gl.setClearColor(0x000000, 0);
          }}
        >
          <Scene variant={variant} />
        </Canvas>
      </Suspense>
    </div>
  );
}
