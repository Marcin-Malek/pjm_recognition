import { useRef } from 'react';
import { exportModels, importLabels, importModelFromFiles } from './utils/files.ts';
import type { Models } from '@pjm/shared/types';

interface ModelsPanelProps {
  models: Models;
  setModels: React.Dispatch<React.SetStateAction<Models>>;
  setLabels: React.Dispatch<React.SetStateAction<{static: string[], dynamic: string[]}>>
}

export const ModelsPanel = ({ models, setModels, setLabels }: ModelsPanelProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importTargetRef = useRef<'static' | 'dynamic' | null>(null);

  const handleExport = () => {
    exportModels(models);
  };

  const triggerImport = (target: 'static' | 'dynamic') => {
    importTargetRef.current = target;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    const target = importTargetRef.current;
    
    if (!files || !target) {
        return;
    }
    try {
      const labelsFile = Array.from(files).find(f => f.name === 'labels.json');
      const loadedModel = await importModelFromFiles(files);
      if (loadedModel && labelsFile) {
        setModels(prev => ({
          ...prev,
          [target]: loadedModel
        }));
        await importLabels(labelsFile, setLabels, target)
        alert(`${target.charAt(0).toUpperCase() + target.slice(1)} model loaded successfully!`);
      }
    } catch (error) {
        if (error instanceof Error) {
            alert(`Error: ${error.message}`);
        }
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      importTargetRef.current = null;
    }
  };

  return (
    <div className="models-panel">
      <h3>Models Management</h3>
      
      <input
        type="file"
        multiple
        accept=".json,.bin"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      <div className="buttons-row">
        <button onClick={() => triggerImport('static')}>
          📂 Load Static (JSON + BIN)
        </button>
        
        <button onClick={() => triggerImport('dynamic')}>
          📂 Load Dynamic (JSON + BIN)
        </button>

        <button 
          onClick={handleExport} 
          disabled={!models.static && !models.dynamic}
        >
          💾 Export Loaded
        </button>
      </div>

      <div className="status">
        <p>Static Model: {models.static ? '🟢 Ready' : '🔴 None'}</p>
        <p>Dynamic Model: {models.dynamic ? '🟢 Ready' : '🔴 None'}</p>
      </div>
    </div>
  );
};