import { useState, useCallback, useRef, useEffect, useReducer } from 'react';
import type { ChangeEvent } from 'react';
import styled from 'styled-components';
import type { Hand } from '@tensorflow-models/hand-pose-detection';
import * as tf from '@tensorflow/tfjs';
import { IGNORE_DYNAMIC, IGNORE_STATIC, SEQUENCE_LENGTH } from '@pjm/shared/consts';
import { standardizeSequence } from '@pjm/shared/normalization';
import { useHandPose } from './hooks/useHandPose';
import { theme } from './utils/colors';
import { exportDataset, handleImportDataset } from './utils/files';
import { trainModels as runModelTraining } from './utils/modelTraining';
import { isKeypoint3D } from './utils/typeUtils';

const Container = styled.div`
  display: flex; 
  flex-direction: column; 
  align-items: center; 
  justify-content: center;
  min-height: 100vh; 
  background-color: ${theme.background}; 
  color: ${theme.text}; 
  font-family: sans-serif; 
  padding: 2rem;
`;
const Title = styled.h1`
  font-size: 3rem; 
  color: ${theme.primary}; 
  margin-bottom: 1rem;
`;
const VideoWrapper = styled.div`
  position: relative; 
  width: 640px; 
  height: 480px;
  background-color: black;
  border-radius: 12px; 
  overflow: hidden; 
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); 
  margin-bottom: 2rem;
  video, canvas { 
    position: absolute; 
    top: 0; 
    left: 0; 
    width: 100%; 
    height: 100%; 
  }
  video {
    transform: scaleX(-1); 
  }
  canvas { z-index: 10; }
`;
const ControlsPanel = styled.div`
  display: flex; 
  gap: 1rem; 
  align-items: center; 
  background: ${theme.surface}; 
  padding: 1.5rem;
  border-radius: 12px; 
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); 
  flex-wrap: wrap; 
  justify-content: center;
`;
const Select = styled.select`
  padding: 0.8rem; 
  font-size: 1.1rem; 
  border-radius: 8px; 
  background: ${theme.surface}; 
  color: ${theme.text};
  border: 2px solid ${theme.primary}; 
  outline: none; 
  cursor: pointer;
`;
const Button = styled.button<{ $variant?: 'record' | 'export' | 'clear' | 'train' | 'idle', $isActive?: boolean }>`
  background-color: ${(props) => {
    if (props.$variant === 'record') return props.$isActive ? theme.secondary : theme.primary;
    if (props.$variant === 'export') return theme.warning;
    if (props.$variant === 'clear') return theme.neutral;
    if (props.$variant === 'train') return theme.success;
    if (props.$variant === 'idle') return props.$isActive ? theme.secondary : theme.neutral;
    return theme.primary;
  }};
  color: white; 
  font-size: 1.1rem; 
  font-weight: bold; 
  padding: 0.8rem 1.5rem; 
  border: none;
  border-radius: 8px; 
  cursor: pointer; 
  transition: all 0.2s ease;
  &:disabled { 
    background-color: ${theme.disabled}; 
    cursor: not-allowed; 
    opacity: 0.7; 
  }
  &:hover:not(:disabled) { 
    transform: translateY(-2px); 
    filter: brightness(1.1); 
  }
`;
const BadgeContainer = styled.div`
  display: flex; 
  gap: 10px; 
  flex-wrap: wrap; 
  justify-content: center; 
  margin-top: 20px; 
  max-width: 800px;
`;
const Badge = styled.div<{ $type: 'static' | 'dynamic' }>`
  background: ${props => props.$type === 'static' ? theme.primary : theme.secondary};
  color: white; 
  padding: 8px 15px; 
  border-radius: 5px; 
  font-size: 1rem; 
  font-weight: bold; 
  display: flex; 
  align-items: center; gap: 10px;
`;
const DeleteBtn = styled.button`
  background: ${theme.badgeControlBg}; 
  border: none; 
  border-radius: 50%; 
  width: 24px; 
  height: 24px; 
  cursor: pointer; 
  color: white;
  &:hover { background: ${theme.deleteHighlight}; }
`;
const PredictionsOverlay = styled.div`
  position: absolute; 
  bottom: 20px; 
  left: 0; 
  width: 100%; 
  display: flex; 
  justify-content: center; 
  z-index: 20; 
  pointer-events: none; 
  gap: 10px;
`;
const PredictionBadge = styled.div`
  background: rgba(0,0,0,0.8); 
  color: white; 
  padding: 10px 20px; 
  border-radius: 8px; 
  font-size: 1.5rem; 
  font-weight: bold;
`;

