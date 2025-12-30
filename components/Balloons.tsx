import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface BalloonsProps {
  count: number;
  areaWidth: number;
}

const BalloonShape: React.FC<{ type: 'round' | 'heart' | 'star' | 'bear', color: THREE.Color }> = ({ type, color }) => {
    // Materials
    const material = useMemo(() => new THREE.MeshStandardMaterial({ 
        color: color, 
        roughness: 0.3, 
        metalness: 0.1,
        emissive: color,
        emissiveIntensity: 0.1
    }), [color]);

    const stringMaterial = useMemo(() => new THREE.LineBasicMaterial({ color: '#cccccc', transparent: true, opacity: 0.5 }), []);

    // Geometries
    const geometry = useMemo(() => {
        if (type === 'heart') {
            const x = 0, y = 0;
            const heartShape = new THREE.Shape();
            heartShape.moveTo( x + 0.25, y + 0.25 );
            heartShape.bezierCurveTo( x + 0.25, y + 0.25, x + 0.20, y, x, y );
            heartShape.bezierCurveTo( x - 0.30, y, x - 0.30, y + 0.35, x - 0.30, y + 0.35 );
            heartShape.bezierCurveTo( x - 0.30, y + 0.55, x - 0.10, y + 0.77, x + 0.25, y + 0.95 );
            heartShape.bezierCurveTo( x + 0.60, y + 0.77, x + 0.80, y + 0.55, x + 0.80, y + 0.35 );
            heartShape.bezierCurveTo( x + 0.80, y + 0.35, x + 0.80, y, x + 0.50, y );
            heartShape.bezierCurveTo( x + 0.35, y, x + 0.25, y + 0.25, x + 0.25, y + 0.25 );
            
            // Center the heart
            const extrudeSettings = { depth: 0.2, bevelEnabled: true, bevelSegments: 2, steps: 2, bevelSize: 0.05, bevelThickness: 0.05 };
            const geo = new THREE.ExtrudeGeometry( heartShape, extrudeSettings );
            geo.center();
            geo.rotateZ(Math.PI); // Heart draws upside down usually
            return geo;
        } 
        else if (type === 'star') {
            const starShape = new THREE.Shape();
            const outerRadius = 0.5;
            const innerRadius = 0.25;
            const numPoints = 5;
            
            for(let i = 0; i < numPoints * 2; i++){
                const radius = i % 2 === 0 ? outerRadius : innerRadius;
                const angle = (i / (numPoints * 2)) * Math.PI * 2;
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;
                if(i===0) starShape.moveTo(x,y);
                else starShape.lineTo(x,y);
            }
            starShape.closePath();
            
            const extrudeSettings = { depth: 0.2, bevelEnabled: true, bevelSegments: 1, bevelSize: 0.05, bevelThickness: 0.05 };
            const geo = new THREE.ExtrudeGeometry( starShape, extrudeSettings );
            geo.center();
            return geo;
        }
        else {
            // Default Round
            return new THREE.IcosahedronGeometry(0.6, 1);
        }
    }, [type]);

    // Bear is a composite object, handle separately
    if (type === 'bear') {
        return (
            <group>
                {/* Head */}
                <mesh material={material}>
                    <sphereGeometry args={[0.5, 32, 32]} />
                </mesh>
                {/* Ears */}
                <mesh position={[-0.4, 0.4, 0]} material={material}>
                    <sphereGeometry args={[0.2, 16, 16]} />
                </mesh>
                <mesh position={[0.4, 0.4, 0]} material={material}>
                    <sphereGeometry args={[0.2, 16, 16]} />
                </mesh>
                {/* String */}
                <line>
                    <bufferGeometry>
                        <bufferAttribute 
                            attach="attributes-position" 
                            count={2} 
                            array={new Float32Array([0, -0.5, 0, 0, -2.5, 0])} 
                            itemSize={3} 
                        />
                    </bufferGeometry>
                    <primitive object={stringMaterial} />
                </line>
            </group>
        )
    }

    return (
        <group>
            <mesh geometry={geometry} material={material} />
            {/* String */}
            <line>
                <bufferGeometry>
                    <bufferAttribute 
                        attach="attributes-position" 
                        count={2} 
                        array={new Float32Array([0, -0.6, 0, 0, -2.5, 0])} 
                        itemSize={3} 
                    />
                </bufferGeometry>
                <primitive object={stringMaterial} />
            </line>
        </group>
    );
}

export const Balloons: React.FC<BalloonsProps> = ({ count, areaWidth }) => {
  const groupRef = useRef<THREE.Group>(null);

  const balloons = useMemo(() => {
    return new Array(count).fill(0).map(() => {
        // Pastel / Cartoon Colors
        const hue = Math.random();
        const sat = 0.6 + Math.random() * 0.4;
        const light = 0.6 + Math.random() * 0.2;
        
        // Weighted Random Selection:
        // Round: ~60%
        // Others: ~40% combined
        const rand = Math.random();
        let type: 'round' | 'heart' | 'star' | 'bear' = 'round';
        
        if (rand > 0.6) {
             const others: ('heart' | 'star' | 'bear')[] = ['heart', 'star', 'bear'];
             type = others[Math.floor(Math.random() * others.length)];
        }
        
        return {
            type,
            xOffset: (Math.random() - 0.5), // Normalized
            yStart: -15 - Math.random() * 15,
            zPos: (Math.random() - 0.5) * 8,
            speed: 1.5 + Math.random() * 2.5,
            color: new THREE.Color().setHSL(hue, sat, light),
            scale: 0.8 + Math.random() * 0.5,
            wobbleSpeed: 1 + Math.random(),
            wobbleAmp: 0.2 + Math.random() * 0.3,
            rotSpeed: (Math.random() - 0.5) * 1.0
      };
    });
  }, [count]);

  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.children.forEach((child, i) => {
        const balloon = balloons[i];
        
        // Move up
        child.position.y += balloon.speed * delta;
        
        // Wiggle X
        const time = state.clock.elapsedTime;
        const baseX = balloon.xOffset * areaWidth;
        
        child.position.x = baseX + Math.sin(time * balloon.wobbleSpeed + i) * balloon.wobbleAmp;
        
        // Slight rotation for fun
        child.rotation.z = Math.sin(time * balloon.wobbleSpeed) * 0.1;
        child.rotation.y += balloon.rotSpeed * delta;

        // Reset
        if (child.position.y > 18) {
          child.position.y = -18 - Math.random() * 5;
          balloon.xOffset = (Math.random() - 0.5);
          child.rotation.set(0,0,0);
        }
      });
    }
  });

  return (
    <group ref={groupRef}>
      {balloons.map((b, i) => (
        <group 
          key={i} 
          position={[b.xOffset * areaWidth, b.yStart, b.zPos]} 
          scale={[b.scale, b.scale, b.scale]}
        >
          <BalloonShape type={b.type} color={b.color} />
        </group>
      ))}
    </group>
  );
};