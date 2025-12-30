import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface AtmosphereParticlesProps {
    circleTexture?: THREE.Texture;
}

// Reusable hook to generate particle data
const useParticleSystem = (count: number, colorShiftProbability: number) => {
    return useMemo(() => {
        const pos = new Float32Array(count * 3);
        const col = new Float32Array(count * 3);
        const rnd = new Float32Array(count); // For phase/speed variation

        for (let i = 0; i < count; i++) {
          pos[i * 3] = (Math.random() - 0.5) * 45; // Wide X
          pos[i * 3 + 1] = (Math.random() - 0.5) * 45; // Wide Y
          pos[i * 3 + 2] = (Math.random() - 0.5) * 25; // Depth

          rnd[i] = Math.random();

          // Mix of Blue tones for the new theme
          if (Math.random() > (1.0 - colorShiftProbability)) {
            // Distinct Light Blue
            col[i * 3] = 0.6; // R
            col[i * 3 + 1] = 0.8; // G
            col[i * 3 + 2] = 1.0; // B
          } else {
            // Pure White
            col[i * 3] = 1.0;
            col[i * 3 + 1] = 1.0;
            col[i * 3 + 2] = 1.0;
          }
        }
        return { positions: pos, colors: col, randoms: rnd };
    }, [count, colorShiftProbability]);
};

export const AtmosphereParticles: React.FC<AtmosphereParticlesProps> = ({ circleTexture }) => {
  const smallRef = useRef<THREE.Points>(null);
  const largeRef = useRef<THREE.Points>(null);
  
  // Significantly increased particle counts
  const smallCount = 1200; 
  const largeCount = 300;

  // Generate two sets of particles
  const smallParticles = useParticleSystem(smallCount, 0.3); // 30% blue
  const largeParticles = useParticleSystem(largeCount, 0.5); // 50% blue

  useFrame((state, delta) => {
    const time = state.clock.elapsedTime;
    
    const animateParticles = (ref: React.RefObject<THREE.Points | null>, randoms: Float32Array, speedMultiplier: number) => {
        if (!ref.current) return;
        const posAttribute = ref.current.geometry.attributes.position;
        const posArray = posAttribute.array as Float32Array;
        const count = randoms.length;

        for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            
            // Drift downwards - Faster speed
            const speed = (0.5 + randoms[i] * 1.5) * speedMultiplier;
            posArray[i3 + 1] -= speed * delta;

            // Sway sideways (Sine wave)
            posArray[i3] += Math.sin(time * 0.8 + randoms[i] * 10) * 0.03; // Increased sway frequency slightly

            // Reset if goes below view
            if (posArray[i3 + 1] < -22) {
                posArray[i3 + 1] = 22;
                posArray[i3] = (Math.random() - 0.5) * 45;
            }
        }
        posAttribute.needsUpdate = true;
        
        // Gentle rotation of the whole system
        ref.current.rotation.y += delta * 0.05 * speedMultiplier;
    };

    // Increased speed multipliers (approx 2x faster than before)
    animateParticles(smallRef, smallParticles.randoms, 2.0);
    animateParticles(largeRef, largeParticles.randoms, 2.5); 
  });

  return (
    <group>
        {/* Small Particles (Background dust) */}
        <points ref={smallRef}>
            <bufferGeometry>
                <bufferAttribute
                    attach="attributes-position"
                    count={smallCount}
                    array={smallParticles.positions}
                    itemSize={3}
                />
                <bufferAttribute
                    attach="attributes-color"
                    count={smallCount}
                    array={smallParticles.colors}
                    itemSize={3}
                />
            </bufferGeometry>
            <pointsMaterial
                size={0.2} 
                vertexColors
                transparent
                opacity={0.5}
                map={circleTexture}
                alphaTest={0.01}
                blending={THREE.AdditiveBlending}
                sizeAttenuation
                depthWrite={false}
            />
        </points>

        {/* Large Particles (Foreground flakes) */}
        <points ref={largeRef}>
            <bufferGeometry>
                <bufferAttribute
                    attach="attributes-position"
                    count={largeCount}
                    array={largeParticles.positions}
                    itemSize={3}
                />
                <bufferAttribute
                    attach="attributes-color"
                    count={largeCount}
                    array={largeParticles.colors}
                    itemSize={3}
                />
            </bufferGeometry>
            <pointsMaterial
                size={0.6} // Significantly larger
                vertexColors
                transparent
                opacity={0.8}
                map={circleTexture}
                alphaTest={0.01}
                blending={THREE.AdditiveBlending}
                sizeAttenuation
                depthWrite={false}
            />
        </points>
    </group>
  );
};