const App = () => {
  const feedWidth = 640;
  const feedHeight = 480;

  const [isRecording, setIsRecording] = useState(false);
  const [isIdleRecording, setIsIdleRecording] = useState(false);
  const [currentLabel, setCurrentLabel] = useState<string | null>(null);
  const [recordMode, setRecordMode] = useState<'static' | 'dynamic'>('static');
  const [sequenceProgress, setSequenceProgress] = useState(0);
  const [isTraining, setIsTraining] = useState(false);

  const [, forceUpdate] = useReducer(x => x + 1, 0);

  const [models, setModels] = useState<{ static: tf.LayersModel | null, dynamic: tf.LayersModel | null }>({ static: null, dynamic: null });
  const [predictions, setPredictions] = useState<{ handedness: string, label: string, color: string }[]>([]);

  const datasetRef = useRef({ static: [] as any[], dynamic: [] as any[] });
  const sequenceBufferRef = useRef<number[][]>([]);
  const isRecordingRef = useRef(isRecording);
  const isIdleRecordingRef = useRef(isIdleRecording);
  const recordModeRef = useRef(recordMode);
  const currentLabelRef = useRef(currentLabel);
  const modelsRef = useRef(models);

  const liveBuffersRef = useRef<{ Left: number[][], Right: number[][] }>({ Left: [], Right: [] });
  const dynamicHoldsRef = useRef<{ [key: string]: { label: string, expires: number } }>({ Left: { label: '', expires: 0 }, Right: { label: '', expires: 0 } });

  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);
  useEffect(() => { isIdleRecordingRef.current = isIdleRecording; }, [isIdleRecording]);
  useEffect(() => { recordModeRef.current = recordMode; }, [recordMode]);
  useEffect(() => { currentLabelRef.current = currentLabel; }, [currentLabel]);
  useEffect(() => { modelsRef.current = models; }, [models]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || isIdleRecordingRef.current) return;
      if (/^[a-zA-Z]$/.test(e.key)) {
        setCurrentLabel(e.key.toUpperCase());
        setIsRecording(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (/^[a-zA-Z]$/.test(e.key) && !isIdleRecordingRef.current) {
        if (recordModeRef.current === 'dynamic' && sequenceBufferRef.current.length > 0) {
          const standardizedSeq = standardizeSequence(sequenceBufferRef.current, SEQUENCE_LENGTH);
          datasetRef.current.dynamic.push({ label: currentLabelRef.current, data: standardizedSeq });
          sequenceBufferRef.current = [];
          setSequenceProgress(0);
          forceUpdate();
        }
        setIsRecording(false);
        setCurrentLabel(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const handleDetection = useCallback((hands: Hand[]) => {
    if (hands.length === 0) {
      liveBuffersRef.current = { Left: [], Right: [] };
      setPredictions([]);
      return;
    }

    const currentPredictions: { handedness: string, label: string, color: string }[] = [];
    const now = Date.now();

    hands.forEach((hand, index) => {
      const { handedness } = hand;
      const isFirstHand = index === 0;

      const staticData: number[] = [];
      if (hand.keypoints3D) {
        const typedKeypoints = hand.keypoints3D.filter(isKeypoint3D);
        typedKeypoints.forEach(p => staticData.push(p.x, p.y, p.z));
      }
      const dynamicData = hand.keypoints.flatMap(kp => [kp.x / feedWidth, kp.y / feedHeight]);

      if ((isRecordingRef.current || isIdleRecordingRef.current) && currentLabelRef.current && isFirstHand) {
        if (recordModeRef.current === 'static') {
          datasetRef.current.static.push({ label: currentLabelRef.current, data: staticData });
          if (isIdleRecordingRef.current && datasetRef.current.static.length % 30 === 0) forceUpdate();
        } else {
          sequenceBufferRef.current.push(dynamicData);
          setSequenceProgress((sequenceBufferRef.current.length / SEQUENCE_LENGTH) * 100);

          if (isIdleRecordingRef.current && sequenceBufferRef.current.length >= SEQUENCE_LENGTH) {
            datasetRef.current.dynamic.push({ label: currentLabelRef.current, data: [...sequenceBufferRef.current] });
            sequenceBufferRef.current = [];
            setSequenceProgress(0);
            forceUpdate();
          }
        }
      }

      if (!isRecordingRef.current && !isIdleRecordingRef.current) {
        if (!liveBuffersRef.current[handedness as 'Left' | 'Right']) liveBuffersRef.current[handedness as 'Left' | 'Right'] = [];
        const buffer = liveBuffersRef.current[handedness as 'Left' | 'Right'];
        buffer.push(dynamicData);
        if (buffer.length > SEQUENCE_LENGTH) buffer.shift();

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
            const classesDynamic = [...new Set(datasetRef.current.dynamic.map(d => d.label))].sort();
            const predictedClass = classesDynamic[classIdx];

            if (maxScore > 0.8) {
              if (predictedClass === IGNORE_DYNAMIC) {
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
            const classesStatic = [...new Set(datasetRef.current.static.map(d => d.label))].sort();
            const predictedClass = classesStatic[scores.indexOf(maxScore)];

            if (maxScore > 0.9 && predictedClass !== IGNORE_STATIC) {
              finalPrediction = `${predictedClass}`;
              predictionColor = theme.primary;
            }
          }
        });

        currentPredictions.push({ handedness, label: finalPrediction, color: predictionColor });
      }
    });

    setPredictions(currentPredictions);
  }, []);

  const { videoRef, canvasRef } = useHandPose(handleDetection);

  const toggleIdleRecording = () => {
    if (isIdleRecording) {
      setIsIdleRecording(false);
      setCurrentLabel(null);
      forceUpdate();
    } else {
      const label = recordMode === 'static' ? IGNORE_STATIC : IGNORE_DYNAMIC;
      setCurrentLabel(label);
      sequenceBufferRef.current = [];
      setIsIdleRecording(true);
    }
  };

  const deleteData = (label: string, type: 'static' | 'dynamic') => {
    if (type === 'static') {
      datasetRef.current.static = datasetRef.current.static.filter(d => d.label !== label);
      setModels(prev => ({ ...prev, static: null }));
    } else {
      datasetRef.current.dynamic = datasetRef.current.dynamic.filter(d => d.label !== label);
      setModels(prev => ({ ...prev, dynamic: null }));
    }
    forceUpdate();
  };

  const trainModels = async () => {
    await runModelTraining(datasetRef, models, setModels, setIsTraining);
  };

  const handleExport = () => {
    exportDataset({ static: datasetRef.current.static, dynamic: datasetRef.current.dynamic });
  };

  const handleImport = (e: ChangeEvent<HTMLInputElement>) => {
    void handleImportDataset(e, datasetRef, setModels, forceUpdate);
  };

  const statsStatic = datasetRef.current.static.reduce((acc: any, val) => { acc[val.label] = (acc[val.label] || 0) + 1; return acc; }, {});
  const statsDynamic = datasetRef.current.dynamic.reduce((acc: any, val) => { acc[val.label] = (acc[val.label] || 0) + 1; return acc; }, {});
  const canTrain = Object.keys(statsStatic).length >= 2 || Object.keys(statsDynamic).length >= 2;

  return (
    <Container>
      <Title>Rozpoznawanie PJM</Title>

      <ControlsPanel style={{ marginBottom: '20px' }}>
        <Select value={recordMode} onChange={(e) => setRecordMode(e.target.value as any)}>
          <option value="static">📸 Tryb: Statyczny</option>
          <option value="dynamic">🎞️ Tryb: Dynamiczny</option>
        </Select>
        <Button $variant="idle" $isActive={isIdleRecording} onClick={toggleIdleRecording}>
          {isIdleRecording ? '⏹ Zatrzymaj Idle' : 'Nagrywaj tło (Idle)'}
        </Button>
        <p style={{ margin: 0, color: theme.muted }}>Trzymaj dowolną literę (np. A-Z) na klawiaturze, aby nagrać gest.</p>
      </ControlsPanel>

      {(isRecording || isIdleRecording) && currentLabel && (
        <h2 style={{ color: theme.recording, marginTop: 0 }}>
          🔴 Nagrywanie ({recordMode}): {currentLabel}
        </h2>
      )}

      <VideoWrapper>
        <video ref={videoRef} autoPlay playsInline muted width={feedWidth} height={feedHeight} />
        <canvas ref={canvasRef} width={feedWidth} height={feedHeight} />

        {recordMode === 'dynamic' && (isRecording || isIdleRecording) && (
          <div style={{ position: 'absolute', top: 0, left: 0, width: `${sequenceProgress}%`, height: '6px', background: theme.recording, zIndex: 30, transition: 'width 0.1s' }} />
        )}

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

      <ControlsPanel>
        <Button $variant="train" disabled={!canTrain || isTraining} onClick={trainModels}>
          {isTraining ? '⏳ Trenowanie...' : '🧠 Trenuj Modele'}
        </Button>

        <input type="file" accept=".json" style={{ display: 'none' }} id="import-btn" onChange={handleImport} />
        <Button $variant="clear" onClick={() => document.getElementById('import-btn')?.click()}>
          📂 Importuj
        </Button>

        <Button $variant="export" disabled={datasetRef.current.static.length === 0 && datasetRef.current.dynamic.length === 0} onClick={handleExport}>
          💾 Eksportuj
        </Button>
      </ControlsPanel>

      <BadgeContainer>
        {Object.entries(statsStatic).map(([label, count]) => (
          <Badge key={`s-${label}`} $type="static">
            {label}: {count as number} (Statyczny) <DeleteBtn onClick={() => deleteData(label, 'static')}>✖</DeleteBtn>
          </Badge>
        ))}
        {Object.entries(statsDynamic).map(([label, count]) => (
          <Badge key={`d-${label}`} $type="dynamic">
            {label}: {count as number} (Dynamiczny) <DeleteBtn onClick={() => deleteData(label, 'dynamic')}>✖</DeleteBtn>
          </Badge>
        ))}
      </BadgeContainer>

    </Container>
  );
};

export default App;