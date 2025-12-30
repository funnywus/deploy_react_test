import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface TextParticlesProps {
  text: string;
  isSpecial: boolean;
}

// ---------------------------
// PARTICLE COUNTS CONSTANTS
// ---------------------------
const TIER1_COUNT = 3500;
const TIER2_COUNT = 3000;
const TIER3_COUNT = 2000;
const HEART_COUNT = 1500;
// Heart starts after the 3 cake tiers
const HEART_START_INDEX = TIER1_COUNT + TIER2_COUNT + TIER3_COUNT; 

// ---------------------------
// CAKE GEOMETRY GENERATION
// ---------------------------
const getCakePoints = (): Float32Array => {
  const points: number[] = [];
  
  // 1. CAKE TIERS
  const addCylinder = (radius: number, height: number, yBase: number, count: number) => {
    for (let i = 0; i < count; i++) {
      const r = Math.sqrt(Math.random()) * radius; // Uniform distribution on disk
      const theta = Math.random() * Math.PI * 2;
      const h = Math.random() * height;
      
      const x = r * Math.cos(theta);
      const z = r * Math.sin(theta);
      const y = yBase + h;
      
      // Bias points towards the surface for better definition
      if (Math.random() > 0.4) {
         const surfaceR = radius * (0.96 + Math.random() * 0.04);
         const sx = surfaceR * Math.cos(theta);
         const sz = surfaceR * Math.sin(theta);
         points.push(sx, y, sz);
      } else {
         points.push(x, y, z);
      }
    }
  };

  // Tier 1 (Bottom) - Red
  addCylinder(14, 6, -10, TIER1_COUNT);

  // Tier 2 (Middle) - Blue
  addCylinder(10, 6, -4, TIER2_COUNT);

  // Tier 3 (Top) - Yellow (Previously White)
  addCylinder(6, 6, 2, TIER3_COUNT);

  // 2. HEART DECORATION (Replaces Star)
  // Procedural 3D Heart Surface
  const heartCenterY = 12.0; 
  const heartScale = 0.28;

  for(let i=0; i<HEART_COUNT; i++) {
      // Parametric Heart Formula
      // x = 16 sin^3(u) sin(v)
      // y = 13 cos(u) - 5 cos(2u) - 2 cos(3u) - cos(4u)
      // z = 9 sin^3(u) cos(v)

      const u = Math.random() * Math.PI; 
      const v = Math.random() * Math.PI * 2;

      const sinU = Math.sin(u);
      const cosU = Math.cos(u);
      const sinV = Math.sin(v);
      const cosV = Math.cos(v);
      const sinU3 = Math.pow(sinU, 3);

      let x = 16 * sinU3 * sinV;
      let y = 13 * cosU - 5 * Math.cos(2*u) - 2 * Math.cos(3*u) - Math.cos(4*u);
      let z = 9 * sinU3 * cosV; // Thickness

      // Add noise to simulate volume/sparkle
      const noise = 0.95 + Math.random() * 0.1;
      
      x *= heartScale * noise;
      y *= heartScale * noise;
      z *= heartScale * noise;
      
      points.push(x, y + heartCenterY, z);
  }

  // 3. TITLE TEXT: "领取你的新年标签"
  const titleCanvas = document.createElement('canvas');
  titleCanvas.width = 512;
  titleCanvas.height = 128;
  const tCtx = titleCanvas.getContext('2d');
  if (tCtx) {
      tCtx.fillStyle = '#000000';
      tCtx.fillRect(0, 0, titleCanvas.width, titleCanvas.height);
      // Poster Serif Font
      tCtx.font = 'bold 60px "Songti SC", "SimSun", "Times New Roman", serif';
      tCtx.fillStyle = '#ffffff';
      tCtx.textAlign = 'center';
      tCtx.textBaseline = 'middle';
      tCtx.fillText("领取你的新年标签", titleCanvas.width / 2, titleCanvas.height / 2);

      const tData = tCtx.getImageData(0, 0, titleCanvas.width, titleCanvas.height).data;
      const tStep = 3;
      const titleYOffset = 22; 

      for (let py = 0; py < titleCanvas.height; py += tStep) {
        for (let px = 0; px < titleCanvas.width; px += tStep) {
            const idx = (py * titleCanvas.width + px) * 4;
            if (tData[idx] > 128) {
                // Map 2D to 3D
                const pX = (px - titleCanvas.width / 2) * 0.05;
                const pY = -(py - titleCanvas.height / 2) * 0.05 + titleYOffset;
                const pZ = 0;
                points.push(pX, pY, pZ);
            }
        }
      }
  }

  return new Float32Array(points);
};

