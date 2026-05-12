import type { Keypoint } from "@tensorflow-models/hand-pose-detection";
import type { Keypoint3D } from "../types";

export const isKeypoint3D = (point: Keypoint): point is Keypoint3D => {
  return typeof point.z === 'number';
};