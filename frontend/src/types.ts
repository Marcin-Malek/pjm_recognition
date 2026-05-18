import type { LayersModel } from '@tensorflow/tfjs';

export type ModelsState = {
  static: LayersModel | null;
  dynamic: LayersModel | null;
};
