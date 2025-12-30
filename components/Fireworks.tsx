import React, { useEffect, useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const randomRange = (min: number, max: number) => min + Math.random() * (max - min);

const Firework: React.FC<{ position: THREE.Vector3 }> = ({ position }) => {
  const particleCount = 400; // High density for a fuller burst
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Initialize Physics & Attributes
  const { velocities, colors, sizes } = useMemo(() => {
    const vels = [];
    const cols = [];
    const sz = []; // stores { width, lengthMult }
    
    // Vibrant Firework Palettes
    const palettes = [
        [1.0, 0.2, 0.2], // Bright Red
        [0.2, 1.0, 0.4], // Neon Green
        [0.3, 0.6, 1.0], // Electric Blue
        [1.0, 0.8, 0.1], // Gold
        [0.8, 0.3, 1.0], // Violet
        [0.1, 0.9, 0.9], // Cyan
    ];
    // Pick a primary color for this explosion
    const palette = palettes[Math.floor(Math.random() * palettes.length)];
    const baseColor = new THREE.Color(palette[0], palette[1], palette[2]);

    for (let i = 0; i < particleCount; i++) {
        // Spherical Burst Distribution
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        
        // Speed variation: 
        // Core is dense, outer edges are faster. 
        // Range 15-50 gives a good size explosion.
        const speed = randomRange(15, 50); 
        
        vels.push(
            speed * Math.sin(phi) * Math.cos(theta),
            speed * Math.sin(phi) * Math.sin(theta),
            speed * Math.cos(phi)
        );

        // --- Visual Shape Design ---
        // We want "long and short, thick and thin" but NO heavy chunks.
        // Width: Generally thin, representing sparks (0.04 to 0.12)
        const width = randomRange(0.04, 0.12); 

        // Length Multiplier: Determines the "streak" length relative to speed.
        // Some are short sparks, some are long tracers.
        const lengthMult = randomRange(0.1, 0.35); 

        sz.push({ width, lengthMult });

        // Color Logic
        // 90% Base color, 10% White sparkles
        const isWhite = Math.random() > 0.9;
        const c = isWhite ? new THREE.Color(1.0, 1.0, 1.0) : baseColor.clone();
        
        if (!isWhite) {
            // Add slight variation to base color for realism
            c.offsetHSL(0, 0, (Math.random() - 0.5) * 0.15);
        }

        cols.push(c.r, c.g, c.b);
    }
    
    return { velocities: new Float32Array(vels), colors: new Float32Array(cols), sizes: sz };
  }, []);

  // Store current positions to avoid GC overhead
  const positionsRef = useRef<Float32Array | null>(null);

  // Initial Setup
  useEffect(() => {
      if(!positionsRef.current) {
          const arr = new Float32Array(particleCount * 3);
          for(let i=0; i<particleCount; i++) {
              arr[i*3] = position.x;
              arr[i*3+1] = position.y;
              arr[i*3+2] = position.z;
          }
          positionsRef.current = arr;
      }
      
      // Set instance colors once
      if(meshRef.current) {
          const c = new THREE.Color();
          for(let i=0; i<particleCount; i++) {
             c.setRGB(colors[i*3], colors[i*3+1], colors[i*3+2]);
             meshRef.current.setColorAt(i, c);
          }
          if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
      }
  }, [position, colors, particleCount]);
  
  const startTime = useRef(Date.now());

  useFrame((state, delta) => {
      if (!meshRef.current || !positionsRef.current) return;
      const elapsed = (Date.now() - startTime.current) / 1000;
      const lifeDuration = 2.0; // Seconds until fully gone
      if (elapsed > lifeDuration) return;

      const d = Math.min(delta, 0.05); // Cap delta for stability
      const pos = positionsRef.current;
      
      for(let i=0; i<particleCount; i++) {
          const ix3 = i * 3;
          
          // --- Physics ---
          // 1. Air Resistance (Drag): High drag mimics real fireworks slowing down rapidly
          velocities[ix3] *= 0.92; 
          velocities[ix3+1] *= 0.92;
          velocities[ix3+2] *= 0.92;
          
          // 2. Gravity: Accelerates downwards
          velocities[ix3+1] -= 9.0 * d; 

          // Update Position
          pos[ix3] += velocities[ix3] * d;
          pos[ix3+1] += velocities[ix3+1] * d;
          pos[ix3+2] += velocities[ix3+2] * d;

          // --- Rendering Transform ---
          dummy.position.set(pos[ix3], pos[ix3+1], pos[ix3+2]);
          
          // Orientation: Look along the velocity vector to align the "tail"
          const vx = velocities[ix3];
          const vy = velocities[ix3+1];
          const vz = velocities[ix3+2];
          
          dummy.lookAt(pos[ix3] + vx, pos[ix3+1] + vy, pos[ix3+2] + vz);
          
          // Scale: 
          // X/Y = Width (Fixed thickness)
          // Z   = Length (Simulated motion blur / trail)
          const currentSpeed = Math.sqrt(vx*vx + vy*vy + vz*vz);
          // Trail length is proportional to speed. As it stops, it becomes a point.
          const len = Math.max(0.05, currentSpeed * sizes[i].lengthMult);
          
          dummy.scale.set(sizes[i].width, sizes[i].width, len);
          dummy.updateMatrix();
          
          meshRef.current.setMatrixAt(i, dummy.matrix);
      }
      meshRef.current.instanceMatrix.needsUpdate = true;
      
      // Fade Out Curve: Stays bright for a bit, then fades quickly
      const progress = elapsed / lifeDuration;
      const opacity = Math.max(0, 1 - Math.pow(progress, 3)); 
      
      if (meshRef.current.material) {
        (meshRef.current.material as THREE.MeshBasicMaterial).opacity = opacity;
      }
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, particleCount]}>
      <boxGeometry args={[1, 1, 1]} /> 
      <meshBasicMaterial 
        transparent 
        opacity={1} 
        blending={THREE.AdditiveBlending} 
        depthWrite={false} 
        toneMapped={false}
      />
    </instancedMesh>
  );
};

interface FireworksProps {
  count: number;
  areaWidth: number;
  areaHeight: number;
}

export const Fireworks: React.FC<FireworksProps> = ({ count, areaWidth, areaHeight }) => {
  const [explosions, setExplosions] = React.useState<{id: number, pos: THREE.Vector3}[]>([]);

  useEffect(() => {
    // Spawn rate
    const interval = setInterval(() => {
        const id = Date.now();
        // Position Logic: Spread out, mostly in upper half
        const x = (Math.random() - 0.5) * areaWidth * 1.0; 
        const y = (Math.random() * 0.6 - 0.1) * areaHeight; // -0.1 to 0.5 height
        const z = -20 - Math.random() * 20; // Depth variation
        
        setExplosions(prev => [
            ...prev, 
            { id, pos: new THREE.Vector3(x, y, z) }
        ].slice(-15)); // Keep max 15 fireworks alive
    }, 400); 
    return () => clearInterval(interval);
  }, [areaWidth, areaHeight]);

  return (
    <group>
      {explosions.map(ex => <Firework key={ex.id} position={ex.pos} />)}
    </group>
  );
};