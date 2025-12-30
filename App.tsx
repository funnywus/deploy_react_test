import React, { useState, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { SceneContent } from './components/SceneContent';
import { GestureState } from './types';
import { Fullscreen, Minimize } from 'lucide-react';
import { WebcamHandler } from './components/WebcamHandler';

// Augment JSX namespace to include HTML elements
declare global {
  namespace JSX {
    interface IntrinsicElements {
      div: any;
      button: any;
    }
  }
}

// Helper to determine text based on stage (finger count)
const getLabel = (stage: number) => {
  switch (stage) {
    case 0: return 'CAKE'; // Internal keyword for standby mode
    case 1: return '马到成功';
    case 2: return '马年行大运';
    case 3: return '新年新气象';
    case 4: return '未来可期';
    case 5: return '2026 诸事顺遂';
    default: return '';
  }
};

export default function App() {
  const [activeStage, setActiveStage] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  }, []);

  // Handle updates from the webcam hand tracking
  const handleGestureUpdate = useCallback((fingerCount: number, isHandDetected: boolean) => {
    if (isHandDetected) {
      const targetStage = Math.min(fingerCount, 5);
      setActiveStage(prev => {
        if (prev === targetStage) return prev;
        return targetStage;
      });
    } else {
      setActiveStage(prev => (prev === 0 ? 0 : 0));
    }
  }, []);

  // Construct state for the 3D scene
  const gestureState: GestureState = {
    fingerCount: activeStage,
    isHandDetected: true,
    label: getLabel(activeStage)
  };

  return (
    <div className="relative w-full h-full bg-black overflow-hidden select-none font-sans">
      
      {/* Webcam Input (Hidden) */}
      <WebcamHandler onGestureUpdate={handleGestureUpdate} onCameraReady={() => {}} />

      {/* 3D Canvas */}
      <div className="absolute inset-0 z-0">
        <Canvas
          camera={{ position: [0, 0, 24], fov: 45 }}
          gl={{ antialias: true, alpha: false }}
          dpr={[1, 2]}
        >
          <SceneContent gestureState={gestureState} />
        </Canvas>
      </div>

      {/* Top Right: Controls */}
      <div className="absolute top-0 right-0 p-4 z-50 flex gap-2 opacity-70 hover:opacity-100 transition-opacity">
        <button
          onClick={toggleFullscreen}
          className="bg-white/10 backdrop-blur-md hover:bg-white/20 text-white p-3 rounded-full transition-all duration-300 border border-white/10"
        >
          {isFullscreen ? <Minimize size={24} /> : <Fullscreen size={24} />}
        </button>
      </div>
      
      {/* Hint Text */}
      <div className="absolute bottom-10 w-full text-center text-white/50 text-sm pointer-events-none tracking-widest uppercase font-serif leading-loose">
        <div>对准摄像头</div>
        <div>依次伸出1-5根手指，见证惊喜</div>
      </div>
    </div>
  );
}