import { useRef, useEffect, useState } from 'react';
import * as handPoseDetection from '@tensorflow-models/hand-pose-detection';
import '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';
import { fingerJoints } from '@pjm/shared/consts';

import type { MediaPipeHandsTfjsModelConfig, HandDetector, Hand } from '@tensorflow-models/hand-pose-detection';

export const useHandPose = (onDetection: (hands: Hand[]) => void) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [detector, setDetector] = useState<HandDetector | null>(null);

  useEffect(() => {
    const init = async () => {
      const model = handPoseDetection.SupportedModels.MediaPipeHands;
      const detectorConfig: MediaPipeHandsTfjsModelConfig = {
        runtime: 'tfjs',
        modelType: 'full',
        maxHands: 2,
      };
      const net = await handPoseDetection.createDetector(model, detectorConfig);
      setDetector(net);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, frameRate: 30 },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.width = 640;
        videoRef.current.height = 480;
      }
    };
    init();
  }, []);

  useEffect(() => {
    let animationId: number;
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
    detect();
    return () => cancelAnimationFrame(animationId);
  }, [detector, onDetection]);

  return { videoRef, canvasRef };
};