import fs from 'fs';
import path from 'path';
import os from 'os';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';

import youtubedl from 'youtube-dl-exec';
import ffmpeg from 'fluent-ffmpeg';
import sharp from 'sharp';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-wasm';
import * as handPoseDetection from '@tensorflow-models/hand-pose-detection';
import { Manifest, RawVideoData } from './types';
import { getYouTubeId } from './helpers';

interface ProcessParams {
  youtubeUrl: string;
  outputJson: string;
  tempDir: string;
  fps: number;
}

interface WorkerDataInput {
  workerId: number;
  frames: string[];
}

// ============================================================================
// MAIN THREAD - Reads Manifest, Iterates Sources, Manages Workers
// ============================================================================
if (isMainThread) {
  function runWorker(workerData: WorkerDataInput): Promise<RawVideoData> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL(import.meta.url), { workerData });
      worker.on('message', resolve);
      worker.on('error', reject);
      worker.on('exit', (code) => {
        if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
      });
    });
  }

  async function downloadYouTubeVideo(url: string, outPath: string): Promise<string> {
    console.log(`Downloading video from ${url} to ${outPath}`);
    const downloadTimeLabel = `Downloading Finished`;
    console.time(downloadTimeLabel);
    await youtubedl(url, {
      output: outPath,
      format: 'bestvideo[ext=mp4]/best[ext=mp4]',
      noWarnings: true,
      noCheckCertificates: true,
    });
    console.timeEnd(downloadTimeLabel);
    return outPath;
  }

  async function extractFrames(videoPath: string, framesDir: string, fps: number): Promise<string[]> {
    return new Promise((resolve, reject) => {
      console.log(`Extracting frames from ${videoPath} at ${fps} FPS to ${framesDir}`);
      const frameExtractionTimeLabel = `Frame Extraction Finished`;
      console.time(frameExtractionTimeLabel);
      if (!fs.existsSync(framesDir)) fs.mkdirSync(framesDir, { recursive: true });
      
      ffmpeg(videoPath)
        .output(path.join(framesDir, 'frame-%05d.jpg'))
        .outputOptions([`-vf fps=${fps}`, '-q:v 2'])
        .on('end', () => {
          console.timeEnd(frameExtractionTimeLabel);
          const files = fs.readdirSync(framesDir)
            .filter(f => f.endsWith('.jpg'))
            .map(f => path.join(framesDir, f));
          resolve(files);
        })
        .on('error', reject)
        .run();
    });
  }

  async function processFramesWithWorkers(frameFiles: string[], numWorkers: number): Promise<RawVideoData> {
    console.log(`Processing ${frameFiles.length} frames using ${numWorkers} worker threads...`);
    const detectionTimeLabel = `ML Detection Finished (${numWorkers} workers)`;
    console.time(detectionTimeLabel);

    const chunkSize = Math.ceil(frameFiles.length / numWorkers);
    const workerPromises: Promise<RawVideoData>[] = [];

    for (let i = 0; i < numWorkers; i++) {
      const chunk = frameFiles.slice(i * chunkSize, (i + 1) * chunkSize);
      if (chunk.length > 0) {
        workerPromises.push(runWorker({ workerId: i + 1, frames: chunk }));
      }
    }
    const workerResults = await Promise.all(workerPromises);
    const finalResults = workerResults.flat();
    console.timeEnd(detectionTimeLabel);
    return finalResults;
  }

  async function processYouTubeVideo({ youtubeUrl, outputJson, tempDir, fps }: ProcessParams): Promise<void> {
    const totalTimeLabel = `Finished Processing (${getYouTubeId(youtubeUrl)})`;
    console.time(totalTimeLabel);

    const videoPath = path.join(tempDir, 'video.mp4');
    const framesDir = path.join(tempDir, 'frames');
    
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempDir, { recursive: true });

    await downloadYouTubeVideo(youtubeUrl, videoPath);
    const frameFiles = await extractFrames(videoPath, framesDir, fps);

    const numCores = Math.max(1, os.cpus().length - 1); // get number of CPU cores, reserve 1 for main thread
    const finalResults = await processFramesWithWorkers(frameFiles, numCores);

    console.log(`Saving results to ${outputJson}...`);
    const jsonSaveTimeLabel = `JSON Write Finished`;
    console.time(jsonSaveTimeLabel);

    fs.writeFileSync(outputJson, JSON.stringify(finalResults, null, 2));

    console.timeEnd(jsonSaveTimeLabel);

    // TODO: Consider keeping temp files for debugging or future use instead of deleting immediately
    if (fs.existsSync(tempDir)) { // Hardcoded cleanup
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    console.timeEnd(totalTimeLabel);
  }

  async function main() {
    const manifestPath = process.argv[2] || 'manifest.json';
    const outputDir = process.argv[3] || 'datasets/raw_youtube';

    if (!fs.existsSync(manifestPath)) {
      console.error(`ERROR: Manifest file not found at ${manifestPath}`);
      process.exit(1);
    }

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const manifest: Manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    console.log(`=== FOUND ${manifest.sources.length} SOURCES IN MANIFEST ===\n`);

    for (let i = 0; i < manifest.sources.length; i++) {
      const source = manifest.sources[i];
      const videoId = getYouTubeId(source.url);
      const outputJson = path.join(outputDir, `output-${videoId}.json`);
      const targetFps = source.fps || 30;

      console.log(`[${i + 1}/${manifest.sources.length}] Processing: ${videoId} @ ${targetFps} FPS`);

      if (fs.existsSync(outputJson)) {
        console.log(`Skipping: ${outputJson} already exists.\n`);
        continue;
      }

      try {
        await processYouTubeVideo({ 
          youtubeUrl: source.url, 
          outputJson: outputJson, 
          tempDir: `./tmp_${videoId}`, 
          fps: targetFps 
        });
        console.log(`Success: Saved to ${outputJson}\n`);
      } catch (err) {
        console.error(`ERROR processing ${videoId}:`, err);
      }
    }
    console.log(`=== BATCH EXTRACTION COMPLETE ===`);
  }

  if (import.meta.main) {
    main().catch(console.error);
  }
} else {
  // ============================================================================
  // WORKER THREAD - ML Inference isolated to a single CPU core
  // ============================================================================
  async function processWorkerChunk() {
    const { frames } = workerData as WorkerDataInput;
    const results: RawVideoData = [];

    await tf.setBackend('wasm');
    await tf.ready();
    
    const detector = await handPoseDetection.createDetector(
      handPoseDetection.SupportedModels.MediaPipeHands,
      { runtime: 'tfjs', modelType: 'full', maxHands: 2 }
    );

    for (const frame of frames) {
      const { data, info } = await sharp(frame)
        .removeAlpha() 
        .raw()
        .toBuffer({ resolveWithObject: true });
      
      const rgbTensor = tf.tensor3d(new Uint8Array(data), [info.height, info.width, 3], 'int32');

      try {
        const hands = await detector.estimateHands(rgbTensor, { flipHorizontal: true });
        results.push({ frame: path.basename(frame), hands });
      } finally {
        rgbTensor.dispose(); 
      }
    }

    if (parentPort) {
      parentPort.postMessage(results);
    }
  }
  
  processWorkerChunk().catch(err => {
    console.error(`[Worker ${(workerData as WorkerDataInput).workerId} Error]:`, err);
    process.exit(1);
  });
}