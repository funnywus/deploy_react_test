import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { GestureState } from '../types';
import { TextParticles } from './TextParticles';
import { Fireworks } from './Fireworks';
import { Balloons } from './Balloons';
import { AtmosphereParticles } from './AtmosphereParticles';

// Augment JSX namespace to include R3F elements
declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}

interface SceneContentProps {
  gestureState: GestureState;
}

export const SceneContent: React.FC<SceneContentProps> = ({ gestureState }) => {
  const { viewport } = useThree();
  
  // Responsive Scale Logic
  const rawTextHeight = 52; 
  const rawTextWidth = 26;

  const scaleW = (viewport.width * 0.9) / rawTextWidth;
  const scaleH = (viewport.height * 0.85) / rawTextHeight;
  const textScale = Math.min(1.1, scaleW, scaleH);

  // Galaxy Starfield
  const starsRef = useRef<THREE.Points>(null);
  const atmosphereRef = useRef<THREE.Group>(null);
  
  // Create Snowflake Texture
  const snowflakeTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#00000000'; // Transparent bg
      ctx.clearRect(0, 0, 128, 128);
      
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#ffffff';

      ctx.translate(64, 64);

      // Draw 6 branches
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, 50);
        ctx.stroke();

        // Draw branch details
        ctx.beginPath();
        ctx.moveTo(0, 20);
        ctx.lineTo(15, 30);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, 20);
        ctx.lineTo(-15, 30);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(0, 35);
        ctx.lineTo(10, 42);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, 35);
        ctx.lineTo(-10, 42);
        ctx.stroke();

        ctx.rotate(Math.PI / 3);
      }
    }
    return new THREE.CanvasTexture(canvas);
  }, []);

  const STAR_COUNT = 4000;

  const { starsGeometry, baseColors, phases } = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(STAR_COUNT * 3);
    const colors = new Float32Array(STAR_COUNT * 3);
    const sizes = new Float32Array(STAR_COUNT);
    const baseColors = new Float32Array(STAR_COUNT * 3);
    const phases = new Float32Array(STAR_COUNT);

    // Update palette to fit Blue-Black theme better, mostly whites/blues
    const colorPalette = [
      new THREE.Color('#ffffff'), 
      new THREE.Color('#bfdbfe'), // Light Blue
      new THREE.Color('#60a5fa'), // Blue
    ];

    for (let i = 0; i < STAR_COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 100;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 100;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 40 - 20;

      const color = colorPalette[Math.floor(Math.random() * colorPalette.length)];
      
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
      
      baseColors[i * 3] = color.r;
      baseColors[i * 3 + 1] = color.g;
      baseColors[i * 3 + 2] = color.b;
      
      sizes[i] = Math.random() * 0.5 + 0.1; 
      phases[i] = Math.random() * Math.PI * 2;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    return { starsGeometry: geometry, baseColors, phases };
  }, []);

  // Track state transitions for animation effects
  const lastFingerCount = useRef(gestureState.fingerCount);
  const transitionIntensity = useRef(0);

  useEffect(() => {
    if (lastFingerCount.current !== gestureState.fingerCount) {
        lastFingerCount.current = gestureState.fingerCount;
        // Trigger a transition impulse (0 -> 1)
        transitionIntensity.current = 1.0;
    }
  }, [gestureState.fingerCount]);

  useFrame((state, delta) => {
    // 1. Smoothly decay the transition intensity
    transitionIntensity.current = THREE.MathUtils.lerp(transitionIntensity.current, 0, delta * 3);

    // 2. Wind / Flow Effect Calculation
    const time = state.clock.elapsedTime;
    
    // Create organic wind variation using overlapping sine waves
    const windX = Math.sin(time * 0.2) + Math.sin(time * 0.7) * 0.5;
    const windY = Math.cos(time * 0.3) + Math.cos(time * 0.9) * 0.5;

    // Apply effects to Galaxy Stars
    if (starsRef.current) {
      // Rotation Logic
      const baseRotZ = delta * 0.02;
      const baseRotY = delta * 0.01;
      
      starsRef.current.rotation.z += baseRotZ + (transitionIntensity.current * delta * 0.5);
      starsRef.current.rotation.y += baseRotY + (transitionIntensity.current * delta * 0.2) + (windX * delta * 0.02);

      const targetTiltX = windY * 0.05; 
      starsRef.current.rotation.x = THREE.MathUtils.lerp(starsRef.current.rotation.x, targetTiltX, delta);

      const breatheScale = 1 + Math.sin(time * 0.5) * 0.05;
      const transitionScale = 1 + transitionIntensity.current * 0.15;
      starsRef.current.scale.setScalar(breatheScale * transitionScale);

      // --- Twinkle Effect ---
      const colorsAttr = starsRef.current.geometry.attributes.color;
      const colorsArray = colorsAttr.array as Float32Array;

      for(let i = 0; i < STAR_COUNT; i++) {
        const i3 = i * 3;
        // Calculate dynamic brightness: speed varies slightly based on phase
        const speed = 1.0 + (phases[i] % 3.0); 
        const wave = Math.sin(time * speed + phases[i]);
        
        // Modulate brightness: 0.8 base + 0.4 variance (0.4 to 1.2 range)
        const brightness = 0.8 + 0.4 * wave; 

        colorsArray[i3] = baseColors[i3] * brightness;
        colorsArray[i3+1] = baseColors[i3+1] * brightness;
        colorsArray[i3+2] = baseColors[i3+2] * brightness;
      }
      colorsAttr.needsUpdate = true;
      // ---------------------

      const material = starsRef.current.material as THREE.PointsMaterial;
      if (material) {
        material.opacity = 0.8 + (transitionIntensity.current * 0.2);
      }
    }

    // Apply effects to Atmosphere (Parallax wind)
    if (atmosphereRef.current) {
        const swayAmount = 1.5;
        const targetPosX = windX * swayAmount;
        const targetPosY = windY * 0.5;

        atmosphereRef.current.position.x = THREE.MathUtils.lerp(atmosphereRef.current.position.x, targetPosX, delta * 0.5);
        atmosphereRef.current.position.y = THREE.MathUtils.lerp(atmosphereRef.current.position.y, targetPosY, delta * 0.5);
        
        atmosphereRef.current.rotation.z = -windX * 0.02;
    }
  });

  const isSpecialMoment = gestureState.fingerCount === 5;
  const isCakeMode = gestureState.label === 'CAKE';

  return (
    <>
      {/* Background Gradient Mesh */}
      <mesh position={[0, 0, -50]}>
        <planeGeometry args={[200, 200]} />
        <shaderMaterial
          side={THREE.DoubleSide}
          uniforms={{
            colorTop: { value: new THREE.Color('#000000') }, // Black top
            colorBottom: { value: new THREE.Color('#172554') }, // Dark Blue bottom
          }}
          vertexShader={`
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            uniform vec3 colorTop;
            uniform vec3 colorBottom;
            varying vec2 vUv;
            void main() {
              // Simple linear gradient from bottom to top
              gl_FragColor = vec4(mix(colorBottom, colorTop, vUv.y), 1.0);
            }
          `}
        />
      </mesh>
      
      <points ref={starsRef} geometry={starsGeometry}>
        <pointsMaterial
          size={0.4}
          vertexColors
          transparent
          opacity={0.8}
          map={snowflakeTexture}
          alphaTest={0.01}
          sizeAttenuation={true}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
      
      <group ref={atmosphereRef}>
        <AtmosphereParticles circleTexture={snowflakeTexture} />
      </group>

      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1.2} color="#ffffff" />
      <pointLight position={[0, -5, 5]} intensity={1} color="#3b82f6" />

      <group scale={[textScale, textScale, textScale]}>
        <TextParticles text={gestureState.label} isSpecial={isSpecialMoment} />
      </group>

      {isSpecialMoment && (
        <>
          <Fireworks count={5} areaWidth={viewport.width} areaHeight={viewport.height} />
          <Balloons count={20} areaWidth={viewport.width} />
        </>
      )}
    </>
  );
};