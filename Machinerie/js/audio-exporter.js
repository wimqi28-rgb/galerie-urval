/**
 * AUDIO IMPORT - Fonction à exécuter dans la console du navigateur
 * Exporte les données audio de localStorage vers un fichier JSON
 * 
 * Étapes:
 * 1. Ouvrez la console (F12) dans votre navigateur
 * 2. Copiez-collez cette fonction
 * 3. Exécutez: exportAudioData()
 * 4. Un fichier audio-export.json sera créé dans le dossier du projet
 * 5. Exécutez ensuite: node export-audio.js
 *    pour convertir les audio en fichiers physiques dans assets/audiodescriptions/
 */

function exportAudioData() {
  const PREFIX = 'galerie_audio_';
  const data = {};
  
  // Parcourir tous les items localStorage
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(PREFIX)) {
      const artworkId = key.replace(PREFIX, '');
      const audioData = localStorage.getItem(key);
      data[artworkId] = audioData;
      console.log(`📎 Exporté: ${artworkId} (${Math.round(audioData.length/1024)} KB)`);
    }
  }
  
  if (Object.keys(data).length === 0) {
    console.log('⚠ Aucun audio trouvé dans localStorage');
    return;
  }
  
  // Créer un blob JSON et télécharger
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = 'audio-export.json';
  a.click();
  URL.revokeObjectURL(url);
  
  console.log(`✅ ${Object.keys(data).length} audio(s) exporté(s) dans audio-export.json`);
  console.log('📂 Pour les convertir en fichiers physiques, exécutez:');
  console.log('   node export-audio.js');
}

// Fonction pour importer depuis un fichier JSON (inverse)
function importAudioData(jsonString) {
  try {
    const data = JSON.parse(jsonString);
    let count = 0;
    for (const [artworkId, audioData] of Object.entries(data)) {
      localStorage.setItem('galerie_audio_' + artworkId, audioData);
      count++;
    }
    console.log(`✅ ${count} audio(s) importé(s) depuis JSON`);
  } catch (e) {
    console.error('❌ Erreur import:', e);
  }
}

// Fonction utilitaire pour nettoyer les audio
function clearAllAudio() {
  const PREFIX = 'galerie_audio_';
  let count = 0;
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key && key.startsWith(PREFIX)) {
      localStorage.removeItem(key);
      count++;
    }
  }
  console.log(`🗑️ ${count} audio(s) supprimé(s) de localStorage`);
}

// Affichage de l'aide
console.log('%c📢 AUDIO EXPORTER CHARGÉ', 'color: #4ECDC4; font-size: 14px; font-weight: bold');
console.log('Commandes disponibles:');
console.log('  exportAudioData()  → Exporte tous les audio vers audio-export.json');
console.log('  clearAllAudio()    → Supprime tous les audio de localStorage');
console.log('  importAudioData()  → Importe depuis JSON (à faire manuellement)');
console.log('');

// Auto-export au changement (optionnel, pour debugging)
// setInterval(() => console.log('Audio count:', Object.keys(localStorage).filter(k=>k.startsWith('galerie_audio_')).length), 5000);
