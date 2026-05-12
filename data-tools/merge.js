const fs = require('fs');

const file1Path = 'pjm_dynamic_dataset.json';
const file2Path = 'pjm_static_dataset.json';
const outputPath = 'pjm_hybrid_dataset.json';

try {
    console.log('Czytam pliki...');
    
    const file1 = JSON.parse(fs.readFileSync(file1Path, 'utf8'));
    const file2 = JSON.parse(fs.readFileSync(file2Path, 'utf8'));

    const mergedData = {
        static: [],
        dynamic: []
    };

    if (file1.static) mergedData.static.push(...file1.static);
    if (file2.static) mergedData.static.push(...file2.static);

    if (file1.dynamic) mergedData.dynamic.push(...file1.dynamic);
    if (file2.dynamic) mergedData.dynamic.push(...file2.dynamic);

    console.log('Zapisuję połączony plik...\n');
    
    fs.writeFileSync(outputPath, JSON.stringify(mergedData, null, 2), 'utf8');

    console.log('✅ Sukces! Pliki zostały połączone.');
    console.log(`📊 Wynik statyczny: ${mergedData.static.length} próbek.`);
    console.log(`🎬 Wynik dynamiczny: ${mergedData.dynamic.length} sekwencji.`);
    console.log(`💾 Zapisano w: ${outputPath}`);

} catch (err) {
    console.error('\n❌ Wystąpił błąd. Upewnij się, że nazwy plików są poprawne i pliki znajdują się w tym samym folderze co skrypt.');
    console.error(err.message);
}