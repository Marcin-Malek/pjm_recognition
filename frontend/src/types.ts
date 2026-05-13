import type { Keypoint } from '@tensorflow-models/hand-pose-detection';
import type { LayersModel } from '@tensorflow/tfjs';

export type Keypoint3D = Keypoint & { z: number };

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

export type ModelsState = {
  static: LayersModel | null;
  dynamic: LayersModel | null;
};
