export interface GestureState {
  fingerCount: number;
  isHandDetected: boolean;
  label: string;
}

export type ParticleData = {
  x: number;
  y: number;
  z: number;
  origX: number;
  origY: number;
  origZ: number;
  color: [number, number, number];
};
