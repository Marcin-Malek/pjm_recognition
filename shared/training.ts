import * as tf from '@tensorflow/tfjs';
import { getMirroredDynamicData2D, getMirroredStaticData3D, addNoise, timeShift } from './augmentation';
import type { DatasetStructure, Models } from './types';
import { SEQUENCE_LENGTH } from './consts';

const createOneHot = (classes: string[], label: string) => {
  const oneHot = new Array(classes.length).fill(0);
  oneHot[classes.indexOf(label)] = 1;
  return oneHot;
};

export const trainModels = async (
  dataset: DatasetStructure,
  currentModels: Models = { static: null, dynamic: null }
): Promise<Models> => {
  
  const classesStatic = [...new Set(dataset.static.map((d) => d.label))].sort();
  let newModelStatic = currentModels.static;

  if (classesStatic.length >= 2) {
    const augmentedStatic = [
      ...dataset.static,
      ...dataset.static.flatMap((d) => [{ label: d.label, data: getMirroredStaticData3D(d.data) }]),
    ];

    const xsStat = tf.tensor2d(augmentedStatic.map((d) => d.data));
    const ysStat = tf.tensor2d(
      augmentedStatic.map((d) => createOneHot(classesStatic, d.label)),
    );

    const mStat = tf.sequential();
    mStat.add(tf.layers.dense({ units: 64, activation: 'relu', inputShape: [63] }));
    mStat.add(tf.layers.dense({ units: classesStatic.length, activation: 'softmax' }));
    mStat.compile({ optimizer: 'adam', loss: 'categoricalCrossentropy', metrics: ['accuracy'] });

    await mStat.fit(xsStat, ysStat, { epochs: 30, shuffle: true });
    const evalResultStatic = mStat.evaluate(xsStat, ysStat) as tf.Tensor[];
    console.log(`📊 Static model evaluation:
      Loss: ${evalResultStatic[0].dataSync()[0].toFixed(4)}, 
      Accuracy: ${(evalResultStatic[1].dataSync()[0] * 100).toFixed(2)}%
    `);
    newModelStatic = mStat;
    xsStat.dispose();
    ysStat.dispose();
  }

  const classesDynamic = [...new Set(dataset.dynamic.map((d) => d.label))].sort();
  let newModelDynamic = currentModels.dynamic;

  if (classesDynamic.length >= 2) {
    const augmentedDynamic = [
      ...dataset.dynamic,
      ...dataset.dynamic.flatMap((d) => [
        { label: d.label, data: getMirroredDynamicData2D(d.data) },
        // { label: d.label, data: addNoise(d.data, 0.005) },
        // { label: d.label, data: timeShift(d.data, 2) },
        // { label: d.label, data: timeShift(d.data, -2) },
      ]),
    ];

    const xsDyn = tf.tensor3d(
      augmentedDynamic.map((d) => d.data),
      [augmentedDynamic.length, SEQUENCE_LENGTH, 42],
    );

    const ysDyn = tf.tensor2d(
      augmentedDynamic.map((d) => createOneHot(classesDynamic, d.label)),
    );

    const mDyn = tf.sequential();
    mDyn.add(tf.layers.conv1d({ filters: 32, kernelSize: 3, activation: 'relu', inputShape: [SEQUENCE_LENGTH, 42] }));
    mDyn.add(tf.layers.maxPooling1d({ poolSize: 2 }));
    mDyn.add(tf.layers.flatten());
    mDyn.add(tf.layers.dense({ units: 32, activation: 'relu' }));
    mDyn.add(tf.layers.dropout({ rate: 0.3 }));
    mDyn.add(tf.layers.dense({ units: classesDynamic.length, activation: 'softmax' }));

    mDyn.compile({ optimizer: 'adam', loss: 'categoricalCrossentropy', metrics: ['accuracy'] });
    await mDyn.fit(xsDyn, ysDyn, { epochs: 40, shuffle: true });
    const evalResultDynamic = mDyn.evaluate(xsDyn, ysDyn) as tf.Tensor[];
    console.log(`📊 Dynamic model evaluation
      Loss: ${evalResultDynamic[0].dataSync()[0].toFixed(4)}, 
      Accuracy: ${(evalResultDynamic[1].dataSync()[0] * 100).toFixed(2)}%
    `);

    newModelDynamic = mDyn;
    xsDyn.dispose();
    ysDyn.dispose();
  }

  return { static: newModelStatic, dynamic: newModelDynamic };
};