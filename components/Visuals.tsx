import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Trail, Html, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { BodyState } from '../types';

interface BodiesManagerProps {
  bodiesRef: React.MutableRefObject<BodyState[]>;
  traceLength: number;
  theme: 'dark' | 'light';
  onUpdateRef: React.MutableRefObject<((bodies: BodyState[]) => void) | null>;
}

const quaternion = new THREE.Quaternion();
const tempMatrix = new THREE.Matrix4();
const glowMatrix = new THREE.Matrix4();
const tempPosition = new THREE.Vector3();
const tempScale = new THREE.Vector3();
const glowScale = new THREE.Vector3();

const getDisplayColor = (body: BodyState, theme: 'dark' | 'light') => {
  const baseColor = new THREE.Color(body.color);
  if (body.isStar || theme === 'dark') return baseColor;

  const lightPlanetColor = baseColor.clone().lerp(new THREE.Color('#0ea5e9'), 0.35);
  lightPlanetColor.offsetHSL(0, -0.05, 0.08);
  return lightPlanetColor;
};

export const BodiesManager: React.FC<BodiesManagerProps> = ({ bodiesRef, traceLength, theme, onUpdateRef }) => {
  const planetMeshRef = useRef<THREE.InstancedMesh>(null);
  const starCoreRef = useRef<THREE.InstancedMesh>(null);
  const starGlowRef = useRef<THREE.InstancedMesh>(null);
  const trailTargets = useRef<Array<React.MutableRefObject<THREE.Group | null>>>([]);

  const sphereGeometry = useMemo(() => new THREE.SphereGeometry(1, 32, 32), []);
  const planetMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    roughness: 0.65,
    metalness: 0.25,
    vertexColors: true
  }), []);
  const starCoreMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    emissiveIntensity: 2.0,
    toneMapped: false,
    roughness: 0.4,
    metalness: 0.1,
    vertexColors: true
  }), []);
  const starGlowMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: theme === 'dark' ? 0.18 : 0.12,
    depthWrite: false,
    side: THREE.BackSide,
    blending: theme === 'dark' ? THREE.AdditiveBlending : THREE.NormalBlending,
    color: '#ffffff'
  }), [theme]);

  const bodies = bodiesRef.current;
  const planetBodies = bodies.filter((b) => !b.isStar);
  const starBodies = bodies.filter((b) => b.isStar);

  const ensureTargetRef = (index: number) => {
    if (!trailTargets.current[index]) {
      trailTargets.current[index] = { current: null } as React.MutableRefObject<THREE.Group | null>;
    }
    return trailTargets.current[index];
  };

  const updateScene = useCallback((liveBodies: BodyState[]) => {
    let planetIndex = 0;
    let starIndex = 0;

    liveBodies.forEach((body, idx) => {
      const targetRef = trailTargets.current[idx];
      tempPosition.set(body.position.x, body.position.y, body.position.z);
      tempScale.set(body.radius, body.radius, body.radius);

      tempMatrix.compose(tempPosition, quaternion, tempScale);

      if (body.isStar) {
        if (starCoreRef.current) {
          starCoreRef.current.setMatrixAt(starIndex, tempMatrix);
        }
        if (starGlowRef.current) {
          glowScale.set(body.radius * 2.2, body.radius * 2.2, body.radius * 2.2);
          glowMatrix.compose(tempPosition, quaternion, glowScale);
          starGlowRef.current.setMatrixAt(starIndex, glowMatrix);
        }
        starIndex++;
      } else if (planetMeshRef.current) {
        planetMeshRef.current.setMatrixAt(planetIndex, tempMatrix);
        planetIndex++;
      }

      if (targetRef?.current) {
        targetRef.current.position.copy(tempPosition);
      }
    });

    if (planetMeshRef.current) {
      planetMeshRef.current.instanceMatrix.needsUpdate = true;
    }
    if (starCoreRef.current) {
      starCoreRef.current.instanceMatrix.needsUpdate = true;
    }
    if (starGlowRef.current) {
      starGlowRef.current.instanceMatrix.needsUpdate = true;
    }
  }, []);

  useEffect(() => {
    onUpdateRef.current = updateScene;
    return () => {
      if (onUpdateRef.current === updateScene) {
        onUpdateRef.current = null;
      }
    };
  }, [onUpdateRef, updateScene]);

  useEffect(() => {
    if (starGlowRef.current) {
      starGlowRef.current.material = starGlowMaterial;
    }
  }, [starGlowMaterial]);

  useEffect(() => {
    let planetIndex = 0;
    let starIndex = 0;

    bodiesRef.current.forEach((body) => {
      const displayColor = getDisplayColor(body, theme);

      if (body.isStar) {
        if (starCoreRef.current) {
          starCoreRef.current.setColorAt(starIndex, displayColor);
        }
        if (starGlowRef.current) {
          starGlowRef.current.setColorAt(starIndex, displayColor);
        }
        starIndex++;
      } else {
        if (planetMeshRef.current) {
          planetMeshRef.current.setColorAt(planetIndex, displayColor);
        }
        planetIndex++;
      }
    });

    if (planetMeshRef.current?.instanceColor) {
      planetMeshRef.current.instanceColor.needsUpdate = true;
    }
    if (starCoreRef.current?.instanceColor) {
      starCoreRef.current.instanceColor.needsUpdate = true;
    }
    if (starGlowRef.current?.instanceColor) {
      starGlowRef.current.instanceColor.needsUpdate = true;
    }
  }, [bodiesRef, theme, planetBodies.length, starBodies.length]);

  useEffect(() => {
    return () => {
      sphereGeometry.dispose();
      planetMaterial.dispose();
      starCoreMaterial.dispose();
      starGlowMaterial.dispose();
    };
  }, [planetMaterial, sphereGeometry, starCoreMaterial, starGlowMaterial]);

  return (
    <group>
      {planetBodies.length > 0 && (
        <instancedMesh
          ref={planetMeshRef}
          args={[sphereGeometry, planetMaterial, planetBodies.length]}
          castShadow
          receiveShadow
        />
      )}

      {starBodies.length > 0 && (
        <>
          <instancedMesh
            ref={starCoreRef}
            args={[sphereGeometry, starCoreMaterial, starBodies.length]}
          />
          <instancedMesh
            ref={starGlowRef}
            args={[sphereGeometry, starGlowMaterial, starBodies.length]}
          />
        </>
      )}

      {bodiesRef.current.map((body, idx) => {
        const targetRef = ensureTargetRef(idx);
        const trailColor = body.isStar ? body.color : theme === 'dark' ? '#e0f2fe' : '#0ea5e9';

        return (
          <React.Fragment key={`${body.name}-${idx}`}>
            <group ref={(node) => { targetRef.current = node; }}>
              <Html
                position={[0, body.radius * (body.isStar ? 2.5 : 2.0) + 0.5, 0]}
                center
                distanceFactor={15}
                zIndexRange={[100, 0]}
                style={{ pointerEvents: 'none' }}
              >
                <div
                  className={`select-none text-xs font-mono px-2 rounded backdrop-blur-sm border whitespace-nowrap transition-colors duration-300
                ${theme === 'dark'
                    ? 'text-white/90 bg-black/50 border-white/10 shadow-sm'
                    : 'text-gray-900 bg-white/85 border-gray-200 shadow-md'
                  }`}
                >
                  {body.name}
                </div>
              </Html>
            </group>

            <Trail
              width={body.isStar ? 0.8 : 0.2}
              length={traceLength}
              color={new THREE.Color(trailColor)}
              attenuation={(t) => t * t}
              target={targetRef}
            >
              <mesh position={[0, 0, 0]} visible={false}>
                <boxGeometry />
              </mesh>
            </Trail>
          </React.Fragment>
        );
      })}
    </group>
  );
};

export const StarField = ({ theme }: { theme: 'dark' | 'light' }) => {
  return (
    <Sparkles
      count={3000}
      scale={120}
      size={theme === 'dark' ? 1.5 : 1.3}
      speed={0}
      opacity={theme === 'dark' ? 0.4 : 0.28}
      noise={10}
      color={theme === 'dark' ? '#ffffff' : '#94a3b8'}
    />
  );
};

