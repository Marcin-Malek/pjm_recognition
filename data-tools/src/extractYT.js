const fs = require('fs');
const path = require('path');
const os = require('os');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

function getYouTubeId(url) {
  const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
  return match ? match[1] : 'unknown';
}

// ============================================================================
// MAIN THREAD - Reads Manifest, Iterates Sources, Manages Workers
// ============================================================================
if (isMainThread) {
  const youtubedl = require('youtube-dl-exec');
  const ffmpeg = require('fluent-ffmpeg');

  async function downloadYouTubeVideo(url, outPath) {
    console.log(`Downloading video from ${url} to ${outPath}`);
    console.time('[Time] Download');
    await youtubedl(url, {
      output: outPath,
      format: 'bestvideo[ext=mp4]/best[ext=mp4]',
      noWarnings: true,
      noCheckCertificates: true,
    });
    console.timeEnd('[Time] Download');
    return outPath;
  }

  async function extractFrames(videoPath, framesDir, fps) {
    return new Promise((resolve, reject) => {
      console.time('[Time] Frame Extraction');
      console.log(`Extracting frames from ${videoPath} at ${fps} FPS to ${framesDir}`);
      if (!fs.existsSync(framesDir)) fs.mkdirSync(framesDir, { recursive: true });
      
      ffmpeg(videoPath)
        .output(path.join(framesDir, 'frame-%05d.jpg'))
        .outputOptions([`-vf fps=${fps}`, '-q:v 2'])
        .on('end', () => {
          console.timeEnd('[Time] Frame Extraction');
          const files = fs.readdirSync(framesDir)
            .filter(f => f.endsWith('.jpg'))
            .map(f => path.join(framesDir, f));
          resolve(files);
        })
        .on('error', reject)
        .run();
    });
  }

  function runWorker(workerData) {
    return new Promise((resolve, reject) => {
      const worker = new Worker(__filename, { workerData });
      worker.on('message', resolve);
      worker.on('error', reject);
      worker.on('exit', (code) => {
        if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
      });
    });
  }

  async function processYouTubeVideo({ youtubeUrl, outputJson, tempDir, fps }) {
    console.time(`[Time] Total Execution (${getYouTubeId(youtubeUrl)})`);

    const videoPath = path.join(tempDir, 'video.mp4');
    const framesDir = path.join(tempDir, 'frames');
    
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
    fs.mkdirSync(tempDir, { recursive: true });

    await downloadYouTubeVideo(youtubeUrl, videoPath);
    const frameFiles = await extractFrames(videoPath, framesDir, fps);

    const numCores = Math.max(1, os.cpus().length - 1); 
    console.log(`Processing ${frameFiles.length} frames using ${numCores} worker threads...`);
    console.time(`[Time] ML Detection (${numCores} workers)`);

    const chunkSize = Math.ceil(frameFiles.length / numCores);
    const workerPromises = [];

    for (let i = 0; i < numCores; i++) {
      const chunk = frameFiles.slice(i * chunkSize, (i + 1) * chunkSize);
      if (chunk.length > 0) {
        workerPromises.push(runWorker({ workerId: i + 1, frames: chunk }));
      }
    }

    const workerResults = await Promise.all(workerPromises);
    const finalResults = workerResults.flat();
    console.timeEnd(`[Time] ML Detection (${numCores} workers)`);

    console.time(`[Time] JSON Save`);
    console.log(`Saving results to ${outputJson}...`);
    fs.writeFileSync(outputJson, JSON.stringify(finalResults, null, 2));
    console.timeEnd(`[Time] JSON Save`);

    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });

    console.timeEnd(`[Time] Total Execution (${getYouTubeId(youtubeUrl)})`);
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

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
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

  main().catch(console.error);

} 
// ============================================================================
// WORKER THREAD - ML Inference isolated to a single CPU core
// ============================================================================
else {
  const sharp = require('sharp');
  const tf = require('@tensorflow/tfjs');
  require('@tensorflow/tfjs-backend-wasm');
  const handPoseDetection = require('@tensorflow-models/hand-pose-detection');

  async function processWorkerChunk() {
    const { workerId, frames } = workerData;
    const results = [];

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

    parentPort.postMessage(results);
  }

  processWorkerChunk().catch(err => {
    console.error(`[Worker ${workerData.workerId} Error]:`, err);
    process.exit(1);
  });
}