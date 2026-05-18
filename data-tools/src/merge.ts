import fs from 'fs';
import { DatasetStructure } from '@pjm/shared/types';

const file1Path = 'pjm_dynamic_dataset.json';
const file2Path = 'pjm_static_dataset.json';
const outputPath = 'pjm_hybrid_dataset.json';

try {
    console.log('Reading files...');
    
    const file1 = JSON.parse(fs.readFileSync(file1Path, 'utf8'));
    const file2 = JSON.parse(fs.readFileSync(file2Path, 'utf8'));

    const mergedData: DatasetStructure = {
        static: [],
        dynamic: []
    };

    if (file1.static) mergedData.static.push(...file1.static);
    if (file2.static) mergedData.static.push(...file2.static);

    if (file1.dynamic) mergedData.dynamic.push(...file1.dynamic);
    if (file2.dynamic) mergedData.dynamic.push(...file2.dynamic);

    console.log('Writing merged file...\n');
    
    fs.writeFileSync(outputPath, JSON.stringify(mergedData, null, 2), 'utf8');

    console.log('✅ Success! Files have been merged.');
    console.log(`📊 Static result: ${mergedData.static.length} samples.`);
    console.log(`🎬 Dynamic result: ${mergedData.dynamic.length} sequences.`);
    console.log(`💾 Saved to: ${outputPath}`);

} catch (err: unknown) {
    console.error('\n❌ An error occurred. Please ensure the file names are correct and the files are located in the same directory as the script.');
    if (err instanceof Error) {
        console.error(err.message);
    }
}