import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { PhysicsEngine } from './services/physicsEngine';
import { BodyVisual, StarField } from './components/Visuals';
import { Controls } from './components/Controls';
import { PRESETS, DEFAULT_TIME_STEP, G_CONST, generateRandomScenario } from './constants';
import { BodyState, SimulationStats, PresetName } from './types';
import * as THREE from 'three';

// Controller factory: keeps the Rosette Hexa-Ring approximately circular, equal-angle and co-rotating
function makeRosetteController(initialBodies: BodyState[]) {
  // Identify petal indices by name prefix
  const petalIdx = initialBodies
    .map((b, i) => ({ b, i }))
    .filter(x => x.b.name.startsWith('Petal'))
    .map(x => x.i);

  // Target radius r* as mass-weighted average of initial radii
  const rStar = (() => {
    let mSum = 0, mrSum = 0;
    for (const i of petalIdx) {
      const b = initialBodies[i];
      const r = Math.hypot(b.position.x, b.position.y, b.position.z);
      mrSum += b.mass * r;
      mSum += b.mass;
    }
    return mSum > 0 ? mrSum / mSum : 12; // fallback to preset radius
  })();

  // Target angular speed ω* from initial tangential velocity / radius (mass-weighted)
  const omegaStar = (() => {
    let mSum = 0, sum = 0;
    for (const i of petalIdx) {
      const b = initialBodies[i];
      const r = Math.hypot(b.position.x, b.position.y) || 1e-6;
      const theta = Math.atan2(b.position.y, b.position.x);
      const vt = (-b.velocity.x * Math.sin(theta) + b.velocity.y * Math.cos(theta));
      sum += b.mass * (vt / r);
      mSum += b.mass;
    }
    return mSum > 0 ? sum / mSum : 0;
  })();

  // Gains and thrust cap (tunable)
  const k_r = 0.08;
  const k_dr = 0.18;
  const k_t = 0.12;
  const k_dt = 0.08;
  const k_c = 0.02;
  const a_max = 0.04;

  return (state: BodyState[], t: number) => {
    const n = state.length;
    const acc = Array.from({ length: n }, () => ({ x: 0, y: 0, z: 0 }));
    if (petalIdx.length === 0) return acc;

    // Mass-weighted centroid and centroid velocity of the ring
    let mSum = 0, cx = 0, cy = 0, cz = 0, cvx = 0, cvy = 0, cvz = 0;
    for (const i of petalIdx) {
      const b = state[i];
      mSum += b.mass;
      cx += b.mass * b.position.x;
      cy += b.mass * b.position.y;
      cz += b.mass * b.position.z;
      cvx += b.mass * b.velocity.x;
      cvy += b.mass * b.velocity.y;
      cvz += b.mass * b.velocity.z;
    }
    if (mSum <= 0) return acc;
    cx /= mSum; cy /= mSum; cz /= mSum;
    cvx /= mSum; cvy /= mSum; cvz /= mSum;

    // Estimate current normal (total angular momentum direction)
    let Lx = 0, Ly = 0, Lz = 0;
    for (const i of petalIdx) {
      const b = state[i];
      const rx = b.position.x - cx, ry = b.position.y - cy, rz = b.position.z - cz;
      const vx = b.velocity.x - cvx, vy = b.velocity.y - cvy, vz = b.velocity.z - cvz;
      Lx += (ry * vz - rz * vy) * b.mass;
      Ly += (rz * vx - rx * vz) * b.mass;
      Lz += (rx * vy - ry * vx) * b.mass;
    }
    const Ln = Math.hypot(Lx, Ly, Lz) || 1;
    const nx = Lx / Ln, ny = Ly / Ln, nz = Lz / Ln;

    for (const i of petalIdx) {
      const b = state[i];
      const rx = b.position.x - cx, ry = b.position.y - cy, rz = b.position.z - cz;
      const vx = b.velocity.x - cvx, vy = b.velocity.y - cvy, vz = b.velocity.z - cvz;

      const r = Math.hypot(rx, ry, rz) || 1e-9;
      const r_hat = { x: rx / r, y: ry / r, z: rz / r };

      // t_hat = n × r_hat
      const tx0 = ny * r_hat.z - nz * r_hat.y;
      const ty0 = nz * r_hat.x - nx * r_hat.z;
      const tz0 = nx * r_hat.y - ny * r_hat.x;
      const t_norm = Math.hypot(tx0, ty0, tz0) || 1e-9;
      const t_hat = { x: tx0 / t_norm, y: ty0 / t_norm, z: tz0 / t_norm };

      const vr = vx * r_hat.x + vy * r_hat.y + vz * r_hat.z;
      const vt = vx * t_hat.x + vy * t_hat.y + vz * t_hat.z;

      const a_r = -k_r * (r - rStar) - k_dr * vr;
      const a_t = -k_t * (vt - omegaStar * r) - k_dt * vt;

      let ax = a_r * r_hat.x + a_t * t_hat.x - k_c * vx;
      let ay = a_r * r_hat.y + a_t * t_hat.y - k_c * vy;
      let az = a_r * r_hat.z + a_t * t_hat.z - k_c * vz;

      const aN = Math.hypot(ax, ay, az);
      if (aN > a_max) {
        const s = a_max / aN;
        ax *= s; ay *= s; az *= s;
      }

      acc[i].x = ax; acc[i].y = ay; acc[i].z = az;
    }

    return acc;
  };
}

