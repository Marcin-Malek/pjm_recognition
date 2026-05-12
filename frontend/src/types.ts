import type { Keypoint } from '@tensorflow-models/hand-pose-detection';

export type Keypoint3D = Keypoint & { z: number };

export interface DatasetEntry {
  label: string;
  data: number[] | number[][]; // Statyczny (płaski) lub Dynamiczny (sekwencja)
}

export interface Dataset {
  static: DatasetEntry[];
  dynamic: DatasetEntry[];
}
