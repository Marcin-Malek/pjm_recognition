const fs = require('fs');
const path = require('path');

const SEQUENCE_LENGTH = 30;

function getYouTubeId(url) {
  const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
  return match ? match[1] : 'unknown';
}

function standardizeSequence(seq, targetLength) {
  if (seq.length === 0) return new Array(targetLength).fill(new Array(42).fill(0));
  if (seq.length === targetLength) return seq;
  const result = [];
  if (seq.length < targetLength) {
    result.push(...seq);
    const last = seq[seq.length - 1];
    while (result.length < targetLength) result.push(last);
  } else {
    const step = (seq.length - 1) / (targetLength - 1);
    for (let i = 0; i < targetLength; i++) {
      result.push(seq[Math.round(i * step)]);
    }
  }
  return result;
}

function buildDataset(manifestPath, rawDataDir, outputPath) {
  console.time('[Time] Dataset Build');
  
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const finalOutput = { static: [], dynamic: [] };

  for (const source of manifest.sources) {
    const videoId = getYouTubeId(source.url);
    const rawFilePath = path.join(rawDataDir, `output-${videoId}.json`);
    
    if (!fs.existsSync(rawFilePath)) {
      console.warn(`[WARNING] Skipping ${videoId} - File not found at ${rawFilePath}`);
      continue;
    }

    const rawData = JSON.parse(fs.readFileSync(rawFilePath, 'utf8'));
    const fps = source.fps || 30;
    
    const frames = rawData.map(dataPoint => {
      const match = dataPoint.frame.match(/frame-(\d+)\.jpg/);
      if (!match) return null;
      return {
        ...dataPoint,
        timestamp: (parseInt(match[1], 10) - 1) / fps
      };
    }).filter(Boolean);

    let usedFrameTimestamps = new Set();
    
    const hasLabels = Array.isArray(source.labels) && source.labels.length > 0;
    const generateIdle = source.generateIdle || { static: !hasLabels, dynamic: !hasLabels };
    const defaultHand = source.defaultHand || 'Any';

    if (hasLabels) {
      for (const label of source.labels) {
        const windowFrames = frames.filter(f => f.timestamp >= label.startSeconds && f.timestamp <= label.endSeconds);
        windowFrames.forEach(f => usedFrameTimestamps.add(f.timestamp));

        const reqHand = label.targetHand || 'Any';

        const extractedData = windowFrames.map(f => {
          if (!f.hands || f.hands.length === 0) return null;
          
          const targetHand = (reqHand !== 'Any') 
            ? f.hands.find(h => h.handedness === reqHand) 
            : f.hands[0];
          
          if (!targetHand) return null; 

          if (label.mode === 'static') {
            return targetHand.keypoints3D ? targetHand.keypoints3D.map(p => [p.x, p.y, p.z]).flat() : null;
          } else {
            return targetHand.keypoints.map(kp => [kp.x, kp.y]).flat();
          }
        }).filter(Boolean);

        if (extractedData.length === 0) continue;

        if (label.mode === 'static') {
          extractedData.forEach(dataArray => {
            finalOutput.static.push({ label: label.gesture, data: dataArray });
          });
        } else if (label.mode === 'dynamic') {
          const standardized = standardizeSequence(extractedData, SEQUENCE_LENGTH);
          finalOutput.dynamic.push({ label: label.gesture, data: standardized });
        }
      }
    }

    const idleFrames = frames.filter(f => !usedFrameTimestamps.has(f.timestamp));
    
    const idleData = idleFrames.map(f => {
      if (!f.hands || f.hands.length === 0) return null;
      
      const targetHand = (defaultHand !== 'Any') 
        ? f.hands.find(h => h.handedness === defaultHand) 
        : f.hands[0];
        
      return targetHand; 
    }).filter(Boolean);

    if (generateIdle.static) {
      idleData.filter((_, i) => i % 10 === 0).forEach(hand => {
        if (hand.keypoints3D) {
          finalOutput.static.push({ 
            label: 'IDLE_STAT', 
            data: hand.keypoints3D.map(p => [p.x, p.y, p.z]).flat() 
          });
        }
      });
    }

    if (generateIdle.dynamic) {
      const flat2DList = idleData.map(h => h.keypoints.map(kp => [kp.x, kp.y]).flat());
      for (let i = 0; i < flat2DList.length - SEQUENCE_LENGTH; i += SEQUENCE_LENGTH) {
        const chunk = flat2DList.slice(i, i + SEQUENCE_LENGTH);
        if (chunk.length === SEQUENCE_LENGTH) {
           finalOutput.dynamic.push({ label: 'IDLE_DYN', data: chunk });
        }
      }
    }
  }

  fs.writeFileSync(outputPath, JSON.stringify(finalOutput, null, 2));
  
  console.log(`\n=== BUILD COMPLETE ===`);
  console.log(`Static Entries: ${finalOutput.static.length}`);
  console.log(`Dynamic Sequences: ${finalOutput.dynamic.length}`);
  console.log(`Saved to: ${outputPath}`);
  console.timeEnd('[Time] Dataset Build');
}

if (require.main === module) {
  const manifestPath = process.argv[2] || 'manifest.json';
  const rawDataDir = process.argv[3] || './datasets/raw_youtube';
  const outPath = process.argv[4] || 'datasets/youtube/output.json';

  if (!fs.existsSync(manifestPath)) {
    console.error(`ERROR: Manifest file not found at ${manifestPath}`);
    process.exit(1);
  }

  buildDataset(manifestPath, rawDataDir, outPath);
}