// Inner component to handle the animation loop within Canvas context
const SimulationLoop = ({
  physicsRef,
  bodiesRef,
  statsCacheRef,
  setStats,
  isRunning,
  speed
}: {
  physicsRef: React.MutableRefObject<PhysicsEngine | null>,
  bodiesRef: React.MutableRefObject<BodyState[]>,
  statsCacheRef: React.MutableRefObject<ReturnType<PhysicsEngine['getStats']> | null>,
  setStats: (s: SimulationStats) => void,
  isRunning: boolean,
  speed: number
}) => {
  const frameCount = useRef(0);

  useFrame((state, delta) => {
    if (!isRunning || !physicsRef.current) return;

    // Run multiple physics steps per frame for stability at higher speeds
    // Maximum time per frame to avoid "spiral of death" is usually capped
    const steps = Math.ceil(speed * 2); 
    const dt = (DEFAULT_TIME_STEP * speed) / steps;

    for (let i = 0; i < steps; i++) {
      physicsRef.current.step(dt);
    }

    // Sync visualization ref with physics state
    bodiesRef.current = [...physicsRef.current.bodies];

    // Update UI stats less frequently (every 20 frames) to save React cycles
    frameCount.current++;
    if (frameCount.current % 20 === 0 && physicsRef.current) {
        const rawStats = statsCacheRef.current || physicsRef.current.getStats();
        statsCacheRef.current = rawStats;

        setStats({
            ...rawStats,
            era: rawStats.habitable ? 'Stable' : 'Chaotic', // Simplified logic
            timeElapsed: state.clock.elapsedTime,
            fps: delta > 0 ? 1 / delta : 0
        });
    }
  });

  return null;
};

// Component to handle camera reset
const CameraController = ({
  bodiesRef,
  resetCameraKey
}: {
  bodiesRef: React.MutableRefObject<BodyState[]>,
  resetCameraKey: number
}) => {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    if (resetCameraKey === 0) return; // Skip initial mount

    const bodies = bodiesRef.current;
    if (bodies.length === 0) return;

    // Calculate bounding box of all bodies
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    bodies.forEach(body => {
      minX = Math.min(minX, body.position.x - body.radius);
      maxX = Math.max(maxX, body.position.x + body.radius);
      minY = Math.min(minY, body.position.y - body.radius);
      maxY = Math.max(maxY, body.position.y + body.radius);
      minZ = Math.min(minZ, body.position.z - body.radius);
      maxZ = Math.max(maxZ, body.position.z + body.radius);
    });

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const centerZ = (minZ + maxZ) / 2;

    const sizeX = maxX - minX;
    const sizeY = maxY - minY;
    const sizeZ = maxZ - minZ;
    const maxSize = Math.max(sizeX, sizeY, sizeZ);

    // Calculate distance to fit all bodies in view
    // Using FOV = 45 degrees
    const distance = maxSize / (2 * Math.tan((45 * Math.PI) / (2 * 180))) + maxSize * 0.5;

    // Position camera at an angle to see all bodies
    const angle = Math.PI / 4; // 45 degrees
    const cameraX = centerX + distance * Math.cos(angle);
    const cameraY = centerY + distance * 0.6;
    const cameraZ = centerZ + distance * Math.sin(angle);

    // Animate camera to new position
    const startPos = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
    const endPos = { x: cameraX, y: cameraY, z: cameraZ };
    const duration = 0.8; // seconds
    let elapsed = 0;

    const animateCamera = () => {
      elapsed += 0.016; // ~60fps
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function (ease-in-out)
      const easeProgress = progress < 0.5 
        ? 2 * progress * progress 
        : -1 + (4 - 2 * progress) * progress;

      camera.position.x = startPos.x + (endPos.x - startPos.x) * easeProgress;
      camera.position.y = startPos.y + (endPos.y - startPos.y) * easeProgress;
      camera.position.z = startPos.z + (endPos.z - startPos.z) * easeProgress;

      if (progress < 1) {
        requestAnimationFrame(animateCamera);
      } else {
        // Ensure final position is exact
        camera.position.set(endPos.x, endPos.y, endPos.z);
      }
    };

    animateCamera();

    // Update orbit controls target
    if (controlsRef.current) {
      controlsRef.current.target.set(centerX, centerY, centerZ);
      controlsRef.current.update();
    }
  }, [resetCameraKey, camera, bodiesRef]);

  return (
    <OrbitControls 
      ref={controlsRef}
      enablePan={true} 
      enableZoom={true} 
      enableRotate={true}
      minDistance={5}
      maxDistance={200}
    />
  );
};

