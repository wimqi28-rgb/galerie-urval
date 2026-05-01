// ==========================================
// AUDIO TOOLS – Outils de debug
// ==========================================

(function() {
  // N'exécuter que sur localhost (pas en production)
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return;
  }

  console.log('%c🔧 Audio Tools chargé (mode dev)', 'color: #F39C12; font-weight: bold');

  // Fonction already defined in main.js, on vérifie pour éviter les doublons
  if (!window.exportAudioData) {
    console.error('❌ exportAudioData non trouvé dans main.js');
  }
})();
