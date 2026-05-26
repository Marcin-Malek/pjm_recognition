import { LayersModel } from "@tensorflow/tfjs";

export interface Models {
  static: LayersModel | null;
  dynamic: LayersModel | null;
}

export interface DatasetEntry {
  label: string;
  data: number[] | number[][];
}

export interface StaticDatasetEntry extends DatasetEntry {
  data: number[];
}

export interface DynamicDatasetEntry extends DatasetEntry {
  data: number[][];
}

export interface DatasetStructure {
  static: StaticDatasetEntry[];
  dynamic: DynamicDatasetEntry[];
}

export enum BackgroundLabels {
  STATIC = 'IDLE_STAT',
  DYNAMIC = 'IDLE_DYN'
}

interface Keypoint {
    x: number;
    y: number;
    z?: number;
    score?: number;
    name?: string;
}

export type Keypoint3D = Keypoint & { z: number };

export const isKeypoint3D = (point: Keypoint): point is Keypoint3D => {
  return typeof point.z === 'number';
};