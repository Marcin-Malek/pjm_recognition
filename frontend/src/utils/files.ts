import type { ChangeEvent, Dispatch, RefObject, SetStateAction } from 'react';
import type { DatasetStructure, ModelsState } from '../types';

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
  setModels: Dispatch<SetStateAction<ModelsState>>,
  forceUpdate: () => void,
) => {
  return new Promise<void>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const importedData = JSON.parse(evt.target?.result as string);
        if (Array.isArray(importedData.static)) datasetRef.current.static.push(...importedData.static);
        if (Array.isArray(importedData.dynamic)) datasetRef.current.dynamic.push(...importedData.dynamic);
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
  setModels: Dispatch<SetStateAction<ModelsState>>,
  forceUpdate: () => void,
) => {
  const file = event.target.files?.[0];
  if (!file) return;

  await importDataset(file, datasetRef, setModels, forceUpdate);
  event.target.value = '';
};
