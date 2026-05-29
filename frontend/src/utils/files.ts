import type { ChangeEvent, Dispatch, RefObject, SetStateAction } from 'react';
import type { DatasetStructure, Models } from '@pjm/shared/types';
import { io, loadLayersModel } from '@tensorflow/tfjs';

export const exportDataset = (dataset: DatasetStructure) => {
  const dataStr = JSON.stringify(dataset);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([dataStr], { type: 'application/json' }));
  a.download = 'pjm_dataset_react.json';
  a.click();
};

export const importDataset = (
  file: File,
  datasetRef: RefObject<DatasetStructure>,
  setModels: Dispatch<SetStateAction<Models>>,
  forceUpdate: () => void,
) => {
  return new Promise<void>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const importedData = JSON.parse(evt.target?.result as string);
        if (Array.isArray(importedData.static) && datasetRef.current.static) {
          datasetRef.current.static.push(...importedData.static);
        }
        if (Array.isArray(importedData.dynamic) && datasetRef.current.dynamic) {
          datasetRef.current.dynamic.push(...importedData.dynamic);
        }
        setModels({ static: null, dynamic: null });
        forceUpdate();
        alert('Dataset załadowany pomyślnie.');
        resolve();
      } catch (err) {
        alert('Błąd pliku!');
        reject(err);
      }
    };

    reader.onerror = () => {
      alert('Błąd pliku!');
      reject(reader.error);
    };

    reader.readAsText(file);
  });
};

export const handleImportDataset = async (
  event: ChangeEvent<HTMLInputElement>,
  datasetRef: RefObject<DatasetStructure>,
  setModels: Dispatch<SetStateAction<Models>>,
  forceUpdate: () => void,
) => {
  const file = event.target.files?.[0];
  if (!file) {return};

  await importDataset(file, datasetRef, setModels, forceUpdate);
  event.target.value = '';
};


export const exportModels = async (models: Models) => {
  try {
    if (models.static) {
      await models.static.save('downloads://pjm-static-model');
    }
    if (models.dynamic) {
      await models.dynamic.save('downloads://pjm-dynamic-model');
    }
  } catch (err) {
    console.error("❌ Error exporting models:", err);
  }
};

export const importLabels = (labelFile: File, setLabels: Dispatch<SetStateAction<{static: string[], dynamic: string[]}>>, target: "static" | "dynamic") => {
  return new Promise<void>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const importedData: string[] = JSON.parse(evt.target?.result as string);
        setLabels(prev => ({ ...prev, [target]: importedData }));
        resolve();
      } catch (err) {
        alert('Błąd pliku!');
        reject(err);
      }
    };

    reader.onerror = () => {
      alert('Błąd pliku!');
      reject(reader.error);
    };

    reader.readAsText(labelFile);
  })
}

export const importModelFromFiles = async (files: FileList | null): Promise<Models["static"] | Models["dynamic"]> => {
  if (!files || files.length === 0) {
    return null;
  }

  const jsonFile = Array.from(files).find(f => f.name === 'model.json');
  const weightFiles = Array.from(files).filter(f => f.name.endsWith('.bin'));

  if (!jsonFile || weightFiles.length === 0) {
    throw new Error("You must select BOTH the .json and .bin files simultaneously!");
  }

  try {
    const model = await loadLayersModel(
      io.browserFiles([jsonFile, ...weightFiles])
    );
    
    return model;
  } catch (err) {
    console.error("❌ Error loading model from files:", err);
    throw err;
  }
};