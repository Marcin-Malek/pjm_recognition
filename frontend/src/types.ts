import type { Keypoint } from '@tensorflow-models/hand-pose-detection';
import type { LayersModel } from '@tensorflow/tfjs';

export type Keypoint3D = Keypoint & { z: number };

export type ModelsState = {
  static: LayersModel | null;
  dynamic: LayersModel | null;
};