// ---------------------------
// TEXT GEOMETRY GENERATION
// ---------------------------
const getPointsFromText = (text: string): Float32Array => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 1024; 
  const ctx = canvas.getContext('2d');
  if (!ctx) return new Float32Array(0);

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Specific layout for the final page
  if (text === '2026 诸事顺遂') {
      // VERTICAL MOBILE LAYOUT
      // "2026" at the top, very large
      // "诸事顺遂" vertical below it
      
      const centerX = canvas.width / 2;
      
      // 1. Draw "2026"
      // Use Impact or Heavy font for maximum boldness
      ctx.font = `900 150px "Impact", "Arial Black", "Heiti SC", sans-serif`;
      ctx.fillText("2026", centerX, canvas.height * 0.15);

      // 2. Draw Vertical "诸事顺遂"
      // Slightly smaller but still bold
      ctx.font = `bold 130px "Microsoft YaHei", "Heiti SC", sans-serif`;
      
      const startY = canvas.height * 0.35;
      const lineHeight = 140;
      const chars = ["诸", "事", "顺", "遂"];
      
      chars.forEach((char, i) => {
          ctx.fillText(char, centerX, startY + (i * lineHeight));
      });

  } else {
      // Dynamic Font Size Logic for others
      let fontSize = 180;
      if (text.length > 5) fontSize = 110; 
      if (text === '新年新气象') fontSize = 130; 
      
      ctx.font = `bold ${fontSize}px "Microsoft YaHei", "Heiti SC", sans-serif`;

      // Layout Logic: Detect if should be vertical
      const isEnglish = /^[A-Za-z0-9\s❤️]+$/.test(text);
      const isVertical = !isEnglish; // Only Chinese is vertical by default here

      if (!isVertical) {
        // Standard Horizontal
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);
      } else {
        // Vertical Layout
        const chars = Array.from(text);
        const lineHeight = fontSize * 1.0; 
        const totalTextHeight = chars.length * lineHeight;
        const startY = (canvas.height - totalTextHeight) / 2 + lineHeight / 2;

        for (let i = 0; i < chars.length; i++) {
            const char = chars[i];
            ctx.fillText(char, canvas.width / 2, startY + (i * lineHeight));
        }
      }
  }

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const points = [];
  // Use a smaller step (higher density) for the final text to make it more "solid"
  const step = text === '2026 诸事顺遂' ? 3 : 4; 
  
  for (let y = 0; y < canvas.height; y += step) {
    for (let x = 0; x < canvas.width; x += step) {
      const index = (y * canvas.width + x) * 4;
      if (data[index] > 128) {
        // Map 2D to 3D
        // Scale factor 0.05 means 512px -> 25.6 units
        const pX = (x - canvas.width / 2) * 0.05;
        const pY = -(y - canvas.height / 2) * 0.05;
        const pZ = 0;
        points.push(pX, pY, pZ);
      }
    }
  }

  return new Float32Array(points);
};

