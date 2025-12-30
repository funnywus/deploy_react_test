import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Candle positions must match those generated in TextParticles for the 'CAKE' mode
const CANDLE_POSITIONS = [
  [0, 6, 0],
  [4, 6, 3],
  [-4, 6, 3],
  [3, 6, -3],
  [-3, 6, -3]
];

export const CandleFlames: React.FC = () => {
  const pointsRef = useRef<THREE.Points>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const particleCount = 300; 

  // Initialize flame particles
  const [positions, colors, meta] = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    const col = new Float32Array(particleCount * 3);
    const metadata = []; // stores { candleIndex, speed, offset, life, maxLife, driftX, driftZ }

    for (let i = 0; i < particleCount; i++) {
      const candleIndex = i % CANDLE_POSITIONS.length;
      const [cx, cy, cz] = CANDLE_POSITIONS[candleIndex];

      // Initial random position - Tighter distribution for start
      const r = Math.pow(Math.random(), 2) * 0.08;
      const theta = Math.random() * Math.PI * 2;
      
      pos[i * 3] = cx + r * Math.cos(theta);
      pos[i * 3 + 1] = cy + Math.random() * 1.5;
      pos[i * 3 + 2] = cz + r * Math.sin(theta);

      col[i * 3] = 1.0;
      col[i * 3 + 1] = 0.8;
      col[i * 3 + 2] = 0.0;

      metadata.push({
        candleIndex,
        speed: 1.0 + Math.random() * 2.0, // More variation in speed
        noiseOffset: Math.random() * 1000,
        life: Math.random(),
        maxLife: 0.5 + Math.random() * 0.7, // Varied lifespan
        driftX: (Math.random() - 0.5) * 0.5,
        driftZ: (Math.random() - 0.5) * 0.5
      });
    }

    return [pos, col, metadata];
  }, []);

  useFrame((state, delta) => {
    if (!pointsRef.current) return;
    
    const posArray = pointsRef.current.geometry.attributes.position.array as Float32Array;
    const colArray = pointsRef.current.geometry.attributes.color.array as Float32Array;
    const time = state.clock.elapsedTime;

    // Animate light flicker
    if (lightRef.current) {
        lightRef.current.intensity = 2 + Math.sin(time * 20) * 0.3 + Math.cos(time * 45) * 0.2;
    }

    for (let i = 0; i < particleCount; i++) {
      const m = meta[i];
      const i3 = i * 3;
      const [cx, cy, cz] = CANDLE_POSITIONS[m.candleIndex];

      // Update Lifecycle
      m.life -= delta * 0.8; 

      if (m.life <= 0) {
        // Respawn particle at base of flame
        m.life = m.maxLife;
        
        // Concentrated emission point (Wick)
        // Using power function to bias heavily towards center (0,0)
        const r = Math.pow(Math.random(), 2.5) * 0.08; 
        const theta = Math.random() * Math.PI * 2;
        
        posArray[i3] = cx + r * Math.cos(theta);
        posArray[i3 + 1] = cy + 0.02; // Start very close to wick
        posArray[i3 + 2] = cz + r * Math.sin(theta);

        // Reset drift for new particle
        m.driftX = (Math.random() - 0.5) * 0.3;
        m.driftZ = (Math.random() - 0.5) * 0.3;
        m.speed = 1.0 + Math.random() * 2.0;
      } else {
        const nLife = m.life / m.maxLife; // 1.0 (birth) -> 0.0 (death)

        // Upward Movement with acceleration
        // Particles start slower and speed up as they heat up/rise
        const acceleration = 1.0 + (1 - nLife);
        posArray[i3 + 1] += delta * m.speed * acceleration;

        // Apply Drift (decreases as it goes up, overtaken by turbulence)
        posArray[i3] += m.driftX * delta * nLife;
        posArray[i3 + 2] += m.driftZ * delta * nLife;

        // Turbulence/Wind Simulation
        const turbulence = (1 - nLife) * 0.2;
        const freq = 4.0;
        
        const noiseX = Math.sin(time * freq + m.noiseOffset + posArray[i3+1] * 1.5) 
                     + Math.sin(time * freq * 2.0 + posArray[i3+1]);
        const noiseZ = Math.cos(time * freq * 0.7 + m.noiseOffset + posArray[i3+1] * 1.5);

        posArray[i3] += noiseX * turbulence * delta * 2.0;
        posArray[i3 + 2] += noiseZ * turbulence * delta * 2.0;

        // Tapering: Pull x/z back towards center vertical axis
        const taperStrength = 2.5 * delta;
        if (nLife > 0.15) {
            posArray[i3] += (cx - posArray[i3]) * taperStrength;
            posArray[i3 + 2] += (cz - posArray[i3 + 2]) * taperStrength;
        }

        // --- COLOR GRADIENT ---
        // Blue/White (Base) -> Yellow (Body) -> Red/Orange (Top)
        let r = 1, g = 1, b = 0;

        if (nLife > 0.85) {
             // Core (Hot)
             r = 0.6; g = 0.8; b = 1.0; 
        } else if (nLife > 0.5) {
             // Body
             r = 1.0; g = 0.7 + (nLife - 0.5); b = 0.1; 
        } else {
             // Tip
             r = 1.0; g = nLife * 1.0; b = 0.0;
        }

        // Flicker effect on alpha/brightness
        const flicker = 0.8 + Math.random() * 0.4;
        colArray[i3] = Math.min(1, r * flicker);
        colArray[i3 + 1] = Math.min(1, g * flicker);
        colArray[i3 + 2] = Math.min(1, b * flicker);
      }
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true;
    pointsRef.current.geometry.attributes.color.needsUpdate = true;
  });

  return (
    <group>
        <points ref={pointsRef}>
        <bufferGeometry>
            <bufferAttribute
            attach="attributes-position"
            count={particleCount}
            array={positions}
            itemSize={3}
            />
            <bufferAttribute
            attach="attributes-color"
            count={particleCount}
            array={colors}
            itemSize={3}
            />
        </bufferGeometry>
        <pointsMaterial
            size={0.6} // Slightly larger global size
            vertexColors
            transparent
            opacity={0.8} 
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            sizeAttenuation
        />
        </points>
        <pointLight 
            ref={lightRef}
            position={[0, 7, 0]} 
            intensity={2} 
            color="#ffaa33" 
            distance={15} 
            decay={2} 
        />
    </group>
  );
};