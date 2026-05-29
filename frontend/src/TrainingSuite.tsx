import { useState, useCallback, useRef, useEffect } from 'react';
import type { ChangeEvent } from 'react';
import * as tf from '@tensorflow/tfjs';
import type { Hand } from '@tensorflow-models/hand-pose-detection';
import { SEQUENCE_LENGTH } from '@pjm/shared/consts';
import { BackgroundLabels, isKeypoint3D } from '@pjm/shared/types';
import type { DatasetStructure, Models } from '@pjm/shared/types'
import { standardizeSequence } from '@pjm/shared/normalization';
import { trainModels } from '@pjm/shared/training';
import { useHandPose } from './hooks/useHandPose';
import { theme } from './utils/colors';
import { exportDataset, exportModels, handleImportDataset } from './utils/files';
import { 
  Badge, 
  BadgeContainer, 
  Button, 
  Container, 
  ControlsPanel,
  DeleteBtn, 
  PredictionBadge, 
  PredictionsOverlay, 
  Select, 
  Title, 
  VideoWrapper } from './styled';

// TODO: cleanup and modularize this component, enable training on external source data, 
const TrainingSuite = () => {
  // TODO: add RWD handling
  const feedWidth = 640;
  const feedHeight = 480;

  const [isRecording, setIsRecording] = useState(false);
  const [isIdleRecording, setIsIdleRecording] = useState(false);
  const [currentLabel, setCurrentLabel] = useState<string | null>(null);
  const [recordMode, setRecordMode] = useState<'static' | 'dynamic'>('static');
  const [sequenceProgress, setSequenceProgress] = useState(0);
  const [isTraining, setIsTraining] = useState(false);

  const isRecordingRef = useRef(isRecording);
  const isIdleRecordingRef = useRef(isIdleRecording);
  const currentLabelRef = useRef(currentLabel);
  const recordModeRef = useRef(recordMode);
  
  const [datasetInfo, setDatasetInfo] = useState({
    staticStats: {} as Record<string, number>,
    dynamicStats: {} as Record<string, number>,
    staticCount: 0,
    dynamicCount: 0,
  });
  
  const [models, setModels] = useState<Models>({ static: null, dynamic: null });
  const modelsRef = useRef(models);
  
  const [predictions, setPredictions] = useState<{ handedness: string, label: string, color: string }[]>([]);

  const datasetRef = useRef<DatasetStructure>({ static: [], dynamic: []});
  const sequenceBufferRef = useRef<number[][]>([]);

  const liveBuffersRef = useRef<{ Left: number[][], Right: number[][] }>({ Left: [], Right: [] });
  const dynamicHoldsRef = useRef<{ [key: string]: { label: string, expires: number } }>({ Left: { label: '', expires: 0 }, Right: { label: '', expires: 0 } });

  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);
  useEffect(() => { isIdleRecordingRef.current = isIdleRecording; }, [isIdleRecording]);
  useEffect(() => { recordModeRef.current = recordMode; }, [recordMode]);
  useEffect(() => { currentLabelRef.current = currentLabel; }, [currentLabel]);
  useEffect(() => { modelsRef.current = models; }, [models]);

  const refreshDatasetUI = useCallback(() => {
    const sStatic = datasetRef.current.static.reduce((acc: Record<string, number>, val) => { 
      acc[val.label] = (acc[val.label] || 0) + 1; 
      return acc; 
    }, {});
    const sDynamic = datasetRef.current.dynamic.reduce((acc: Record<string, number>, val) => { 
      acc[val.label] = (acc[val.label] || 0) + 1; 
      return acc; 
    }, {});

    setDatasetInfo({
      staticStats: sStatic,
      dynamicStats: sDynamic,
      staticCount: datasetRef.current.static.length,
      dynamicCount: datasetRef.current.dynamic.length
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || isIdleRecordingRef.current) {
        return;
      }
      if (/^[a-zA-Z]$/.test(e.key)) {
        setCurrentLabel(e.key.toUpperCase());
        setIsRecording(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (/^[a-zA-Z]$/.test(e.key) && !isIdleRecordingRef.current) {
        if (recordModeRef.current === 'dynamic' && currentLabelRef.current !== null && sequenceBufferRef.current.length > 0) {
          const standardizedSeq = standardizeSequence(sequenceBufferRef.current, SEQUENCE_LENGTH);
          datasetRef.current.dynamic.push({ label: currentLabelRef.current, data: standardizedSeq });
          sequenceBufferRef.current = [];
          setSequenceProgress(0);
        }
        refreshDatasetUI();

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
  }, [refreshDatasetUI]);

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
          isIdleRecordingRef.current && datasetRef.current.static.length % 30 === 0 && refreshDatasetUI();
        } else {
          sequenceBufferRef.current.push(dynamicData);
          setSequenceProgress((sequenceBufferRef.current.length / SEQUENCE_LENGTH) * 100);

          if (isIdleRecordingRef.current && sequenceBufferRef.current.length >= SEQUENCE_LENGTH) {
            datasetRef.current.dynamic.push({ label: currentLabelRef.current, data: [...sequenceBufferRef.current] });
            sequenceBufferRef.current = [];
            setSequenceProgress(0);
            refreshDatasetUI();
          }
        }
      }

      if (!isRecordingRef.current && !isIdleRecordingRef.current) {
        // TODO: Consider removing this
        // if (!liveBuffersRef.current[handedness as 'Left' | 'Right']) {
        //   liveBuffersRef.current[handedness as 'Left' | 'Right'] = [];
        // }
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
            const classesDynamic = [...new Set(datasetRef.current.dynamic.map(d => d.label))].sort();
            const predictedClass = classesDynamic[classIdx];

            if (maxScore > 0.8) {
              if (predictedClass === BackgroundLabels.DYNAMIC) {
                liveBuffersRef.current[handedness] = [];
              } else {
                finalPrediction = `${predictedClass}`;
                dynamicHoldsRef.current[handedness] = { label: finalPrediction, expires: now + 1500 };
                predictionColor = theme.secondary;
                dynamicFound = true;
                liveBuffersRef.current[handedness] = [];
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

            if (maxScore > 0.9 && predictedClass !== BackgroundLabels.STATIC) {
              finalPrediction = `${predictedClass}`;
              predictionColor = theme.primary;
            }
          }
        });

        currentPredictions.push({ handedness, label: finalPrediction, color: predictionColor });
      }
    });

    setPredictions(currentPredictions);
  }, [refreshDatasetUI]);

  const { videoRef, canvasRef } = useHandPose(handleDetection);

  const toggleIdleRecording = () => {
    if (isIdleRecording) {
      setIsIdleRecording(false);
      setCurrentLabel(null);
      refreshDatasetUI();
    } else {
      const label = recordMode === 'static' ? BackgroundLabels.STATIC : BackgroundLabels.DYNAMIC;
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
    refreshDatasetUI();
  };

  const handleTrainModels = async () => {
    setIsTraining(true); 
  
    try {
      const updatedModels = await trainModels(datasetRef.current, models);
      setModels(updatedModels);
    } catch (error) {
      console.error("Error during model training:", error);
    } finally {
      setIsTraining(false); 
    }
  };

  const handleExport = () => {
    exportDataset({ static: datasetRef.current.static, dynamic: datasetRef.current.dynamic });
    exportModels(models);
  };

  const handleImport = (e: ChangeEvent<HTMLInputElement>) => {
    void handleImportDataset(e, datasetRef, setModels, refreshDatasetUI);
  };

  const canTrain = Object.keys(datasetInfo.staticStats).length >= 2 || Object.keys(datasetInfo.dynamicStats).length >= 2;

  return (
    <Container>
      <Title>Rozpoznawanie PJM</Title>

      <ControlsPanel style={{ marginBottom: '20px' }}>
        <Select value={recordMode} onChange={(e) => setRecordMode(e.target.value as typeof recordMode)}>
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
        <Button $variant="train" disabled={!canTrain || isTraining} onClick={handleTrainModels}>
          {isTraining ? '⏳ Trenowanie...' : '🧠 Trenuj Modele'}
        </Button>

        <input type="file" accept=".json" style={{ display: 'none' }} id="import-btn" onChange={handleImport} />
        <Button $variant="clear" onClick={() => document.getElementById('import-btn')?.click()}>
          📂 Importuj
        </Button>

        <Button $variant="export" disabled={datasetInfo.staticCount === 0 && datasetInfo.dynamicCount === 0} onClick={handleExport}>
          💾 Eksportuj
        </Button>
      </ControlsPanel>

      <BadgeContainer>
        {Object.entries(datasetInfo.staticStats).map(([label, count]) => (
          <Badge key={`s-${label}`} $type="static">
            {label}: {count} (Statyczny) <DeleteBtn onClick={() => deleteData(label, 'static')}>✖</DeleteBtn>
          </Badge>
        ))}
        {Object.entries(datasetInfo.dynamicStats).map(([label, count]) => (
          <Badge key={`d-${label}`} $type="dynamic">
            {label}: {count} (Dynamiczny) <DeleteBtn onClick={() => deleteData(label, 'dynamic')}>✖</DeleteBtn>
          </Badge>
        ))}
      </BadgeContainer>

    </Container>
  );
};

export default TrainingSuite;