export const TextParticles: React.FC<TextParticlesProps> = ({ text, isSpecial }) => {
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.PointsMaterial>(null);
  const baseHeartPositions = useRef<Float32Array | null>(null);

  const MAX_POINTS = 18000; // Increased buffer
  
  const bufferGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(MAX_POINTS * 3);
    const targetPositions = new Float32Array(MAX_POINTS * 3);
    const colors = new Float32Array(MAX_POINTS * 3);
    const targetColors = new Float32Array(MAX_POINTS * 3);
    
    // Initial random scatter - Spherical Distribution
    for(let i=0; i<MAX_POINTS; i++) {
        const r = 35 * Math.cbrt(Math.random()); 
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        
        const x = r * Math.sin(phi) * Math.cos(theta);
        const y = r * Math.sin(phi) * Math.sin(theta);
        const z = r * Math.cos(phi);

        const i3 = i * 3;
        positions[i3] = x;
        positions[i3+1] = y;
        positions[i3+2] = z;

        targetPositions[i3] = x;
        targetPositions[i3+1] = y;
        targetPositions[i3+2] = z;
        
        colors[i3] = 1; colors[i3+1] = 1; colors[i3+2] = 1;
        targetColors[i3] = 1; targetColors[i3+1] = 1; targetColors[i3+2] = 1;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('targetPosition', new THREE.BufferAttribute(targetPositions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('targetColor', new THREE.BufferAttribute(targetColors, 3));
    return geo;
  }, []);

  const targetPoints = useMemo(() => {
    if (!text) return null;
    if (text === 'CAKE') return getCakePoints();
    return getPointsFromText(text);
  }, [text]);

  // Capture Base Heart Positions for Rotation
  useEffect(() => {
    if (text === 'CAKE' && targetPoints) {
      // Extract the subsection of points corresponding to the heart
      const start = HEART_START_INDEX * 3;
      const end = (HEART_START_INDEX + HEART_COUNT) * 3;
      baseHeartPositions.current = targetPoints.slice(start, end);
    } else {
      baseHeartPositions.current = null;
    }
  }, [text, targetPoints]);

  // Update Targets (Positions and Colors)
  useMemo(() => {
    const targets = bufferGeometry.attributes.targetPosition.array as Float32Array;
    const targetColors = bufferGeometry.attributes.targetColor.array as Float32Array;

    if (!targetPoints) {
        // Hide particles completely if no text
        for(let i=0; i<MAX_POINTS; i++) {
            const i3 = i * 3;
            // Send behind background
            targets[i3] = 0; targets[i3+1] = 0; targets[i3+2] = -150;
            targetColors[i3] = 0; targetColors[i3+1] = 0; targetColors[i3+2] = 0;
        }
    } else {
        const count = targetPoints.length / 3;
        const isCake = text === 'CAKE';
        
        // Base Colors for Text - High Saturation
        let baseColor = new THREE.Color(1, 1, 1);
        let topColor = new THREE.Color(1, 1, 1);
        
        if (!isCake) {
            if (text === '马到成功') { baseColor.set('#fbbf24'); topColor.set('#fcd34d'); } // Vivid Gold
            else if (text === '马年行大运') { baseColor.set('#f472b6'); topColor.set('#fbcfe8'); } // Vivid Pink
            else if (text === '新年新气象') { baseColor.set('#ff0000'); topColor.set('#ff4d4d'); } // Vivid Red
            else if (text === '未来可期') { baseColor.set('#00bfff'); topColor.set('#60a5fa'); } // Deep Sky Blue
            else if (text.includes('2026')) { 
                // Prominent Festive Red to Gold Gradient
                baseColor.set('#eab308'); // Yellow-Gold
                topColor.set('#ef4444');  // Bright Red
            }
        }

        for (let i = 0; i < MAX_POINTS; i++) {
          const i3 = i * 3;
          if (i < count) {
            targets[i3] = targetPoints[i3];
            targets[i3 + 1] = targetPoints[i3 + 1];
            targets[i3 + 2] = targetPoints[i3 + 2];
            
            // COLOR LOGIC
            let r=1, g=1, b=1;

            if (isCake) {
                const px = targetPoints[i3];
                const py = targetPoints[i3 + 1];
                const pz = targetPoints[i3 + 2];
                const pr = Math.sqrt(px * px + pz * pz);

                // Normals for lighting
                let nx = px / (pr || 1);
                let ny = 0;
                let nz = pz / (pr || 1);

                // --- VIVID CAKE COLORS ---
                // We use simplified lighting logic to avoid "washing out" the colors with too much specular white.
                // Instead, we use a directional intensity multiplication.

                let baseR = 1, baseG = 1, baseB = 1;

                if (py > 7.5) { 
                    // HEART LOGIC (Top Decoration)
                    let hx = px; let hy = py - 12; let hz = pz;
                    let hLen = Math.sqrt(hx*hx + hy*hy + hz*hz) || 1;
                    nx = hx/hLen; ny = hy/hLen; nz = hz/hLen;
                    // Ruby Red - Very Saturated
                    baseR = 1.0; baseG = 0.0; baseB = 0.15; 
                } else if (py > 2) { 
                    // TOP TIER (Visually first layer) - Yellow (Requested)
                    // Was: baseR = 1.0; baseG = 1.0; baseB = 0.9;
                    baseR = 1.0; baseG = 0.85; baseB = 0.1;
                } else if (py > -4) {
                    // MIDDLE TIER (Blueberry) - Saturated Blue
                    baseR = 0.0; baseG = 0.5; baseB = 1.0;
                    // Adjust normal for cylinder
                    if (py > 1.5 && pr > 6) { nx = 0; ny = 1; nz = 0; } 
                } else {
                    // BOTTOM TIER (Strawberry) - Saturated Red/Pink
                    baseR = 1.0; baseG = 0.1; baseB = 0.3; 
                    if (py > -4.5 && pr > 10) { nx = 0; ny = 1; nz = 0; }
                }

                // Simple Lighting to preserve vividness
                // Directional Light from top-right-front
                const lx = 0.5, ly = 0.6, lz = 0.8;
                const lLen = Math.sqrt(lx*lx + ly*ly + lz*lz);
                const dot = Math.max(0, nx*(lx/lLen) + ny*(ly/lLen) + nz*(lz/lLen));
                
                // Ambient + Diffuse
                // High ambient to keep colors bright
                const intensity = 0.6 + 0.5 * dot; 

                r = baseR * intensity;
                g = baseG * intensity;
                b = baseB * intensity;

                // Add very subtle shine (not white, but lightens the color)
                if (dot > 0.8) {
                    r = Math.min(1, r + 0.1);
                    g = Math.min(1, g + 0.1);
                    b = Math.min(1, b + 0.1);
                }

            } else {
                // Text Gradient Logic
                const y = targetPoints[i3 + 1];
                const normalizedY = (y + 20) / 40; 
                const mixFactor = Math.max(0, Math.min(1, normalizedY));
                
                r = baseColor.r * (1 - mixFactor) + topColor.r * mixFactor;
                g = baseColor.g * (1 - mixFactor) + topColor.g * mixFactor;
                b = baseColor.b * (1 - mixFactor) + topColor.b * mixFactor;

                // Occasional sparkle
                if (Math.random() > 0.95) {
                    r = Math.min(1, r + 0.2); 
                    g = Math.min(1, g + 0.2); 
                    b = Math.min(1, b + 0.2);
                }
            }

            if (isSpecial) {
                // Flash effect
                 r = Math.min(1, r + 0.1);
                 g = Math.min(1, g + 0.1);
                 b = Math.min(1, b + 0.1);
            }

            targetColors[i3] = r;
            targetColors[i3+1] = g;
            targetColors[i3+2] = b;
          } else {
            // Unused particles
            const r = 40 * Math.cbrt(Math.random());
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            
            targets[i3] = r * Math.sin(phi) * Math.cos(theta);
            targets[i3+1] = r * Math.sin(phi) * Math.sin(theta);
            targets[i3+2] = (r * Math.cos(phi)) - 200; 
            
            targetColors[i3] = 0; targetColors[i3 + 1] = 0; targetColors[i3 + 2] = 0;
          }
        }
    }
    
    bufferGeometry.attributes.targetPosition.needsUpdate = true;
    bufferGeometry.attributes.targetColor.needsUpdate = true;

  }, [text, targetPoints, bufferGeometry, isSpecial]);

  useFrame((state, delta) => {
    if (!pointsRef.current) return;

    const positions = bufferGeometry.attributes.position.array as Float32Array;
    const targets = bufferGeometry.attributes.targetPosition.array as Float32Array;
    const colors = bufferGeometry.attributes.color.array as Float32Array;
    const targetColors = bufferGeometry.attributes.targetColor.array as Float32Array;
    
    // Heart Animation Logic
    if (text === 'CAKE' && baseHeartPositions.current) {
        const time = state.clock.elapsedTime * 0.8; // Rotation speed
        const cosT = Math.cos(time);
        const sinT = Math.sin(time);

        for (let i = 0; i < HEART_COUNT; i++) {
            const baseIdx = i * 3;
            const targetIdx = (HEART_START_INDEX + i) * 3;
            
            const x = baseHeartPositions.current[baseIdx];
            const y = baseHeartPositions.current[baseIdx + 1];
            const z = baseHeartPositions.current[baseIdx + 2];

            // Rotate heart
            targets[targetIdx] = x * cosT - z * sinT;
            targets[targetIdx + 1] = y; 
            targets[targetIdx + 2] = x * sinT + z * cosT;
        }
        bufferGeometry.attributes.targetPosition.needsUpdate = true;
    }

    const lerpSpeed = (isSpecial ? 8 : 4) * delta; 
    const colorLerpSpeed = (isSpecial ? 8 : 2) * delta; 

    for (let i = 0; i < MAX_POINTS * 3; i++) {
        // Simple lerp
        positions[i] += (targets[i] - positions[i]) * lerpSpeed;
        colors[i] += (targetColors[i] - colors[i]) * colorLerpSpeed;
        
        // Jitter (only for visible particles, check Z to ensure we don't jitter hidden ones too much)
        if (text && i % 3 === 0 && targets[i+2] > -100) {
             positions[i] += (Math.random() - 0.5) * 0.005; 
             positions[i+1] += (Math.random() - 0.5) * 0.005;
             positions[i+2] += (Math.random() - 0.5) * 0.005;
        }
    }

    bufferGeometry.attributes.position.needsUpdate = true;
    bufferGeometry.attributes.color.needsUpdate = true;
    
    if (isSpecial && pointsRef.current) {
        pointsRef.current.rotation.y = THREE.MathUtils.lerp(pointsRef.current.rotation.y, Math.sin(state.clock.elapsedTime * 0.5) * 0.2, delta);
    } else if (text === 'CAKE' && pointsRef.current) {
        pointsRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.5;
    } else if (pointsRef.current) {
        pointsRef.current.rotation.y = THREE.MathUtils.lerp(pointsRef.current.rotation.y, 0, delta);
    }
  });

  return (
    <points ref={pointsRef} geometry={bufferGeometry}>
      <pointsMaterial
        ref={materialRef}
        size={0.14} 
        vertexColors
        transparent
        opacity={1}
        blending={THREE.NormalBlending} 
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
};