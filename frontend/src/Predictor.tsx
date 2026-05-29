import { useState, useCallback, useRef, useEffect } from 'react';
import * as tf from '@tensorflow/tfjs';
import type { Hand } from '@tensorflow-models/hand-pose-detection';
import { SEQUENCE_LENGTH } from '@pjm/shared/consts';
import { BackgroundLabels, isKeypoint3D } from '@pjm/shared/types';
import type { Models } from '@pjm/shared/types'
import { useHandPose } from './hooks/useHandPose';
import { theme } from './utils/colors';
import { ModelsPanel } from './ModelsPanel';
import {
    Container,
    PredictionBadge,
    PredictionsOverlay,
    Title,
    VideoWrapper
} from './styled';

const Predictor = () => {
    const feedWidth = 640;
    const feedHeight = 480;

    const [models, setModels] = useState<Models>({ static: null, dynamic: null });
    const modelsRef = useRef(models);

    const [classes, setClasses] = useState<{static: string[], dynamic: string[]}>({static: [], dynamic: []});
    const classesRef = useRef(classes);

    const [predictions, setPredictions] = useState<{ handedness: string, label: string, color: string }[]>([]);

    const liveBuffersRef = useRef<{ Left: number[][], Right: number[][] }>({ Left: [], Right: [] });
    const dynamicHoldsRef = useRef<{ [key: string]: { label: string, expires: number } }>({ Left: { label: '', expires: 0 }, Right: { label: '', expires: 0 } });

    useEffect(() => { modelsRef.current = models; }, [models]);
    useEffect(() => { classesRef.current = classes; }, [classes]);

    const handleDetection = useCallback((hands: Hand[]) => {
        if (hands.length === 0) {
            liveBuffersRef.current = { Left: [], Right: [] };
            setPredictions([]);
            return;
        }

        const currentPredictions: { handedness: string, label: string, color: string }[] = [];
        const now = Date.now();

        hands.forEach((hand) => {
            const { handedness } = hand;

            const staticData: number[] = [];
            if (hand.keypoints3D) {
                const typedKeypoints = hand.keypoints3D.filter(isKeypoint3D);
                typedKeypoints.forEach(p => staticData.push(p.x, p.y, p.z));
            }
            const dynamicData = hand.keypoints.flatMap(kp => [kp.x / feedWidth, kp.y / feedHeight]);

            const buffer = liveBuffersRef.current[handedness];
            buffer.push(dynamicData);
            buffer.length > SEQUENCE_LENGTH && buffer.shift();

            let finalPrediction = "🤔";
            let predictionColor = "gray";
            let dynamicFound = false;

            tf.tidy(() => {
                if (dynamicHoldsRef.current[handedness]?.expires > now) {
                    finalPrediction = dynamicHoldsRef.current[handedness].label;
                    predictionColor = theme.secondary;
                    dynamicFound = true;
                }

                if (!dynamicFound && modelsRef.current.dynamic && buffer.length === SEQUENCE_LENGTH) {
                    const inputTensor = tf.tensor3d([buffer], [1, SEQUENCE_LENGTH, 42]);
                    const prediction = modelsRef.current.dynamic.predict(inputTensor) as tf.Tensor;
                    const scores = Array.from(prediction.dataSync());
                    const maxScore = Math.max(...scores);
                    const classIdx = scores.indexOf(maxScore);
                    // const classesDynamic = [...new Set(datasetRef.current.dynamic.map(d => d.label))].sort();
                    const predictedClass = classesRef.current.dynamic[classIdx];

                    if (maxScore > 0.8) {
                        if (predictedClass === BackgroundLabels.DYNAMIC) {
                            liveBuffersRef.current[handedness as 'Left' | 'Right'] = [];
                        } else {
                            finalPrediction = `${predictedClass}`;
                            dynamicHoldsRef.current[handedness] = { label: finalPrediction, expires: now + 1500 };
                            predictionColor = theme.secondary;
                            dynamicFound = true;
                            liveBuffersRef.current[handedness as 'Left' | 'Right'] = [];
                        }
                    }
                }

                if (!dynamicFound && modelsRef.current.static && staticData.length > 0) {
                    const inputTensor = tf.tensor2d([staticData]);
                    const prediction = modelsRef.current.static.predict(inputTensor) as tf.Tensor;
                    const scores = Array.from(prediction.dataSync());
                    const maxScore = Math.max(...scores);
                    const predictedClass = classesRef.current.static[scores.indexOf(maxScore)];

                    if (maxScore > 0.9 && predictedClass !== BackgroundLabels.STATIC) {
                        finalPrediction = `${predictedClass}`;
                        predictionColor = theme.primary;
                    }
                }
            });

            currentPredictions.push({ handedness, label: finalPrediction, color: predictionColor });
        });

        setPredictions(currentPredictions);
    }, [classesRef]);

    const { videoRef, canvasRef } = useHandPose(handleDetection);

    return (
        <Container>
            <Title>Rozpoznawanie PJM</Title>

            <VideoWrapper>
                <video ref={videoRef} autoPlay playsInline muted width={feedWidth} height={feedHeight} />
                <canvas ref={canvasRef} width={feedWidth} height={feedHeight} />
                {predictions.length > 0 && (
                    <PredictionsOverlay>
                        {predictions.map((p, idx) => (
                            <PredictionBadge key={idx} style={{ color: p.color }}>
                                {p.handedness === 'Left' ? 'Lewa' : 'Prawa'}: {p.label}
                            </PredictionBadge>
                        ))}
                    </PredictionsOverlay>
                )}
            </VideoWrapper>
            <ModelsPanel models={models} setModels={setModels} setLabels={setClasses} />
        </Container>
    );
};

export default Predictor;