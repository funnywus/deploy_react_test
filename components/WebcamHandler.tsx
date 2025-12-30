import React, { useEffect, useRef } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

// Augment JSX namespace to include HTML elements
declare global {
  namespace JSX {
    interface IntrinsicElements {
      video: any;
    }
  }
}

interface WebcamHandlerProps {
  onGestureUpdate: (fingerCount: number, isHandDetected: boolean) => void;
  onCameraReady: () => void;
}

export const WebcamHandler: React.FC<WebcamHandlerProps> = ({ onGestureUpdate, onCameraReady }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastVideoTimeRef = useRef<number>(-1);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const requestRef = useRef<number>(0);
  const isLoopRunningRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);

  // Robust prediction loop starter
  const startPredictionLoop = () => {
    if (isLoopRunningRef.current || !isMountedRef.current) return;
    isLoopRunningRef.current = true;
    predictWebcam();
  };

  useEffect(() => {
    isMountedRef.current = true;
    let stream: MediaStream | null = null;

    const setupCamera = async () => {
      try {
        // 1. Initialize MediaPipe
        // Using CPU delegate to prevent WebGL context loss on mobile devices when running alongside Three.js
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        );
        
        if (!isMountedRef.current) return;

        handLandmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "CPU" 
          },
          runningMode: "VIDEO",
          numHands: 1,
          minHandDetectionConfidence: 0.6, 
          minHandPresenceConfidence: 0.6,
          minTrackingConfidence: 0.6
        });

        if (!isMountedRef.current) return;

        // 2. Setup Camera
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            stream = await navigator.mediaDevices.getUserMedia({
                video: {
                  facingMode: 'user',
                  width: { ideal: 640 }, // 640x480 is sufficient for hand tracking and easier on CPU
                  height: { ideal: 480 },
                  frameRate: { ideal: 30 }
                },
                audio: false
            });

            if (!isMountedRef.current) {
                stream.getTracks().forEach(t => t.stop());
                return;
            }

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                
                // Explicitly play video to trigger events reliably on all platforms
                videoRef.current.play().then(() => {
                    startPredictionLoop();
                    onCameraReady();
                }).catch(e => {
                    console.warn("Autoplay blocked or failed:", e);
                    // Even if autoplay fails, events might still trigger if user interacted, 
                    // or we can rely on onLoadedData
                });

                // Also call onCameraReady immediately when stream is assigned to minimize UI delay
                onCameraReady();
            }
        }
      } catch (err) {
        console.error("Initialization Error:", err);
      }
    };

    setupCamera();

    return () => {
      isMountedRef.current = false;
      isLoopRunningRef.current = false;
      cancelAnimationFrame(requestRef.current);
      
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (handLandmarkerRef.current) {
          handLandmarkerRef.current.close();
          handLandmarkerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const predictWebcam = () => {
    if (!isMountedRef.current) return;
    
    // Schedule next frame
    requestRef.current = requestAnimationFrame(predictWebcam);

    if (!handLandmarkerRef.current || !videoRef.current) return;

    // Check if video is ready
    if (videoRef.current.videoWidth > 0 && videoRef.current.videoHeight > 0) {
        let startTimeMs = performance.now();
        
        if (videoRef.current.currentTime !== lastVideoTimeRef.current) {
          lastVideoTimeRef.current = videoRef.current.currentTime;
          
          try {
              const results = handLandmarkerRef.current.detectForVideo(videoRef.current, startTimeMs);
              
              if (results.landmarks && results.landmarks.length > 0) {
                const count = countFingers(results.landmarks[0]);
                onGestureUpdate(count, true);
              } else {
                onGestureUpdate(0, false);
              }
          } catch (e) {
              // Ignore transient errors during stream initialization or tab switching
          }
        }
    }
  };

  const countFingers = (landmarks: any[]) => {
    const wrist = landmarks[0];
    let count = 0;

    // Tips: Index(8), Middle(12), Ring(16), Pinky(20)
    // PIPs: Index(6), Middle(10), Ring(14), Pinky(18)
    
    const isFingerExtended = (tipIdx: number, pipIdx: number) => {
       const tip = landmarks[tipIdx];
       const pip = landmarks[pipIdx];
       
       const dTip = (tip.x - wrist.x)**2 + (tip.y - wrist.y)**2;
       const dPip = (pip.x - wrist.x)**2 + (pip.y - wrist.y)**2;
       // Tip further from wrist than PIP
       return dTip > (dPip * 1.1); 
    };

    if (isFingerExtended(8, 6)) count++;
    if (isFingerExtended(12, 10)) count++;
    if (isFingerExtended(16, 14)) count++;
    if (isFingerExtended(20, 18)) count++;

    // Thumb logic
    const thumbTip = landmarks[4];
    const thumbIp = landmarks[3];
    const pinkyMcp = landmarks[17];
    
    const distSq = (p1: any, p2: any) => (p1.x - p2.x)**2 + (p1.y - p2.y)**2;
    
    // Check if thumb tip is further from pinky base than thumb joint
    if (distSq(thumbTip, pinkyMcp) > (distSq(thumbIp, pinkyMcp) * 1.1)) {
        count++;
    }

    return count;
  };

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      // Multiple event listeners to guarantee the loop starts
      onLoadedData={startPredictionLoop}
      onCanPlay={startPredictionLoop}
      onPlaying={startPredictionLoop}
      className="absolute bottom-0 left-0 w-32 h-24 opacity-0 pointer-events-none"
    />
  );
};