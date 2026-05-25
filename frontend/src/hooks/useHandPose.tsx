import { useRef, useEffect } from 'react';
import * as handPoseDetection from '@tensorflow-models/hand-pose-detection';
import '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';
import { fingerJoints } from '@pjm/shared/consts';

import type { HandDetector, Hand } from '@tensorflow-models/hand-pose-detection';

let detector: HandDetector | null = import.meta.hot?.data?.detector || null;
let isInitializing = import.meta.hot?.data?.isInitializing || false;

if (import.meta.hot) {
  import.meta.hot.dispose((data) => {
    data.detector = detector;
    data.isInitializing = isInitializing;
  });
}

export const useHandPose = (onDetection: (hands: Hand[]) => void) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let animationId: number;
    const init = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, frameRate: 30 },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.width = 640;
        videoRef.current.height = 480;
      }
      if (detector) {
        detect();
        return;
      }
      if (isInitializing) {
        return;
      }
      isInitializing = true;
      try {
        detector = await handPoseDetection.createDetector(
          handPoseDetection.SupportedModels.MediaPipeHands,
          {
            runtime: 'mediapipe',
            solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/hands/',
            modelType: 'lite',
            maxHands: 2,
          },
          // {
          //   runtime: 'tfjs',
          //   modelType: 'full',
          //   maxHands: 2,
          // }
        );
        detect();
      } catch (error) {
        console.error('Error initializing hand pose detection:', error);
      } finally {
        isInitializing = false;
      }
    };
    const detect = async () => {
      if (detector && videoRef.current && canvasRef.current && videoRef.current.readyState === 4) {
        const hands = await detector.estimateHands(videoRef.current, { flipHorizontal: true });
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, 640, 480);

          if (hands.length > 0) {
            hands.forEach((hand) => {
              const { handedness } = hand;
              ctx.strokeStyle = handedness === 'Right' ? "#00FF00" : "#00BFFF";
              ctx.lineWidth = 2;
              fingerJoints.forEach((joints) => {
                for (let i = 0; i < joints.length - 1; i++) {
                  const p1 = hand.keypoints[joints[i]];
                  const p2 = hand.keypoints[joints[i + 1]];
                  
                  ctx.beginPath();
                  ctx.moveTo(p1.x, p1.y);
                  ctx.lineTo(p2.x, p2.y);
                  ctx.stroke();
                }
              });

              hand.keypoints.forEach((keypoint) => {
                ctx.beginPath();
                ctx.arc(keypoint.x, keypoint.y, 3, 0, 2 * Math.PI);
                ctx.fillStyle = '#FF0000';
                ctx.fill();
              });
            });

            onDetection(hands);
          }
        }
      }
      animationId = requestAnimationFrame(detect);
    };

    init();
    return () => cancelAnimationFrame(animationId);
  }, [onDetection]);

  return { videoRef, canvasRef };
};