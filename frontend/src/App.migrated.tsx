import React, { useRef, useEffect, useState } from 'react';
import './App.css';
import './index.css';


function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [gestureType, setGestureType] = useState('static');
  const [isIdleRecording, setIsIdleRecording] = useState(false);
  const [recordingLabel, setRecordingLabel] = useState(null);
  const [recordingSequence, setRecordingSequence] = useState([]);
  const [datasetStatic, setDatasetStatic] = useState([]);
  const [datasetDynamic, setDatasetDynamic] = useState([]);
  const [prediction, setPrediction] = useState('Czekam na modele...');
  const [recordingIndicator, setRecordingIndicator] = useState('');
  const [btnTrainDisabled, setBtnTrainDisabled] = useState(true);
  const [btnExportDisabled, setBtnExportDisabled] = useState(true);
  const [btnIdleActive, setBtnIdleActive] = useState(false);
  const [counters, setCounters] = useState({});

  // Placeholder for TensorFlow.js and handPoseDetection
  useEffect(() => {
    // Load TF.js and handPoseDetection scripts dynamically
    const tfScript = document.createElement('script');
    tfScript.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs';
    tfScript.async = true;
    document.body.appendChild(tfScript);
    const handScript = document.createElement('script');
    handScript.src = 'https://cdn.jsdelivr.net/npm/@tensorflow-models/hand-pose-detection';
    handScript.async = true;
    document.body.appendChild(handScript);
    return () => {
      document.body.removeChild(tfScript);
      document.body.removeChild(handScript);
    };
  }, []);

  // ...
  // The rest of the logic (init, detectHands, event handlers, etc.)
  // should be migrated here as React hooks and functions.
  // ...

  return (
    <div>
      <h1>Rozpoznawanie PJM</h1>
      <div className="controls">
        <label htmlFor="gestureType" style={{ fontSize: 18, fontWeight: 'bold', marginRight: 10 }}>Tryb nagrywania:</label>
        <select id="gestureType" value={gestureType} onChange={e => setGestureType(e.target.value)}>
          <option value="static">📸 Gest Statyczny (np. A, B, C)</option>
          <option value="dynamic">🎬 Gest Dynamiczny (np. J, Z)</option>
        </select>
        <button
          className={`btn-idle${btnIdleActive ? ' active' : ''}`}
          onClick={() => setBtnIdleActive(!btnIdleActive)}
        >
          {btnIdleActive ? '⏹ Zatrzymaj nagrywanie' : 'Nagrywanie idle'}
        </button>
        <p style={{ margin: '10px 0 0 0', color: '#555' }}>
          Trzymaj literę na klawiaturze (np. <kbd>J</kbd>), aby nagrać konkretny gest.
        </p>
      </div>
      <div className="container">
        <div id="recordingIndicator" style={{ display: recordingIndicator ? 'block' : 'none' }}>{recordingIndicator}</div>
        <video ref={videoRef} width="640" height="480" playsInline style={{ display: 'none' }} />
        <canvas ref={canvasRef} width="640" height="480" />
        <div id="predictionContainer">
          <div className="hand-prediction">{prediction}</div>
        </div>
      </div>
      <div id="counters">
        {/* Render counters here */}
      </div>
      <button id="btnTrain" disabled={btnTrainDisabled}>Zbierz dane, aby wytrenować modele</button>
      <div className="btn-row">
        <input type="file" id="fileInput" accept=".json" style={{ display: 'none' }} />
        <button className="btn-import">📂 Wgraj Dataset</button>
        <button className="btn-export" disabled={btnExportDisabled}>💾 Pobierz Dataset (.json)</button>
      </div>
    </div>
  );
}

export default App;