export default function App() {
  const [currentPreset, setCurrentPreset] = useState<PresetName>('Figure8');
  const [isRunning, setIsRunning] = useState(true);
  const [simulationSpeed, setSimulationSpeed] = useState(1.0);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [resetKey, setResetKey] = useState(0); // Key to force remount and clear trails
  const [resetCameraKey, setResetCameraKey] = useState(0); // Key to trigger camera reset
  
  const [stats, setStats] = useState<SimulationStats>({
    totalEnergy: 0,
    kineticEnergy: 0,
    potentialEnergy: 0,
    habitable: false,
    era: 'Stable',
    timeElapsed: 0,
    fps: 0
  });

  // We use Refs for the heavy lifting (physics state) to avoid React re-renders on every frame
  const bodiesRef = useRef<BodyState[]>([]);
  const physicsRef = useRef<PhysicsEngine | null>(null);
  const energyStatsRef = useRef<ReturnType<PhysicsEngine['getStats']> | null>(null);

  // Initialize simulation
  const initSimulation = useCallback((presetName: PresetName) => {
    let initialBodies: BodyState[];

    if (presetName === 'Random') {
        // Dynamically generate new random bodies each time
        initialBodies = generateRandomScenario();
    } else {
        const preset = PRESETS.find(p => p.name === presetName) || PRESETS[0];
        initialBodies = JSON.parse(JSON.stringify(preset.bodies)); // Deep copy
    }
    
    bodiesRef.current = initialBodies;
    const controller = presetName === 'Rosette' ? makeRosetteController(initialBodies) : undefined;
    physicsRef.current = new PhysicsEngine(initialBodies, {
      G: G_CONST,
      timeStep: DEFAULT_TIME_STEP,
      softening: 0.08,
      energySampleInterval: 1,
      controller
    });
    setCurrentPreset(presetName);
    
    // Increment resetKey to force remount of BodyVisual components and clear trails
    setResetKey(prev => prev + 1);

    // Reset camera to fit the new scenario
    setResetCameraKey(prev => prev + 1);

    // Reset stats
    if (physicsRef.current) {
        physicsRef.current.setStatsCallback((s) => {
          energyStatsRef.current = s;
        });

        const s = physicsRef.current.getStats();
        energyStatsRef.current = s;
        setStats({ ...s, era: 'Stable', timeElapsed: 0, fps: 60 });
    }
  }, []);

  // Init on mount
  useEffect(() => {
    initSimulation('Figure8');
  }, [initSimulation]);

  // Calculate trail length based on speed to avoid clutter
  const getTrailLength = (speed: number) => {
      if (speed > 8) return 60;
      if (speed > 5) return 80;
      if (speed > 2) return 120;
      return 200;
  };

  // Handle camera reset
  const handleResetCamera = useCallback(() => {
    setResetCameraKey(prev => prev + 1);
  }, []);

  const bgColor = theme === 'dark' ? '#050505' : '#ffffff';

  return (
    <div className={`w-full h-screen relative overflow-hidden transition-colors duration-500 ${theme === 'dark' ? 'bg-black text-white' : 'bg-white text-black'}`}>
      <Canvas shadows dpr={[1, 2]} gl={{ antialias: true }}>
        <PerspectiveCamera makeDefault position={[0, 0, 40]} fov={45} />
        <color attach="background" args={[bgColor]} />
        
        <ambientLight intensity={theme === 'dark' ? 0.1 : 0.8} />
        {theme === 'light' && <directionalLight position={[10, 10, 5]} intensity={0.5} castShadow />}
        
        <SimulationLoop
          physicsRef={physicsRef}
          bodiesRef={bodiesRef}
          statsCacheRef={energyStatsRef}
          setStats={setStats}
          isRunning={isRunning}
          speed={simulationSpeed}
        />

        <group>
           {/* We render based on the initial bodies length. 
               The individual BodyVisual components pull their realtime position from the ref.
               This key includes resetKey to force a full remount when reset is clicked, clearing trails. */}
           {physicsRef.current && physicsRef.current.bodies.map((body, idx) => (
             <BodyVisual 
                key={`${resetKey}-${idx}`} 
                index={idx}
                body={body} 
                simulationRef={bodiesRef} 
                traceLength={getTrailLength(simulationSpeed)}
                theme={theme}
             />
           ))}
        </group>

        <StarField theme={theme} />
        <CameraController 
          bodiesRef={bodiesRef}
          resetCameraKey={resetCameraKey}
        />
      </Canvas>

      <Controls 
        isRunning={isRunning}
        setIsRunning={setIsRunning}
        simulationSpeed={simulationSpeed}
        setSimulationSpeed={setSimulationSpeed}
        resetSimulation={initSimulation}
        currentPreset={currentPreset}
        stats={stats}
        bodies={bodiesRef.current}
        theme={theme}
        setTheme={setTheme}
        onResetCamera={handleResetCamera}
      />
    </div>
  );
}