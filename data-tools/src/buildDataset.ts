import fs from 'fs';
import path from 'path';
import { standardizeSequence } from '@pjm/shared/normalization';
import { SEQUENCE_LENGTH } from '@pjm/shared/consts';
import { BackgroundLabels, isKeypoint3D, type DatasetStructure } from '@pjm/shared/types';
import type { Hand } from '@tensorflow-models/hand-pose-detection';
import { FrameData, Manifest, RawFrameData } from './types';
import { getYouTubeId } from './helpers';

function buildDataset(manifestPath: string, rawDataDir: string, outputDir: string) {
  console.time('[Time] Dataset Build');
  
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Manifest;
  const finalOutput: DatasetStructure = { static: [], dynamic: [] };

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, 'output.json');

  for (const source of manifest.sources) {
    const videoId = getYouTubeId(source.url);
    const rawFilePath = path.join(rawDataDir, `output-${videoId}.json`);
    
    if (!fs.existsSync(rawFilePath)) {
      console.warn(`[WARNING] Skipping ${videoId} - File not found at ${rawFilePath}`);
      continue;
    }

    const rawData = JSON.parse(fs.readFileSync(rawFilePath, 'utf8')) as RawFrameData[];
    const fps = source.fps || 30;
    
    const frames = rawData.map(dataPoint => {
      const match = dataPoint.frame.match(/frame-(\d+)\.jpg/);
      if (!match) return null;
      return {
        ...dataPoint,
        timestamp: (parseInt(match[1], 10) - 1) / fps
      };
    }).filter((f): f is FrameData => f !== null);

    const usedFrameTimestamps = new Set<number>();
    
    const hasLabels = Array.isArray(source.labels) && source.labels.length > 0;
    const generateIdle = source.generateIdle || { static: !hasLabels, dynamic: !hasLabels };
    const defaultHand = source.defaultHand || 'Any';

    if (hasLabels && source.labels) {
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
        }).filter((d): d is number[] => d !== null);

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
      
      // TODO: both hands case handling
      const targetHand = (defaultHand !== 'Any') 
        ? f.hands.find(h => h.handedness === defaultHand) 
        : f.hands[0];
        
      return targetHand || null; 
    }).filter((h): h is Hand => h !== null);

    if (generateIdle.static) {
      idleData.filter((_, i) => i % 10 === 0).forEach(hand => {
        if (hand.keypoints3D) {
          const typedKeypoints = hand.keypoints3D.filter(isKeypoint3D);
          finalOutput.static.push({ 
            label: BackgroundLabels.STATIC, 
            data: typedKeypoints.map(p => [p.x, p.y, p.z]).flat() 
          });
        }
      });
    }

    if (generateIdle.dynamic) {
      const flat2DList = idleData.map(h => h.keypoints.map(kp => [kp.x, kp.y]).flat());
      for (let i = 0; i < flat2DList.length - SEQUENCE_LENGTH; i += SEQUENCE_LENGTH) {
        const chunk = flat2DList.slice(i, i + SEQUENCE_LENGTH);
        if (chunk.length === SEQUENCE_LENGTH) {
           finalOutput.dynamic.push({ label: BackgroundLabels.DYNAMIC, data: chunk });
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

if (import.meta.main) {
  const manifestPath = process.argv[2] || 'manifest.json';
  const rawDataDir = process.argv[3] || './datasets/raw_youtube';
  const outPath = process.argv[4] || 'datasets/youtube';

  if (!fs.existsSync(manifestPath)) {
    console.error(`ERROR: Manifest file not found at ${manifestPath}`);
    process.exit(1);
  }

  buildDataset(manifestPath, rawDataDir, outPath);
}