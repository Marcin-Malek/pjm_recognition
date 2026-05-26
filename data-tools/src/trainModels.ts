import * as tf from '@tensorflow/tfjs-node';
import * as fs from 'fs';
import * as path from 'path';
import { trainModels } from '@pjm/shared/training';
import type { DatasetStructure } from '@pjm/shared/types';

const labeledDatasetPath = './datasets/manual_recorded/pjm_hybrid_dataset.json';
const idleDatasetPath = './datasets/manual_recorded/pjm_hybrid_idle_dataset.json';

const outputDirectory = './exported_models';                                                                                                         

async function main() {
  await tf.ready();
  console.log('🚀 Begin training...');

  if (!fs.existsSync(labeledDatasetPath)) {
    console.error(`❌ File at: ${labeledDatasetPath} not found! Please ensure the dataset is in place.`);
    process.exit(1);
  }
  if (!fs.existsSync(idleDatasetPath)) {
    console.error(`❌ File at: ${idleDatasetPath} not found! Please ensure the dataset is in place.`);
    process.exit(1);
  }
  
  console.log('📂 Loading datasets...');
  const labeledDataset: DatasetStructure = JSON.parse(fs.readFileSync(labeledDatasetPath, 'utf8'));
  const idleDataset: DatasetStructure = JSON.parse(fs.readFileSync(idleDatasetPath, 'utf8'));
  const dataset: DatasetStructure = {
    static: [...idleDataset.static, ...labeledDataset.static],
    dynamic: [...idleDataset.dynamic, ...labeledDataset.dynamic]
  };
  console.log(`✅ Loaded: ${dataset.static.length} static gestures, ${dataset.dynamic.length} dynamic.`);

  console.log('🧠 Model training called...');
  const trainedModels = await trainModels(dataset);

  if (!fs.existsSync(outputDirectory)) {
    fs.mkdirSync(outputDirectory, { recursive: true });
  }

  console.log('💾 Writing models and labels...');
  
  if (trainedModels.static) {
    const staticDir = path.join(outputDirectory, 'static');
    if (!fs.existsSync(staticDir)) {
      fs.mkdirSync(staticDir, { recursive: true });
    }

    const staticPath = `file://${staticDir}`;
    await trainedModels.static.save(staticPath);
    
    const staticLabels = [...new Set(dataset.static.map(d => d.label))].sort();
    fs.writeFileSync(path.join(staticDir, 'labels.json'), JSON.stringify(staticLabels));
    
    console.log(`✅ Static model and labels saved to: ${staticDir}`);
  }

  if (trainedModels.dynamic) {
    const dynamicDir = path.join(outputDirectory, 'dynamic');
    if (!fs.existsSync(dynamicDir)) {
      fs.mkdirSync(dynamicDir, { recursive: true });
    }

    const dynamicPath = `file://${dynamicDir}`;
    await trainedModels.dynamic.save(dynamicPath);
    
    const dynamicLabels = [...new Set(dataset.dynamic.map(d => d.label))].sort();
    fs.writeFileSync(path.join(dynamicDir, 'labels.json'), JSON.stringify(dynamicLabels));
    
    console.log(`✅ Dynamic model and labels saved to: ${dynamicDir}`);
  }

  console.log('🎉 Training completed successfully!');
}

main().catch(console.error);