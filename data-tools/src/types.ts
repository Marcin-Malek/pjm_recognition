import { Hand } from "@tensorflow-models/hand-pose-detection";

export interface RawFrameData {
  frame: string;
  hands?: Hand[];
}

export type RawVideoData = RawFrameData[]; 

export interface FrameData extends RawFrameData {
  timestamp: number;
}

export type OptionalHandedness = 'Left' | 'Right' | 'Any' | undefined;

export interface Label {
  startSeconds: number;
  endSeconds: number;
  targetHand?: OptionalHandedness;
  mode: 'static' | 'dynamic';
  gesture: string;
}

export interface Source {
  url: string;
  fps?: number;
  labels?: Label[];
  generateIdle?: { static: boolean; dynamic: boolean };
  defaultHand: OptionalHandedness;
}

export interface Manifest {
  sources: Source[];
}