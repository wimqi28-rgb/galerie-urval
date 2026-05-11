/*
 * Licence : CC BY-NC-SA 4.0
 * Creative Commons Attribution - Pas d’Utilisation Commerciale - Partage dans les Mêmes Conditions 4.0 International
 * https://creativecommons.org/licenses/by-nc-sa/4.0/
 *
 * Auteur : Urval Neto
 */

/* ==========================================
   MAIN.JS - LOGIQUE D'INTERACTIVITÉ
   GALERIE D'URVAL
   ========================================== */

/**
 * Configuration globale de la galerie
 * Modifiez ces valeurs pour personnaliser l'expérience
 */
const CONFIG = {
    // Distances de raycast (en mètres)
    RAYCASTER_FAR: 50,
    RAYCASTER_NEAR: 0.1,

    // Vitesse de déplacement (avec flèches)
    MOVEMENT_SPEED: 0.15,
    
    // Vitesse de rotation (degrés par frame)
    ROTATION_SPEED: 2,
    
    // Dimensions des cadres (modifiable)
    ARTWORK_WIDTH: 3,
    ARTWORK_HEIGHT: 2.25,
    
    // Hauteur de la caméra (eye level)
    CAMERA_HEIGHT: 1.6,
    
    // Limites de la galerie (collisions avec les murs)
    GALLERY_SIZE: 15,  // Galerie de 30×30, donc limites à ±15
    CAMERA_RADIUS: 0.35,  // Rayon du collider de la caméra
    // Placement par defaut quand on ajoute un tableau unique devant l'admin
    SINGLE_ARTWORK_DISTANCE: 1.8,
    SINGLE_ARTWORK_HEIGHT: 3,
};

// ==========================================
// VARIABLES GLOBALES
// ==========================================

let scene;
let camera;
let mainCursor;
let cartelPanel;
let closeBtn;
let helpPanel;
let uiContainer;
let loginBtn;
let loginModal;
let passwordInput;
let submitLogin;
let loginError;
let adminPanel;
let adminArtworkId = null;
let isAdminLoggedIn = false;
let audioPlayer;
let fullscreenModal;
let currentAudio = null;
let currentArtworkId = null;
let audioLoadToken = 0;
let fullscreenSourceVideo = null;

// Clés localStorage
const ARTWORK_IMAGES_KEY = 'ARTWORK_IMAGES_KEY';
const ARTWORK_AUDIO_KEY = 'ARTWORK_AUDIO_KEY';
const ARTWORK_CARTELS_KEY = 'ARTWORK_CARTELS_KEY';

// The image storage key is kept for backwards compatibility. New entries can be
// images or videos and carry a mediaType field.
const ARTWORK_MEDIA_KEY = ARTWORK_IMAGES_KEY;
const MEDIA_IMAGE_EXTENSIONS = ['jpeg', 'jpg', 'JPG', 'JPEG', 'Jpeg', 'png', 'PNG', 'webp', 'WEBP', 'gif', 'GIF', 'bmp', 'BMP', 'svg', 'SVG'];
const MEDIA_VIDEO_EXTENSIONS = ['mp4', 'webm', 'ogg', 'ogv', 'mov', 'm4v', 'MP4', 'WEBM', 'OGG', 'OGV', 'MOV', 'M4V'];
const MEDIA_EXTENSIONS = [...MEDIA_IMAGE_EXTENSIONS, ...MEDIA_VIDEO_EXTENSIONS];
const DEFAULT_IMAGE_UNITS = { width: 3, height: 2.25 };
const DEFAULT_VIDEO_UNITS = { width: 3, height: 1.6875 };

// Vérifier si on est dans Electron
const isElectron = window.electronAPI && window.electronAPI.isElectron;

function isDataVideo(src) {
    return typeof src === 'string' && src.trim().toLowerCase().startsWith('data:video/');
}

function isDataImage(src) {
    return typeof src === 'string' && src.trim().toLowerCase().startsWith('data:image/');
}

function hasImageExtension(src) {
    return typeof src === 'string' && /\.(jpe?g|png|webp|gif|bmp|svg)(\?.*)?(#.*)?$/i.test(src.trim());
}

function hasVideoExtension(src) {
    return typeof src === 'string' && /\.(mp4|webm|ogg|ogv|mov|m4v)(\?.*)?(#.*)?$/i.test(src.trim());
}

function isVideoSource(src, mediaType = '') {
    return getMediaTypeFromSource(src, mediaType) === 'video';
}

function getMediaTypeFromSource(src, mediaType = '') {
    const type = String(mediaType || '').trim().toLowerCase();

    if (isDataVideo(src)) return 'video';
    if (isDataImage(src)) return 'image';
    if (hasVideoExtension(src)) return 'video';
    if (hasImageExtension(src)) return 'image';

    return type === 'video' ? 'video' : 'image';
}

function getArtworkNumber(artworkId) {
    const match = artworkId && artworkId.match(/artwork-(\d+)/);
    return match ? match[1] : null;
}

function getArtworkNumberFromMediaSource(src) {
    if (typeof src !== 'string') return null;
    const match = src.match(/(?:^|[\/\\])tableau-(\d+)\.[^\/\\?#]+(?:[?#].*)?$/i);
    return match ? match[1] : null;
}

function getConfiguredMediaData(data = {}) {
    const src = data.mediaSrc || data.videoSrc || data.imageSrc || data.src || '';
    if (!src) return null;

    return {
        src,
        mediaType: getMediaTypeFromSource(src, data.mediaType),
        width: null,
        height: null,
        borderWidth: data.borderWidth || null
    };
}

function getArtworkMediaElement(artwork) {
    if (!artwork) return null;
    return artwork.querySelector('.artwork-media') ||
        artwork.querySelector('a-video.artwork-video') ||
        artwork.querySelector('a-plane.artwork-image');
}

function getArtworkFrameElement(artwork) {
    return artwork ? artwork.querySelector('a-box.artwork-frame') : null;
}

function getArtworkMediaSource(artwork) {
    const media = getArtworkMediaElement(artwork);
    if (!media) return '';
    return media.getAttribute('data-src') || media.getAttribute('src') || '';
}

function getArtworkMediaType(artwork) {
    const media = getArtworkMediaElement(artwork);
    if (!media) return 'image';
    return getMediaTypeFromSource(getArtworkMediaSource(artwork), media.getAttribute('data-media-type'));
}

function getArtworkBorderWidth(artworkId) {
    if (window.artworkDataCache && window.artworkDataCache[artworkId]) {
        return window.artworkDataCache[artworkId].borderWidth || 0.1;
    }

    if (!isElectron) {
        try {
            const savedData = JSON.parse(localStorage.getItem('artworkData') || '{}');
            return savedData[artworkId]?.borderWidth || 0.1;
        } catch (e) {
            return 0.1;
        }
    }

    return 0.1;
}

function applyArtworkDimensions(artwork, width, height, borderWidth = null) {
    if (!artwork || !width || !height) return;

    const media = getArtworkMediaElement(artwork);
    const frameBox = getArtworkFrameElement(artwork);
    const border = borderWidth ?? getArtworkBorderWidth(artwork.id);

    if (media) {
        media.setAttribute('width', width);
        media.setAttribute('height', height);
        media.setAttribute('data-media-width', width);
        media.setAttribute('data-media-height', height);
    }

    if (frameBox) {
        frameBox.setAttribute('width', width + border * 2);
        frameBox.setAttribute('height', height + border * 2);
    }
}

function mediaPixelsToUnits(pixelWidth, pixelHeight, fallback = DEFAULT_IMAGE_UNITS) {
    if (!pixelWidth || !pixelHeight || pixelWidth <= 0 || pixelHeight <= 0) {
        return { ...fallback };
    }

    return {
        width: pixelWidth * 0.001,
        height: pixelHeight * 0.001
    };
}

function ensureAFrameAssets() {
    const sceneEl = document.querySelector('a-scene');
    if (!sceneEl) return null;

    let assets = sceneEl.querySelector('a-assets');
    if (!assets) {
        assets = document.createElement('a-assets');
        sceneEl.insertBefore(assets, sceneEl.firstChild);
    }

    return assets;
}

function getVideoAssetId(artworkId) {
    return `video-${artworkId}`;
}

function ensureArtworkVideoAsset(artworkId, src) {
    const assets = ensureAFrameAssets();
    if (!assets || !src) return null;

    const id = getVideoAssetId(artworkId);
    let video = document.getElementById(id);
    if (!video) {
        video = document.createElement('video');
        video.id = id;
        video.setAttribute('playsinline', '');
        video.setAttribute('webkit-playsinline', '');
        video.setAttribute('preload', 'metadata');
        assets.appendChild(video);
    }

    if (video.getAttribute('src') !== src) {
        video.pause();
        video.setAttribute('src', src);
        video.load();
    }

    video.loop = true;
    video.muted = true;
    video.autoplay = false;
    video.playsInline = true;

    return video;
}

function playVideoSilently(video) {
    if (!video) return;
    video.loop = true;
    video.muted = true;
    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(err => console.warn('Lecture silencieuse differee:', err));
    }
}

function createArtworkMediaElement(mediaType) {
    const el = document.createElement(mediaType === 'video' ? 'a-video' : 'a-plane');
    el.setAttribute('class', mediaType === 'video' ? 'artwork-media artwork-video' : 'artwork-media artwork-image');
    el.setAttribute('data-media-type', mediaType);
    el.setAttribute('position', '0 0 0.01');

    if (mediaType === 'video') {
        el.setAttribute('material', 'shader: flat; side: double; transparent: true');
    } else {
        el.setAttribute('material', 'metalness: 0.1; roughness: 0.8; transparent: true');
    }

    return el;
}

function ensureArtworkMediaElement(artwork, mediaType) {
    let media = getArtworkMediaElement(artwork);
    const expectedTag = mediaType === 'video' ? 'A-VIDEO' : 'A-PLANE';

    if (media && media.tagName === expectedTag) {
        media.setAttribute('class', mediaType === 'video' ? 'artwork-media artwork-video' : 'artwork-media artwork-image');
        media.setAttribute('data-media-type', mediaType);
        return media;
    }

    const oldMedia = Array.from(artwork.querySelectorAll('.artwork-media, a-plane.artwork-image, a-video.artwork-video'));
    oldMedia.forEach(el => {
        const srcRef = el.getAttribute('src');
        if (srcRef && srcRef.startsWith('#')) {
            const oldVideo = document.getElementById(srcRef.slice(1));
            if (oldVideo) {
                oldVideo.pause();
                oldVideo.muted = true;
            }
        }
        el.remove();
    });

    media = createArtworkMediaElement(mediaType);
    const frame = getArtworkFrameElement(artwork);
    if (frame) {
        artwork.insertBefore(media, frame);
    } else {
        artwork.appendChild(media);
    }

    return media;
}

function applyImageMedia(artwork, src, options = {}) {
    const media = ensureArtworkMediaElement(artwork, 'image');
    media.setAttribute('src', src);
    media.setAttribute('data-src', src);
    media.setAttribute('data-media-type', 'image');

    if (options.width && options.height) {
        applyArtworkDimensions(artwork, options.width, options.height, options.borderWidth);
        return;
    }

    applyImageDimensions(artwork, src);
}

function applyVideoMedia(artwork, src, options = {}) {
    const media = ensureArtworkMediaElement(artwork, 'video');
    const video = ensureArtworkVideoAsset(artwork.id, src);
    if (!video) return;

    media.setAttribute('src', `#${video.id}`);
    media.setAttribute('data-src', src);
    media.setAttribute('data-media-type', 'video');
    media.setAttribute('material', 'shader: flat; side: double; transparent: true');

    if (options.width && options.height) {
        applyArtworkDimensions(artwork, options.width, options.height, options.borderWidth);
    }

    const applyLoadedDimensions = () => {
        if (options.width && options.height) return;
        const units = mediaPixelsToUnits(video.videoWidth, video.videoHeight, DEFAULT_VIDEO_UNITS);
        applyArtworkDimensions(artwork, units.width, units.height, options.borderWidth);
    };

    if (video.readyState >= 1) {
        applyLoadedDimensions();
    } else {
        video.addEventListener('loadedmetadata', applyLoadedDimensions, { once: true });
    }

}

function applyMediaToArtwork(artwork, src, options = {}) {
    if (!artwork || !src) return;

    const mediaType = getMediaTypeFromSource(src, options.mediaType);
    if (mediaType === 'video') {
        applyVideoMedia(artwork, src, options);
    } else {
        applyImageMedia(artwork, src, options);
    }
}

function getArtworkVideoElement(artworkId) {
    const artwork = document.getElementById(artworkId);
    if (!artwork || getArtworkMediaType(artwork) !== 'video') return null;

    const media = getArtworkMediaElement(artwork);
    const srcRef = media ? media.getAttribute('src') : '';
    if (srcRef && srcRef.startsWith('#')) {
        return document.getElementById(srcRef.slice(1));
    }

    return document.getElementById(getVideoAssetId(artworkId));
}

function getDefaultMediaCandidates(artworkId) {
    const num = getArtworkNumber(artworkId);
    if (!num) return [];
    const base = `assets/tableaux/tableau-${num}.`;
    return MEDIA_EXTENSIONS.map(ext => base + ext);
}

function getDefaultMediaCandidatesByNumber(artworkNumber, preferredSrc = '') {
    if (!artworkNumber) return [];

    const base = `assets/tableaux/tableau-${artworkNumber}.`;
    const candidates = MEDIA_EXTENSIONS.map(ext => base + ext);
    const ordered = [];

    if (preferredSrc && getArtworkNumberFromMediaSource(preferredSrc) === String(artworkNumber)) {
        ordered.push(preferredSrc);
    }

    candidates.forEach(candidate => {
        if (!ordered.includes(candidate)) {
            ordered.push(candidate);
        }
    });

    return ordered;
}

function testMediaSource(src) {
    return new Promise(resolve => {
        const mediaType = getMediaTypeFromSource(src);

        if (mediaType === 'video') {
            const video = document.createElement('video');
            let settled = false;
            const done = (value) => {
                if (settled) return;
                settled = true;
                resolve(value);
            };

            video.preload = 'metadata';
            video.muted = true;
            video.onloadedmetadata = () => {
                const units = mediaPixelsToUnits(video.videoWidth, video.videoHeight, DEFAULT_VIDEO_UNITS);
                done({ src, mediaType, width: units.width, height: units.height });
            };
            video.onerror = () => done(null);
            video.src = src;
            video.load();
            setTimeout(() => done(null), 2000);
            return;
        }

        const img = new Image();
        let settled = false;
        const done = (value) => {
            if (settled) return;
            settled = true;
            resolve(value);
        };

        img.onload = () => {
            const units = mediaPixelsToUnits(img.naturalWidth, img.naturalHeight, DEFAULT_IMAGE_UNITS);
            done({ src, mediaType, width: units.width, height: units.height });
        };
        img.onerror = () => done(null);
        img.src = src;
        setTimeout(() => done(null), 2000);
    });
}

async function findArtworkMediaByNumber(artworkNumber, preferredSrc = '') {
    const candidates = getDefaultMediaCandidatesByNumber(artworkNumber, preferredSrc);
    if (candidates.length === 0) return null;

    const results = await Promise.all(candidates.map(src => testMediaSource(src)));
    return results.find(result => result !== null) || null;
}

async function resolveArtworkMediaData(artworkId, data = {}) {
    const configuredMedia = getConfiguredMediaData(data);
    const sourceArtworkNumber = data.sourceArtworkNumber || getArtworkNumber(artworkId);
    const configuredNumber = getArtworkNumberFromMediaSource(configuredMedia?.src);

    if (sourceArtworkNumber && (!configuredMedia || configuredNumber)) {
        const detectedMedia = await findArtworkMediaByNumber(sourceArtworkNumber, configuredMedia?.src);
        if (detectedMedia) {
            return {
                ...detectedMedia,
                borderWidth: configuredMedia?.borderWidth || data.borderWidth || null
            };
        }
    }

    return configuredMedia;
}

// Cartels chargés depuis les fichiers externes
let cartelsData = {};

// Raycaster pour détecter les clics sur les objets
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();

// État de l'UI
let isCartelOpen = false;

// Données par défaut (fallback si aucun localStorage ni fetch)
const DEFAULT_ARTWORK_DATA = {
  "artwork-1": {
    "position": { "x": 0, "y": 2.9, "z": -14.8 },
    "rotation": { "x": 0, "y": 0, "z": 0 },
    "scale": { "x": 2.7, "y": 2.7, "z": 2.7 },
    "borderWidth": 0.04,
    "title": "Scène du Puits",
    "artist": "Les Hommes Préhistoriques",
    "description": "La scène du Puits est une peinture rupestre située dans la grotte de Lascaux, en France."
  },
  "artwork-2": {
    "position": { "x": -0.2, "y": 3.2, "z": 14.8 },
    "rotation": { "x": 0, "y": 180, "z": 0 },
    "scale": { "x": 2.8, "y": 2.8, "z": 2.8 },
    "borderWidth": 0.04,
    "title": "La Panneau",
    "artist": "Les Hommes Préhistoriques",
    "description": "Le Panneau des Lions est une peinture rupestre située dans la grotte de Chauvet, en France."
  },
  "artwork-3": {
    "position": { "x": -14.8, "y": 2.9, "z": 0 },
    "rotation": { "x": 0, "y": 90, "z": 0 },
    "scale": { "x": 3.6, "y": 3.6, "z": 3.6 },
    "borderWidth": 0.04,
    "title": "Tableau 3", "artist": "Artiste", "description": "Description du tableau 3"
  },
  "artwork-4": {
    "position": { "x": 14.8, "y": 2.9, "z": 0 },
    "rotation": { "x": 0, "y": -90, "z": 0 },
    "scale": { "x": 3.6, "y": 3.6, "z": 3.6 },
    "borderWidth": 0.04,
    "title": "Tableau 4", "artist": "Artiste", "description": "Description du tableau 4"
  }
};

// ==========================================
// FONCTIONS IPC HELPER (Electron vs localStorage)
// ==========================================

/**
 * Sauvegarder les données des œuvres (Electron: fichier, Web: localStorage)
 */
async function saveArtworkDataToFile(data) {
    Object.values(data || {}).forEach(value => {
        if (!value || typeof value !== 'object') return;
        delete value.mediaWidth;
        delete value.mediaHeight;
    });

    let result;
    if (isElectron) {
        result = await window.electronAPI.saveArtworkData(data);
    } else {
        localStorage.setItem('artworkData', JSON.stringify(data));
        result = { success: true };
    }
    if (result.success) {
        window.artworkDataCache = data;
    }
    return result;
}

/**
 * Charger les données des œuvres (Electron: fichier, Web: localStorage)
 * En mode web, si localStorage vide, charge depuis assets/tableaux/configuration.json (ou fallback embedded)
 */
async function loadArtworkDataFromFile() {
    if (isElectron) {
        return await window.electronAPI.loadArtworkData();
    } else {
        // Always try to load from configuration file and check for changes
        const configPath = 'assets/tableaux/configuration.json';
        try {
            // Add timestamp to bypass browser cache
            const response = await fetch(configPath + '?t=' + Date.now());
            if (response.ok) {
                let configFileData = await response.json();
                
                // ALWAYS auto-detect media type from file extension (ignore config mediaType)
                // ALWAYS remove mediaWidth/mediaHeight to use actual media dimensions
                for (const [key, value] of Object.entries(configFileData)) {
                    if (value.mediaSrc) {
                        // Force auto-detection from file extension
                        value.mediaType = getMediaTypeFromSource(value.mediaSrc);
                        console.log(`🔍 Auto-detection mediaType pour ${key}: ${value.mediaType} (de ${value.mediaSrc})`);
                    }
                    // Remove explicit dimensions - will be auto-detected from actual media
                    delete value.mediaWidth;
                    delete value.mediaHeight;
                }
                
                // Always use the fresh config data (don't rely on stale localStorage)
                localStorage.setItem('artworkData', JSON.stringify(configFileData));
                console.log('📂 Configuration rechargée depuis le fichier (fraîche)');
                
                return { success: true, data: configFileData };
            } else {
                // Fallback to localStorage if config file not found
                let data = JSON.parse(localStorage.getItem('artworkData') || '{}');
                if (Object.keys(data).length === 0) {
                    data = DEFAULT_ARTWORK_DATA;
                    console.log('📂 Utilisation des données par défaut');
                }
                return { success: true, data };
            }
        } catch (e) {
            console.error('Erreur chargement configuration:', e);
            // Fallback: utiliser localStorage ou données par défaut
            let data = JSON.parse(localStorage.getItem('artworkData') || '{}');
            if (Object.keys(data).length === 0) {
                data = DEFAULT_ARTWORK_DATA;
            }
            return { success: true, data };
        }
    }
}

/**
 * Sauvegarder un cartel (Electron: fichier, Web: localStorage)
 */
async function saveCartelToFileIPC(artworkId, cartelData) {
    if (isElectron) {
        return await window.electronAPI.saveCartel(artworkId, cartelData);
    } else {
        const savedCartels = JSON.parse(localStorage.getItem(ARTWORK_CARTELS_KEY) || '{}');
        savedCartels[artworkId] = cartelData;
        localStorage.setItem(ARTWORK_CARTELS_KEY, JSON.stringify(savedCartels));
        return { success: true };
    }
}

/**
 * Charger un cartel (Electron: fichier, Web: localStorage)
 */
async function loadCartelFromFileIPC(artworkId) {
    if (isElectron) {
        return await window.electronAPI.loadCartel(artworkId);
    } else {
        const savedCartels = JSON.parse(localStorage.getItem(ARTWORK_CARTELS_KEY) || '{}');
        if (savedCartels[artworkId]) {
            return { success: true, data: savedCartels[artworkId] };
        }
        return { success: false, error: 'Fichier non trouvé' };
    }
}

/**
 * Sauvegarder une image (Electron: fichier, Web: localStorage)
 */
async function saveImageIPC(artworkId, imageData) {
    if (isElectron) {
        return await window.electronAPI.saveImage(artworkId, imageData);
    } else {
        const savedImages = JSON.parse(localStorage.getItem(ARTWORK_IMAGES_KEY) || '{}');
        savedImages[artworkId] = { src: imageData };
        localStorage.setItem(ARTWORK_IMAGES_KEY, JSON.stringify(savedImages));
        return { success: true };
    }
}

/**
 * Supprimer un fichier (Electron: IPC, Web: localStorage)
 */
async function deleteFileIPC(filePath) {
    if (isElectron) {
        return await window.electronAPI.deleteFile(filePath);
    } else {
        // Supprimer du localStorage selon le type de fichier
        if (filePath.includes('tableaux/')) {
            const savedImages = JSON.parse(localStorage.getItem(ARTWORK_IMAGES_KEY) || '{}');
            const artworkId = filePath.match(/tableaux\/(.+)\.\w+/)?.[1];
            if (artworkId) delete savedImages[artworkId];
            localStorage.setItem(ARTWORK_IMAGES_KEY, JSON.stringify(savedImages));
        }
        return { success: true };
    }
}

// ==========================================
// FERMETURE DU PANNEAU D'AIDE
// ==========================================

window.closeHelp = function() {
    const hp = document.getElementById('helpPanel');
    if (hp) {
        hp.style.opacity = '0';
        hp.style.pointerEvents = 'none';
        document.activeElement?.blur();
    }
};

// ==========================================
// COMPOSANT TANK CONTROLS
// ==========================================

AFRAME.registerComponent('tank-controls', {
    schema: {
        vitesse: { type: 'number', default: 0.15 },
        vitesseRotation: { type: 'number', default: 0.03 },
        sensibiliteSouris: { type: 'number', default: 0.005 }
    },

    init: function() {
        this.keys = {};
        this.angleVue = 0;
        this.pitchVue = 0;
        this.isDragging = false;
        this.wasDragging = false;
        this.pendingDeltaX = 0;
        this.pendingDeltaY = 0;
        
        const self = this;
        
        // Écouteurs clavier
        window.addEventListener('keydown', (e) => {
            const isInputFocused = document.activeElement && (
                document.activeElement.tagName === 'INPUT' ||
                document.activeElement.tagName === 'TEXTAREA' ||
                document.activeElement.tagName === 'SELECT'
            );
            
            const adminPanelEl = document.getElementById('adminPanel');
            const loginModalEl = document.getElementById('loginModal');
            const isAdminOpen = adminPanelEl && !adminPanelEl.classList.contains('hidden');
            const isLoginOpen = loginModalEl && loginModalEl.classList.contains('active');
            
            if (isInputFocused) return;
            
            if (isAdminLoggedIn) {
                const key = e.key.toLowerCase();
                // En mode admin, bloquer les flèches si on n'est pas dans un input
                if (key === 'arrowup' || key === 'arrowdown' || 
                    key === 'arrowleft' || key === 'arrowright') {
                    if (!isInputFocused) {
                        e.preventDefault();
                        console.log('⛔ Arrow bloquée en mode admin');
                        return;
                    }
                }
            }
            
            if (isLoginOpen) return;
            
            const key = e.key.toLowerCase();
            
            if (e.key === 'ArrowUp') self.keys['z'] = true;
            else if (e.key === 'ArrowDown') self.keys['s'] = true;
            else if (e.key === 'ArrowLeft') self.keys['q'] = true;
            else if (e.key === 'ArrowRight') self.keys['d'] = true;
            else self.keys[key] = true;
            
            if (e.key === 'Shift') self.keys['shift'] = true;
            
            console.log('⌨️ keydown:', key, '| z:', self.keys['z'], '| q:', self.keys['q'], '| s:', self.keys['s'], '| d:', self.keys['d']);
        });
        
        window.addEventListener('keyup', (e) => {
            const isInputFocused = document.activeElement && (
                document.activeElement.tagName === 'INPUT' || 
                document.activeElement.tagName === 'TEXTAREA' ||
                document.activeElement.tagName === 'SELECT'
            );
            
            const adminPanelEl = document.getElementById('adminPanel');
            const loginModalEl = document.getElementById('loginModal');
            const isAdminOpen = adminPanelEl && !adminPanelEl.classList.contains('hidden');
            const isLoginOpen = loginModalEl && loginModalEl.classList.contains('active');
            
            if (isInputFocused) return;
            
            // En mode admin: bloquer tout
            if (isLoginOpen) return;
            
            const key = e.key.toLowerCase();
            if (e.key === 'ArrowUp') self.keys['z'] = false;
            else if (e.key === 'ArrowDown') self.keys['s'] = false;
            else if (e.key === 'ArrowLeft') self.keys['q'] = false;
            else if (e.key === 'ArrowRight') self.keys['d'] = false;
            else self.keys[key] = false;
            
            if (e.key === 'Shift') self.keys['shift'] = false;
        });
        
        // Support pour les clics souris
        window.addEventListener('mousedown', (e) => {
            // Désactiver le dragging si UI active
            if (document.body.classList.contains('ui-active')) {
                e.stopPropagation();
                return;
            }
            
            // Vérifier aussi si on clique sur un input ou select
            const targetTag = e.target.tagName.toLowerCase();
            if (targetTag === 'input' || targetTag === 'select' || targetTag === 'textarea') {
                e.stopPropagation();
                document.body.classList.add('ui-active');
                return;
            }
            
            // Ignorer les clics sur les éléments UI
            const uiElements = ['button', 'input', 'textarea', 'select'];
            const uiSelectors = '.login-btn, .admin-panel, .login-modal, .cartel-panel, .help-panel, .gallery-panel, .ui-container';
            
            if (e.target.closest(uiSelectors)) {
                e.stopPropagation();
                document.body.classList.add('ui-active');
                return;
            }
            
            if (uiElements.includes(e.target.tagName.toLowerCase())) {
                e.stopPropagation();
                document.body.classList.add('ui-active');
                return;
            }
            
            if (e.button === 0) {
                self.isDragging = true;
            }
        });
        
        // Réactiver le dragging quand la souris quitte l'UI (sauf si sur un input/select)
        window.addEventListener('mouseup', (e) => {
            const targetTag = e.target.tagName.toLowerCase();
            if (targetTag === 'input' || targetTag === 'select' || targetTag === 'textarea') {
                return; // Garder ui-active pour maintenir le focus sur l'input
            }
            document.body.classList.remove('ui-active');
        });
        
        // Mouseup - détecter si c'était un clic court
        window.addEventListener('mouseup', (e) => {
            if (e.button === 0 && !self.wasDragging) {
                // C'était un clic court - traiter comme clic sur œuvre
                const clickEvent = new MouseEvent('click', {
                    clientX: e.clientX,
                    clientY: e.clientY
                });
                document.querySelector('canvas')?.dispatchEvent(clickEvent);
            }
            self.wasDragging = false;
            self.isDragging = false;
        });
        
        // Mousemove
        window.addEventListener('mousemove', (e) => {
            // Ignorer si un élément UI est actif
            if (document.activeElement && (
                document.activeElement.tagName === 'INPUT' || 
                document.activeElement.tagName === 'TEXTAREA' ||
                document.activeElement.tagName === 'SELECT'
            )) {
                return;
            }
            
            if (!self.isDragging) return;
            
            e.preventDefault();
            
            self.pendingDeltaX += e.movementX;
            self.pendingDeltaY += e.movementY;
            self.wasDragging = true;
        });
        
        console.log('🎮 Tank Controls initialisés!');
    },

    tick: function(time, timeDelta) {
        const self = this;
        const rig = this.el.object3D;
        const camera = document.querySelector('[camera]');
        
        // Appliquer les deltas pending (frame-perfect)
        if (this.pendingDeltaX !== 0) {
            this.angleVue -= this.pendingDeltaX * this.data.sensibiliteSouris;
            this.pendingDeltaX = 0;
        }
        if (this.pendingDeltaY !== 0) {
            this.pitchVue -= this.pendingDeltaY * this.data.sensibiliteSouris;
            this.pitchVue = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, this.pitchVue));
            this.pendingDeltaY = 0;
        }
        
        // Rotation clavier (Q/D)
        if (this.keys['q']) {
            this.angleVue += this.data.vitesseRotation;
        }
        if (this.keys['d']) {
            this.angleVue -= this.data.vitesseRotation;
        }
        
        // Synchroniser la rotation du rig avec angleVue
        rig.rotation.y = this.angleVue;
        
        // Appliquer le pitch à la caméra
        if (camera) {
            camera.setAttribute('rotation', {
                x: this.pitchVue * (180 / Math.PI),
                y: 0,
                z: 0
            });
        }
        
        // Calcul de la direction avec sinus/cosinus
        const dirX = Math.sin(this.angleVue);
        const dirZ = Math.cos(this.angleVue);
        
        const speed = this.keys['shift'] ? this.data.vitesse * 1.3 : this.data.vitesse;
        
        // Déplacement (Z/S) - utilise l'angle mis à jour
        if (this.keys['z']) {
            rig.position.x -= dirX * speed;
            rig.position.z -= dirZ * speed;
        }
        if (this.keys['s']) {
            rig.position.x += dirX * speed;
            rig.position.z += dirZ * speed;
        }
        
        // Collisions
        const pos = this.el.getAttribute('position');
        const maxDist = 14.65;
        
        if (Math.abs(pos.x) > maxDist) {
            pos.x = pos.x > 0 ? maxDist : -maxDist;
            this.el.setAttribute('position', pos);
        }
        if (Math.abs(pos.z) > maxDist) {
            pos.z = pos.z > 0 ? maxDist : -maxDist;
            this.el.setAttribute('position', pos);
        }
    }
});

// ==========================================
// SPLASH SCREEN HANDLING
// ==========================================

/**
 * Gère l'écran de démarrage avec logo et texte
 * Gère aussi le bouton tactile invisible pour mobile/tablette
 */
function handleSplashScreen() {
    const splashScreen = document.getElementById('splashScreen');
    if (!splashScreen) return;

    // Fonction de fermeture (réutilisée par clavier et tactile)
    const closeSplashScreen = () => {
        // Éviter les appels multiples
        if (splashScreen.dataset.closing === 'true') return;
        splashScreen.dataset.closing = 'true';

        // Retirer les écouteurs
        document.removeEventListener('keydown', handleEnterKey);
        const enterBtn = document.querySelector('.enter-btn');
        if (enterBtn) {
            enterBtn.removeEventListener('click', closeSplashScreen);
        }

        // Lancer l'animation de fade out
        splashScreen.classList.add('fade-out');

        // Après l'animation, retirer l'élément du DOM
        setTimeout(() => {
            if (splashScreen && splashScreen.parentNode) {
                splashScreen.remove();
            }
        }, 2000); // Correspond à la durée de l'animation
    };

    // Attendre la touche Entrée (clavier)
    const handleEnterKey = (e) => {
        if (e.key === 'Enter') {
            closeSplashScreen();
        }
    };

    document.addEventListener('keydown', handleEnterKey);

    // Ajouter le clic pour mobile/tablette (bouton invisible)
    const enterBtn = document.querySelector('.enter-btn');
    if (enterBtn) {
        enterBtn.addEventListener('click', closeSplashScreen);
    }
}

// ==========================================
// INITIALISATION COMPLÈTE (après A-Frame)
// ==========================================

/**
 * Initialise la scène et les événements quand A-Frame est chargé
 */
async function initializeGallery() {
    // Gérer l'écran de démarrage en premier
    handleSplashScreen();
    console.log('🎨 Initialisation de la galerie d\'Urval...');

    // Récupération des éléments du DOM
    scene = document.querySelector('a-scene');
    camera = document.querySelector('[camera]');
    cartelPanel = document.querySelector('#cartelPanel');
    closeBtn = document.querySelector('#closeCartelBtn');
    helpPanel = document.querySelector('#helpPanel');
    uiContainer = document.querySelector('#uiContainer');
    loginBtn = document.querySelector('#loginBtn');
    loginModal = document.querySelector('#loginModal');
    passwordInput = document.querySelector('#passwordInput');
    submitLogin = document.querySelector('#submitLogin');
    loginError = document.querySelector('#loginError');
    adminPanel = document.querySelector('#adminPanel');
    audioPlayer = document.querySelector('#audioPlayer');
    fullscreenModal = document.querySelector('#fullscreenModal');

    if (!scene || !camera) {
        console.error('❌ Erreur: Scène ou caméra non trouvée!');
        return;
    }

    console.log('✅ Scène trouvée:', scene);
    console.log('✅ Caméra trouvée:', camera);

    // Configuration du raycaster
    setupRaycaster();

    // Configuration des événements
    setupEventListeners();

    // Charger les positions des œuvres (asynchrone)
    await loadSavedArtworks();

    // Ajouter les attributs fallback pour les œuvres HTML
    document.querySelectorAll('.clickable-artwork').forEach(artwork => {
        const imgPlane = getArtworkMediaElement(artwork);
        if (imgPlane && !imgPlane.getAttribute('data-fallback')) {
            const src = getArtworkMediaSource(artwork);
            if (!imgPlane.getAttribute('data-src') && src) {
                imgPlane.setAttribute('data-src', src);
            }
            if (src && src.includes('/tableaux/tableau-')) {
                const numMatch = src.match(/tableaux\/tableau-(\d+)/);
                if (numMatch) {
                    const num = numMatch[1];
                    const imgPath = `assets/tableaux/tableau-${num}`;
                    imgPlane.setAttribute('data-fallback', `${imgPath}.jpeg`);
                    imgPlane.setAttribute('data-fallback-2', `${imgPath}.JPG`);
                    imgPlane.setAttribute('data-fallback-3', `${imgPath}.JPEG`);
                    imgPlane.setAttribute('data-fallback-4', `${imgPath}.Jpeg`);
                    imgPlane.setAttribute('data-fallback-5', `${imgPath}.png`);
                    imgPlane.setAttribute('data-fallback-6', `${imgPath}.mp4`);
                    imgPlane.setAttribute('data-fallback-7', `${imgPath}.webm`);
                }
            }
        }
    });

    // Charger les cartels depuis les fichiers externes (asynchrone)
    await loadCartelsFromFiles();

    // Précharger les images des œuvres
    try {
        await preloadArtworkImages();
    } catch (e) {
        console.error('❌ Erreur préchargement images:', e);
    }

    // Initialiser l'upload d'image
    try {
        initImageUpload();
    } catch (e) {
        console.error('❌ Erreur init upload:', e);
    }
    
    // Initialiser l'upload audio
    try {
        initAudioUpload();
    } catch (e) {
        console.error('❌ Erreur init upload audio:', e);
    }

    // Vérifier le chargement des textures
    checkTextureLoading();
    
    console.log('✅ Galerie initialisée avec succès!');
    console.log('🎮 Tank Controls ZQSD activés!');
    console.log('Z = Avancer | S = Reculer | Q = Tourner gauche | D = Tourner droite');
    console.log('Souris = Regarder autour');

    // Gestion du panneau d'aide (bouton, click outside, Echap)
    if (helpPanel) {
        // Bouton de fermeture (en plus de onclick fallback)
        const closeHelpBtn = document.getElementById('closeHelpBtn');
        if (closeHelpBtn) {
            closeHelpBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                helpPanel.style.opacity = '0';
                helpPanel.style.pointerEvents = 'none';
                document.activeElement.blur();
            });
        }
        
        // Click outside
        helpPanel.addEventListener('click', (e) => {
            e.stopPropagation();
            if (e.target === helpPanel) {
                helpPanel.style.opacity = '0';
                helpPanel.style.pointerEvents = 'none';
                document.activeElement.blur();
            }
        });
        
        // Stopper événements sur le help panel
        const helpStopEvents = ['mousedown', 'mouseup', 'focus', 'blur', 'input', 'keydown', 'keyup'];
        helpStopEvents.forEach(evt => {
            helpPanel.addEventListener(evt, (e) => {
                e.stopPropagation();
            });
        });
    }

    // Retirer le focus des champs quand on clique sur la scène 3D (canvas)
    // UNIUMENT si ce n'est pas un clic qui vient de l'UI
    const canvas = document.querySelector('canvas');
    if (canvas) {
        canvas.setAttribute('tabindex', '0');
        canvas.addEventListener('click', (e) => {
            // Ne pas retirer le focus si on clique sur UI
            if (document.body.classList.contains('ui-active')) {
                return;
            }
            console.log('🖱️ Canvas cliqué, focus donné');
            if (document.activeElement && document.activeElement !== canvas && document.activeElement !== document.body) {
                document.activeElement.blur();
                console.log('Focus retiré de:', document.activeElement);
            }
            canvas.focus();
        });
    }

    // Fermer le panneau admin avec Echap
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && adminPanel && !adminPanel.classList.contains('hidden')) {
            closeAdminPanel();
        }
        // Fermer le panneau galerie avec Echap
        const galleryPanel = document.getElementById('galleryPanel');
        if (e.key === 'Escape' && galleryPanel && !galleryPanel.classList.contains('hidden')) {
            closeGalleryPanel();
        }
        // Aussi fermer l'aide avec Echap (même si pas chargé, mais au cas où)
        if (e.key === 'Escape' && helpPanel && helpPanel.style.opacity !== '0') {
            helpPanel.style.opacity = '0';
            helpPanel.style.pointerEvents = 'none';
            document.activeElement.blur();
        }
    });
}

// ==========================================
// CONFIGURATION RAYCASTER
// ==========================================

/**
 * Configure le raycaster pour détecter les interactions avec les cadres
 * Le raycaster envoie un "rayon" depuis la caméra au centre de l'écran
 * et détecte tous les objets qu'il intersecte
 */
function setupRaycaster() {
    // Ajouter une entité raycaster à la caméra
    const raycasterEntity = document.createElement('a-entity');
    raycasterEntity.setAttribute('raycaster', `far: ${CONFIG.RAYCASTER_FAR}; near: ${CONFIG.RAYCASTER_NEAR}`);
    raycasterEntity.setAttribute('cursor', 'fuse: false');
    
    // Ajouter le raycaster à la caméra
    camera.appendChild(raycasterEntity);

    // Ajouter le raycaster comme enfant du curseur pour lui appliquer les même transformations
}

// ==========================================
// DRAG HORIZONTAL DES PANELS
// ==========================================

/**
 * Configure le drag horizontal pour un panel (cartel ou audio)
 * La poignée en haut permet de déplacer le panel uniquement sur l'axe horizontal
 * 
 * @param {HTMLElement} panel - Le panel à rendre déplaçable
 */
function setupHorizontalDrag(panel) {
    if (!panel) return;
    const handle = panel.querySelector('.drag-handle');
    if (!handle) return;

    let isDragging = false;
    let startX = 0;
    let startLeft = 0;

    const onDragStart = (e) => {
        isDragging = true;
        // Position initiale du pointeur/tactile
        startX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;

        // Position actuelle du panel
        const rect = panel.getBoundingClientRect();
        startLeft = rect.left;

        // Basculer en positionnement pixel (remplacer left:25% ou right:25%)
        panel.style.left = startLeft + 'px';
        panel.style.right = 'auto';
        // Pour audioPlayer qui avait left:25%, c'est écrasé par left pixel

        // Empêcher la propagation pour ne pas déclencher d'autres gestionnaires
        e.preventDefault();
        e.stopPropagation();
    };

    const onDragMove = (e) => {
        if (!isDragging) return;
        const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        const deltaX = clientX - startX;
        const newLeft = startLeft + deltaX;

        // Contraindre dans la fenêtre
        const maxLeft = window.innerWidth - panel.offsetWidth;
        const clampedLeft = Math.max(0, Math.min(newLeft, maxLeft));

        panel.style.left = clampedLeft + 'px';
        e.preventDefault();
    };

    const onDragEnd = (e) => {
        if (!isDragging) return;
        isDragging = false;
        e.preventDefault();
    };

    // Souris - utiliser window pour garantir la réception même si le curseur quitte le panel
    handle.addEventListener('mousedown', onDragStart, { capture: true });
    window.addEventListener('mousemove', onDragMove, { capture: true });
    window.addEventListener('mouseup', onDragEnd, { capture: true });

    // Tactile
    handle.addEventListener('touchstart', onDragStart, { passive: false, capture: true });
    window.addEventListener('touchmove', onDragMove, { passive: false, capture: true });
    window.addEventListener('touchend', onDragEnd, { capture: true });
}

// ==========================================
// CONFIGURATION ÉVÉNEMENTS
// ==========================================

/**
 * Configure tous les écouteurs d'événements (click, keyboard, etc.)
 */
function setupEventListeners() {
    // Clics sur les cadres (objectes interactifs)
    const artworks = document.querySelectorAll('.clickable-artwork');
    artworks.forEach(artwork => {
        artwork.addEventListener('click', handleArtworkClick);
    });

    // Fermeture du cartel
    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeCartel();
    });

    // Bouton plein écran
    const fullscreenBtn = document.getElementById('fullscreenArtworkBtn');
    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await openFullscreen(currentArtworkId);
        });
    }

    // Bouton fermer plein écran
    const closeFullscreenBtn = document.getElementById('closeFullscreenBtn');
    if (closeFullscreenBtn) {
        closeFullscreenBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeFullscreen();
        });
    }

    // Fermer plein écran avec Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && fullscreenModal && !fullscreenModal.classList.contains('hidden')) {
            closeFullscreen();
        }
    });

    // Fermer plein écran en cliquant sur le fond
    if (fullscreenModal) {
        fullscreenModal.addEventListener('click', (e) => {
            if (e.target === fullscreenModal) {
                closeFullscreen();
            }
        });
    }

    // Empêcher le focus de partir vers le canvas 3D quand on utilise le cartel
    if (cartelPanel) {
        const uiStopEvents = ['mousedown', 'mouseup', 'click', 'focus', 'input', 'change', 'keydown', 'keyup'];
        uiStopEvents.forEach(evt => {
            cartelPanel.addEventListener(evt, (e) => {
                e.stopPropagation();
            });
        });
    }

    // Login button
    if (loginBtn) {
        loginBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (isAdminLoggedIn) {
                // Logout if already in admin mode
                isAdminLoggedIn = false;
                loginBtn.textContent = '🔒 Admin';
                loginBtn.classList.remove('admin-active');
                closeAdminPanel();
                closeGalleryPanel();
                
                // Cacher le bouton de création
                const createBtn = document.getElementById('createArtworkBtn');
                if (createBtn) {
                    createBtn.classList.remove('visible', 'admin-active');
                }
                
                // Cacher le bouton galerie
                const galleryBtn = document.getElementById('createGalleryBtn');
                if (galleryBtn) {
                    galleryBtn.classList.remove('visible', 'admin-active');
                }
                
                console.log('🔐 Session admin fermée');
            } else {
                loginModal.classList.add('active');
                passwordInput.focus();
            }
        });
    }
    
    // Show/hide login button with "²" key
    document.addEventListener('keydown', (e) => {
        if (e.key === '²') {
            e.preventDefault();
            loginBtn.classList.toggle('visible');
            if (loginBtn.classList.contains('visible') || isAdminLoggedIn) {
                loginBtn.classList.add('visible');
            }
        }
    });

    // Submit login
    if (submitLogin) {
        submitLogin.addEventListener('click', (e) => {
            e.stopPropagation();
            handleLogin();
        });
    }

    // Enter key on password input
    if (passwordInput) {
        passwordInput.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Enter') {
                handleLogin();
            }
        });
        passwordInput.addEventListener('focus', (e) => e.stopPropagation());
        passwordInput.addEventListener('blur', (e) => e.stopPropagation());
        passwordInput.addEventListener('input', (e) => e.stopPropagation());
    }

    // Close modal on escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && loginModal.classList.contains('active')) {
            loginModal.classList.remove('active');
            loginError.classList.remove('active');
            passwordInput.value = '';
        }
        if (e.key === 'Escape' && isCartelOpen) {
            closeCartel();
        }
        if (e.key === 'Escape' && adminPanel && !adminPanel.classList.contains('hidden')) {
            closeAdminPanel();
        }
        if (e.key === 'Escape') {
            loginBtn.classList.remove('visible');
        }
    });

    // Close modal on background click
    loginModal.addEventListener('click', (e) => {
        e.stopPropagation();
        if (e.target === loginModal) {
            loginModal.classList.remove('active');
            loginError.classList.remove('active');
            passwordInput.value = '';
            loginBtn.classList.remove('visible');
        }
    });

    // Close login modal with X button
    const closeLoginBtn = document.getElementById('closeLoginBtn');
    if (closeLoginBtn) {
        closeLoginBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            loginModal.classList.remove('active');
            loginError.classList.remove('active');
            passwordInput.value = '';
        });
    }

    // Stop events on login modal content
    const loginStopEvents = ['mousedown', 'mouseup', 'focus', 'blur', 'input', 'keydown', 'keyup'];
    loginStopEvents.forEach(evt => {
        loginModal.addEventListener(evt, (e) => {
            e.stopPropagation();
        });
    });
    
    // Admin panel controls
    setupAdminPanelControls();

    // Création de tableau (bouton +)
    initCreateArtworkButton();

    // Contrôles de génération
    initGenerationControls();

    // Fermeture du panneau galerie
    const closeGalleryBtn = document.getElementById('closeGalleryBtn');
    if (closeGalleryBtn) {
        closeGalleryBtn.addEventListener('click', closeGalleryPanel);
    }
    
    // Désactiver les contrôles 3D quand la souris est sur un panel UI
    const uiPanels = document.querySelectorAll('.admin-panel, .gallery-panel, .login-modal, .cartel-panel, .help-panel');
    uiPanels.forEach(panel => {
        panel.addEventListener('mouseenter', () => {
            document.body.classList.add('ui-active');
        });
        panel.addEventListener('mouseleave', () => {
            document.body.classList.remove('ui-active');
        });
        // Stopper TOUS les événements pour empêcher la 3D de capter le focus
        const stopUIEvents = ['mousedown', 'mouseup', 'click', 'focus', 'blur', 'input', 'change', 'keydown', 'keyup', 'keypress', 'pointerdown', 'pointerup'];
        stopUIEvents.forEach(evt => {
            panel.addEventListener(evt, (e) => {
                e.stopPropagation();
            });
        });
    });

    // Empêcher le focus de partir vers le canvas 3D (sans bloquer la saisie)
    const inputSelectors = 'input, textarea, select';
    document.querySelectorAll(inputSelectors).forEach(el => {
        // Empêcher juste la propagation vers le canvas, pas le comportement par défaut
        el.addEventListener('focus', (e) => {
            document.body.classList.add('ui-active');
            e.stopPropagation();
        });
        el.addEventListener('blur', (e) => {
            document.body.classList.remove('ui-active');
            e.stopPropagation();
        });
    });


    // Support pour les clics souris
    document.addEventListener('click', handleMouseClick);

    // Drag horizontal des panels (cartel + audio)
    setupHorizontalDrag(cartelPanel);
    setupHorizontalDrag(audioPlayer);

    console.log('📌 Événements configurés!');
}

// ==========================================
// CONTRÔLES AUX FLÈCHES DIRECTIONNELLES
// ==========================================

/**
 * Gère l'appui des touches (keydown)
 */



// ==========================================
// GESTION DU CLIC SUR LES CADRES
// ==========================================
// GESTION DU CLIC SUR LES CADRES
// ==========================================

/**
 * Gère le clic sur une œuvre (cadre)
 * Affiche le cartel avec les informations de l'artiste
 * OU ouvre le panel admin si connecté
 *
 * @param {Event} event - L'événement de clic
 */
async function handleArtworkClick(event) {
    // Récupération des données de l'œuvre
    const artwork = event.target.closest('.clickable-artwork');
    if (!artwork) return;

    const artworkId = artwork.getAttribute('id');

    // Si admin connecté et œuvre éditable, ouvrir le panel admin
    if (isAdminLoggedIn && artwork.classList.contains('admin-editable')) {
        await openAdminPanel(artworkId);
        console.log(`🔧 Édition: ${artworkId}`);
        return;
    }

    // Empêcher les clics multiples
    if (isCartelOpen) {
        const wasCurrentArtwork = currentArtworkId === artworkId;
        closeCartel();
        if (wasCurrentArtwork) return;
    }

    // D'abord essayer de charger depuis le fichier externe/localStorage
    let title, artist, description;
    console.log(`🔍 handleArtworkClick: artworkId=${artworkId}, cartelsData[artworkId]=`, cartelsData[artworkId]);

    if (cartelsData[artworkId]) {
        title = cartelsData[artworkId].title;
        artist = cartelsData[artworkId].artist;
        description = cartelsData[artworkId].description;
    } else {
        title = artwork.getAttribute('data-title') || '';
        artist = artwork.getAttribute('data-artist') || '';
        description = artwork.getAttribute('data-description') || '';
        console.log(`📋 Fallback HTML: title="${title}", artist="${artist}"`);
    }

    // Affichage du cartel
    displayCartel(title, artist, description, artworkId);

    // Log pour debug
    console.log(`👁️ Œuvre cliquée: ${title} par ${artist}`);
}

/**
 * Gère les clics de souris (pour interaction PC)
 * Utilise un raycaster manually pour détecter les objets cliqués
 */
function handleMouseClick(event) {
    // Ignorer si UI active
    if (document.body.classList.contains('ui-active')) {
        return;
    }
    
    // Ignorer si clic sur élément UI
    const uiSelectors = '.admin-panel, .gallery-panel, .login-modal, .cartel-panel, .help-panel, .audio-player, .login-btn, .help-panel, input, select, textarea';
    if (event.target.closest(uiSelectors)) {
        return;
    }
    
    // Convertir les coordonnées de la souris en normalised device coordinates
    const canvas = document.querySelector('canvas');
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Récupère la caméra Three.js depuis A-Frame
    const threeCamera = camera.getObject3D('camera');
    if (!threeCamera) return;

    // Utiliser le raycaster Three.js
    raycaster.setFromCamera(mouse, threeCamera);

    // Récupérer tous les plans des cadres
    const artworkElements = document.querySelectorAll('.clickable-artwork');
    const artworkObjects = [];

    artworkElements.forEach(elem => {
        const group = elem.getObject3D('group');
        if (group) {
            group.traverse((child) => {
                if (child.isMesh) {
                    artworkObjects.push(child);
                }
            });
        }
    });

    // Vérifier les intersections
    const intersects = raycaster.intersectObjects(artworkObjects, true);

    if (intersects.length > 0) {
        const intersectedObject = intersects[0].object;
        let current = intersectedObject;
        
        while (current) {
            const parentEl = current.parentEl || (current.parent && current.parent.parentEl);
            if (parentEl && parentEl.classList && parentEl.classList.contains('clickable-artwork')) {
                const evt = new Event('click', { bubbles: true });
                parentEl.dispatchEvent(evt);
                console.log(`🖱️ Clic détecté sur: ${parentEl.id}`);
                break;
            }
            current = current.parent;
        }
    }
}

function handleShortClick(event) {
    // Only handle clicks on canvas
    if (event.target.tagName !== 'CANVAS') return;
    handleMouseClick(event);
}

// ==========================================
// AFFICHAGE DU CARTEL
// ==========================================

/**
 * Affiche le panneau cartel avec les informations de l'œuvre
 * Remplit les champs: titre, artiste, description
 * 
 * @param {string} title - Titre de l'œuvre
 * @param {string} artist - Nom de l'artiste
 * @param {string} description - Description de l'œuvre
 */
function displayCartel(title, artist, description, artworkId) {
    const titleEl = document.querySelector('#cartelTitle');
    const artistEl = document.querySelector('#cartelArtist');
    const descEl = document.querySelector('#cartelDescription');
    
    // IMPORTANT: Save current artwork ID for fullscreen
    currentArtworkId = artworkId;
    console.log('currentArtworkId set to:', currentArtworkId);
    
    if (titleEl) titleEl.textContent = title || 'Sans titre';
    if (artistEl) artistEl.textContent = `par ${artist || 'Inconnu'}`;
    if (descEl) descEl.textContent = description || '';
    
    if (uiContainer) {
        uiContainer.classList.remove('hidden');
    }
    
    isCartelOpen = true;

    // Afficher le lecteur audio si l'œuvre a une audio-description
    loadAudioForArtwork(artworkId, title);
}

// ==========================================
// GESTION AUDIO
// ==========================================

function setAudioPanelTitle(kind, title) {
    const audioTitle = document.querySelector('#audioTitle');
    if (!audioTitle) return;

    const label = kind === 'video' ? 'Vid\u00e9odescription' : 'Audiodescription';
    audioTitle.textContent = `${label} : ${title || 'Sans titre'}`;
}

function resetAudioPanelControls() {
    const playBtn = document.getElementById('audioPlayBtn');
    const seekSlider = document.getElementById('audioSeek');
    const timeDisplay = document.getElementById('audioTime');
    const totalDisplay = document.getElementById('audioTotal');

    if (playBtn) playBtn.textContent = '\u25b6';
    if (seekSlider) seekSlider.value = 0;
    if (timeDisplay) timeDisplay.textContent = '0:00';
    if (totalDisplay) totalDisplay.textContent = '0:00';
}

function clearMediaControlHandlers(media) {
    if (!media) return;

    media.onloadedmetadata = null;
    media.oncanplay = null;
    media.onerror = null;
    media.onplay = null;
    media.onpause = null;
    media.ontimeupdate = null;
    media.onended = null;
}

function stopCurrentAudioForSwitch() {
    if (!currentAudio) {
        if (audioPlayer) audioPlayer.classList.add('hidden');
        resetAudioPanelControls();
        return;
    }

    const media = currentAudio;
    clearMediaControlHandlers(media);

    if (media.tagName === 'VIDEO') {
        const shouldKeepPlayingSilently = !media.paused && !media.ended;
        if (shouldKeepPlayingSilently) {
            playVideoSilently(media);
        } else {
            media.muted = true;
            media.pause();
        }
    } else {
        media.pause();
        media.currentTime = 0;
    }

    currentAudio = null;
    if (audioPlayer) audioPlayer.classList.add('hidden');
    resetAudioPanelControls();
}

function loadVideoDescriptionForArtwork(artworkId, title) {
    const token = ++audioLoadToken;
    const video = getArtworkVideoElement(artworkId);
    if (!video || !audioPlayer) {
        stopCurrentAudioForSwitch();
        return;
    }

    if (currentAudio && currentAudio !== video) {
        stopCurrentAudioForSwitch();
    }

    currentAudio = video;
    currentArtworkId = artworkId;
    video.loop = true;
    video.muted = false;

    const volSlider = document.getElementById('audioVol');
    if (volSlider) {
        video.volume = volSlider.value / 100;
    }

    setAudioPanelTitle('video', title);
    audioPlayer.classList.remove('hidden');
    initAudioControls(video, token);

    updateAudioAdminPanel(artworkId, false, null, true);
}

function loadAudioForArtwork(artworkId, title) {
    const token = ++audioLoadToken;
    if (!artworkId || !audioPlayer) {
        stopCurrentAudioForSwitch();
        return;
    }

    const artwork = document.getElementById(artworkId);
    if (artwork && getArtworkMediaType(artwork) === 'video') {
        loadVideoDescriptionForArtwork(artworkId, title);
        return;
    }

    stopCurrentAudioForSwitch();
    
    if (isElectron) {
        // Charger via IPC (cherche fichier audio correspondant)
        window.electronAPI.getAudio(artworkId).then(result => {
            if (token !== audioLoadToken) return;
            if (result.success && result.data) {
                currentAudio = new Audio(result.data);
                currentArtworkId = artworkId;
                setAudioPanelTitle('audio', title);
                audioPlayer.classList.remove('hidden');
                initAudioControls(currentAudio, token);
                updateAudioAdminPanel(artworkId, true);
            } else {
                audioPlayer.classList.add('hidden');
                updateAudioAdminPanel(artworkId, false);
            }
        }).catch(err => {
            if (token !== audioLoadToken) return;
            console.error('Erreur chargement audio:', err);
            audioPlayer.classList.add('hidden');
        });
        return;
    }
    
    // Web : priority 1 : audio sauvegardé en base64 (upload via admin)
    const savedAudios = JSON.parse(localStorage.getItem(ARTWORK_AUDIO_KEY) || '{}');
    if (savedAudios[artworkId]) {
        console.log(`🔊 Audio trouvé dans localStorage pour ${artworkId}`);
        currentAudio = new Audio(savedAudios[artworkId]);
        currentArtworkId = artworkId;
        setAudioPanelTitle('audio', title);
        audioPlayer.classList.remove('hidden');
        initAudioControls(currentAudio, token);
        updateAudioAdminPanel(artworkId, true);
        return;
    }
    
    // Priority 2 : fichier physique (mode Electron ou fichiers statiques)
    const numMatch = artworkId.match(/artwork-(\d+)/);
    const audioNum = numMatch ? numMatch[1] : artworkId.replace('artwork-', '');
    const audioPath = `assets/audiodescriptions/audio-${audioNum}.mp3`;
    
    const testAudio = new Audio(audioPath);
    testAudio.addEventListener('canplaythrough', () => {
        if (token !== audioLoadToken) return;
        currentAudio = testAudio;
        currentArtworkId = artworkId;
        setAudioPanelTitle('audio', title);
        audioPlayer.classList.remove('hidden');
        initAudioControls(testAudio, token);
        updateAudioAdminPanel(artworkId, false, audioPath);
    });
    testAudio.addEventListener('error', () => {
        if (token !== audioLoadToken) return;
        audioPlayer.classList.add('hidden');
        updateAudioAdminPanel(artworkId, false);
    });
    testAudio.load();
}

/**
 * Ferme le panneau cartel
 */
function closeCartel() {
    uiContainer.classList.add('hidden');
    isCartelOpen = false;
    
    // Arrêter l'audio en cours
    audioLoadToken++;
    stopCurrentAudioForSwitch();
    
    // Fermer le plein écran si ouvert
    if (fullscreenModal) {
        closeFullscreen();
    }
    
    document.activeElement.blur();
    console.log('✕ Cartel fermé');
}

// ==========================================
// PLEIN ÉCRAN IMAGE
// ==========================================

function getArtworkImageSrc(artworkId) {
    // First check localStorage for uploaded images
    const savedImages = JSON.parse(localStorage.getItem(ARTWORK_IMAGES_KEY) || '{}');
    if (savedImages[artworkId] && savedImages[artworkId].src) {
        console.log('Found in localStorage:', savedImages[artworkId].src);
        return savedImages[artworkId].src;
    }
    
    // Get entity's current src from DOM
    const entity = document.querySelector(`#${artworkId}`);
    let currentSrc = null;
    if (entity) {
        const imgPlane = entity.querySelector('a-plane.artwork-image');
        if (imgPlane) currentSrc = imgPlane.getAttribute('src');
    }
    
    // Extract number from artworkId (e.g., "artwork-5" -> "5")
    const numMatch = artworkId.match(/artwork-(\d+)/);
    if (!numMatch) return currentSrc;
    
    const num = numMatch[1];
    const basePath = `assets/tableaux/tableau-${num}`;
    
    // Based on your actual files, the extensions are:
    const paths = [
        `${basePath}.jpg`,    // tableau-5.jpg
        `${basePath}.jpeg`,  // tableau-1,2,3,4
        `${basePath}.JPG`,   // tableau-12.JPG
        `${basePath}.JPEG`,
        `${basePath}.Jpeg`, // tableau-9.Jpeg
        `${basePath}.png`
    ];
    
    // Return first one that's not the current src
    for (const p of paths) {
        if (p !== currentSrc) {
            console.log('Trying path:', p);
            return p;
        }
    }
    
    return currentSrc;
}

async function openFullscreen(artworkId) {
    if (!fullscreenModal || !artworkId) return;

    const fullscreenImage = document.getElementById('fullscreenImage');
    const fullscreenVideo = document.getElementById('fullscreenVideo');
    if (!fullscreenImage) return;

    fullscreenImage.classList.remove('hidden');
    if (fullscreenVideo) {
        fullscreenVideo.pause();
        fullscreenVideo.classList.add('hidden');
        fullscreenVideo.removeAttribute('src');
    }

    const artwork = document.getElementById(artworkId);
    if (artwork && getArtworkMediaType(artwork) === 'video' && fullscreenVideo) {
        const sourceVideo = getArtworkVideoElement(artworkId);
        const src = getArtworkMediaSource(artwork);

        fullscreenSourceVideo = sourceVideo;
        fullscreenImage.classList.add('hidden');
        fullscreenVideo.classList.remove('hidden');
        fullscreenVideo.src = src;
        fullscreenVideo.loop = true;
        fullscreenVideo.muted = false;
        fullscreenVideo.volume = sourceVideo ? sourceVideo.volume : 0.8;
        fullscreenVideo.onloadedmetadata = () => {
            if (sourceVideo && isFinite(sourceVideo.currentTime)) {
                fullscreenVideo.currentTime = sourceVideo.currentTime;
            }
            if (!sourceVideo || !sourceVideo.paused) {
                const playPromise = fullscreenVideo.play();
                if (playPromise && typeof playPromise.catch === 'function') {
                    playPromise.catch(() => {});
                }
            }
        };
        fullscreenVideo.load();
        if (sourceVideo) sourceVideo.muted = true;
        fullscreenModal.classList.remove('hidden');
        return;
    }

    // Vérifier d'abord les images uploadées (localStorage)
    const savedImages = JSON.parse(localStorage.getItem(ARTWORK_MEDIA_KEY) || '{}');
    if (savedImages[artworkId] && savedImages[artworkId].src) {
        if (getMediaTypeFromSource(savedImages[artworkId].src, savedImages[artworkId].mediaType) === 'video' && fullscreenVideo) {
            fullscreenImage.classList.add('hidden');
            fullscreenVideo.classList.remove('hidden');
            fullscreenVideo.src = savedImages[artworkId].src;
            fullscreenVideo.muted = false;
            fullscreenVideo.loop = true;
            fullscreenModal.classList.remove('hidden');
            return;
        }
        fullscreenImage.src = savedImages[artworkId].src;
        fullscreenModal.classList.remove('hidden');
        return;
    }

    const currentMediaSrc = artwork ? getArtworkMediaSource(artwork) : '';
    const currentSrcNumberMatch = currentMediaSrc.match(/tableaux\/tableau-(\d+)/);
    const artworkNumber = getArtworkNumber(artworkId);
    const usesExplicitMedia = Boolean(
        window.artworkDataCache?.[artworkId]?.mediaSrc ||
        artwork?.getAttribute('data-source-artwork-number') ||
        !currentSrcNumberMatch ||
        currentSrcNumberMatch[1] !== artworkNumber
    );

    if (currentMediaSrc && !currentMediaSrc.startsWith('data:') && usesExplicitMedia) {
        fullscreenImage.src = currentMediaSrc;
        fullscreenModal.classList.remove('hidden');
        return;
    }

    // Extraire le numéro de l'œuvre
    const numMatch = artworkId.match(/artwork-(\d+)/);
    if (!numMatch) return;
    const num = numMatch[1];
    const basePath = `assets/tableaux/tableau-${num}`;

    // Toutes les extensions possibles (par ordre de préférence)
    const extensions = MEDIA_IMAGE_EXTENSIONS;

    // Tester toutes les extensions en parallèle
    const testPromises = extensions.map(ext => {
        return new Promise(resolve => {
            const testPath = basePath + '.' + ext;
            const img = new Image();
            img.onload = () => resolve(testPath);
            img.onerror = () => resolve(null);
            img.src = testPath;
        });
    });

    const results = await Promise.all(testPromises);
    const workingPath = results.find(path => path !== null);

    if (workingPath) {
        fullscreenImage.src = workingPath;
    } else {
        // Fallback: essayer le chemin par défaut
        fullscreenImage.src = basePath + '.jpeg';
    }
    fullscreenModal.classList.remove('hidden');
}

function closeFullscreen() {
    const fullscreenVideo = document.getElementById('fullscreenVideo');
    if (fullscreenVideo) {
        if (fullscreenSourceVideo) {
            const fullscreenWasPlaying = !fullscreenVideo.paused;
            if (isFinite(fullscreenVideo.currentTime)) {
                fullscreenSourceVideo.currentTime = fullscreenVideo.currentTime;
            }
            const keepSound = currentAudio === fullscreenSourceVideo && isCartelOpen;
            const shouldResume = keepSound && fullscreenWasPlaying;
            const shouldContinueSilently = !keepSound && fullscreenWasPlaying;
            fullscreenSourceVideo.muted = !keepSound;
            if (shouldResume) {
                fullscreenSourceVideo.play().catch(() => {});
            } else if (shouldContinueSilently) {
                playVideoSilently(fullscreenSourceVideo);
            } else {
                fullscreenSourceVideo.pause();
                if (!keepSound) {
                    fullscreenSourceVideo.muted = true;
                }
            }
        }
        fullscreenVideo.pause();
        fullscreenVideo.removeAttribute('src');
        fullscreenVideo.classList.add('hidden');
    }
    fullscreenSourceVideo = null;
    if (fullscreenModal) {
        fullscreenModal.classList.add('hidden');
    }
}

// ==========================================
// LECTEUR AUDIO
// ==========================================

function initAudioControls(controlledMedia = currentAudio, token = audioLoadToken) {
    const playBtn = document.getElementById('audioPlayBtn');
    const prevBtn = document.getElementById('audioPrevBtn');
    const nextBtn = document.getElementById('audioNextBtn');
    const seekSlider = document.getElementById('audioSeek');
    const timeDisplay = document.getElementById('audioTime');
    const totalDisplay = document.getElementById('audioTotal');
    const volSlider = document.getElementById('audioVol');
    
    if (!controlledMedia || !playBtn) return;

    const isActiveMedia = () => currentAudio === controlledMedia && token === audioLoadToken;
    
    // Format time
    const formatTime = (seconds) => {
        if (!seconds || isNaN(seconds) || !isFinite(seconds)) {
            return '0:00';
        }
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };
    
    // Update total duration display - handles both events
    const updateDuration = () => {
        if (!isActiveMedia()) return;
        if (controlledMedia.duration && isFinite(controlledMedia.duration)) {
            totalDisplay.textContent = formatTime(controlledMedia.duration);
        } else {
            totalDisplay.textContent = '0:00';
        }
    };

    const updatePlayButton = () => {
        if (!isActiveMedia() || !playBtn) return;
        playBtn.textContent = controlledMedia.paused ? '\u25b6' : '\u23f8';
    };
    
    // Set duration when metadata is loaded
    clearMediaControlHandlers(controlledMedia);

    controlledMedia.onloadedmetadata = () => {
        updateDuration();
    };
    
    // Also update when canplaythrough fires (fallback)
    controlledMedia.oncanplay = () => {
        updateDuration();
    };
    
    // Error handling - hide player if audio fails
    controlledMedia.onerror = () => {
        if (!isActiveMedia()) return;
        console.error('❌ Audio failed to load');
        if (audioPlayer) {
            audioPlayer.classList.add('hidden');
        }
    };
    
    // Ensure duration is checked after a short delay (for cached/base64 audio)
    setTimeout(updateDuration, 100);
    setTimeout(updatePlayButton, 100);
    
    // Play/Pause
    playBtn.onclick = () => {
        if (!isActiveMedia()) return;
        if (controlledMedia.paused) {
            const playPromise = controlledMedia.play();
            if (playPromise && typeof playPromise.catch === 'function') {
                playPromise.catch(err => console.warn('Lecture audio/video differee:', err));
            }
        } else {
            controlledMedia.pause();
        }
        updatePlayButton();
    };
    
    // Previous (-10s)
    prevBtn.onclick = () => {
        if (!isActiveMedia()) return;
        controlledMedia.currentTime = Math.max(0, controlledMedia.currentTime - 10);
    };
    
    // Next (+10s)
    nextBtn.onclick = () => {
        if (!isActiveMedia() || !controlledMedia.duration || !isFinite(controlledMedia.duration)) return;
        controlledMedia.currentTime = Math.min(controlledMedia.duration, controlledMedia.currentTime + 10);
    };
    
    // Seek
    seekSlider.oninput = () => {
        if (!isActiveMedia()) return;
        if (controlledMedia.duration && isFinite(controlledMedia.duration)) {
            controlledMedia.currentTime = (seekSlider.value / 100) * controlledMedia.duration;
        }
    };
    
    // Volume
    volSlider.oninput = () => {
        if (!isActiveMedia()) return;
        controlledMedia.volume = volSlider.value / 100;
        if (controlledMedia.tagName === 'VIDEO') {
            controlledMedia.muted = false;
        }
    };

    controlledMedia.onplay = updatePlayButton;
    controlledMedia.onpause = updatePlayButton;
    
    // Update progress
    controlledMedia.ontimeupdate = () => {
        if (!isActiveMedia()) return;
        const progress = (controlledMedia.currentTime / controlledMedia.duration) * 100;
        seekSlider.value = isNaN(progress) ? 0 : progress;
        timeDisplay.textContent = formatTime(controlledMedia.currentTime);
    };
    
    // Reset on end
    controlledMedia.onended = () => {
        if (!isActiveMedia()) return;
        playBtn.textContent = '\u25b6';
        seekSlider.value = 0;
        timeDisplay.textContent = '0:00';
    };

    updatePlayButton();
}

function closeAdminPanel() {
    adminPanel.classList.add('hidden');
    adminArtworkId = null;
    document.body.classList.remove('ui-active');
    document.activeElement.blur();
    console.log('✕ Panneau admin fermé');
}

/**
 * Gère la connexion admin
 */
function initCreateArtworkButton() {
    const createBtn = document.getElementById('createArtworkBtn');
    if (createBtn) {
        createBtn.addEventListener('click', openAdminPanelGeneration);
        console.log('➕ Bouton création admin initialisé');
    }
    
    const createGalleryBtn = document.getElementById('createGalleryBtn');
    if (createGalleryBtn) {
        createGalleryBtn.addEventListener('click', openGalleryPanel);
        console.log('🎨 Bouton galerie initialisé');
    }
}

function openGalleryPanel() {
    if (!isAdminLoggedIn) {
        alert('⚠ Vous devez être admin pour accéder à ce panneau.');
        return;
    }
    
    const galleryPanel = document.getElementById('galleryPanel');
    if (galleryPanel) {
        galleryPanel.classList.remove('hidden');
        document.body.classList.add('ui-active');
        console.log('🎨 Panneau galerie ouvert');
    }
}

function closeGalleryPanel() {
    const galleryPanel = document.getElementById('galleryPanel');
    if (galleryPanel) {
        galleryPanel.classList.add('hidden');
        document.body.classList.remove('ui-active');
        console.log('✕ Panneau galerie fermé');
    }
}

function openAdminPanelGeneration() {
    if (!isAdminLoggedIn) {
        alert('⚠ Vous devez être admin pour accéder à ce panneau.');
        return;
    }
    
    const adminPanel = document.getElementById('adminPanel');
    if (!adminPanel) return;
    
    adminPanel.classList.remove('hidden');
    
    const tabButtons = document.querySelectorAll('.admin-tab-btn');
    const tabPanes = document.querySelectorAll('.admin-tab-pane');
    
    tabButtons.forEach(b => b.classList.remove('active'));
    tabPanes.forEach(p => p.classList.remove('active'));
    
    const generationTab = document.querySelector('[data-tab="generation"]');
    const generationPane = document.getElementById('tab-generation');
    
    if (generationTab) generationTab.classList.add('active');
    if (generationPane) generationPane.classList.add('active');
    
    console.log('📋 Panneau génération ouvert');
}

function handleLogin() {
    const password = passwordInput.value;
    
    if (password === 'admin') {
        loginModal.classList.remove('active');
        loginError.classList.remove('active');
        passwordInput.value = '';
        isAdminLoggedIn = true;
        loginBtn.textContent = '🔓 Admin';
        loginBtn.classList.add('admin-active');

        // Afficher le bouton de création
        const createBtn = document.getElementById('createArtworkBtn');
        if (createBtn) {
            createBtn.classList.add('visible', 'admin-active');
        }
        
        // Afficher le bouton galerie
        const galleryBtn = document.getElementById('createGalleryBtn');
        if (galleryBtn) {
            galleryBtn.classList.add('visible', 'admin-active');
        }

        alert('✅ Connexion admin réussie !');
        console.log('🔐 Session admin démarrée');
    } else {
        loginError.classList.add('active');
        passwordInput.value = '';
        passwordInput.focus();
    }
}

// ==========================================
// ADMIN PANEL - ÉDITION DES ŒUVRES
// ==========================================

// ==========================================
// GESTION AUDIO (UPLOAD)
// ==========================================

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function initAudioUpload() {
    const audioInput = document.getElementById('artworkAudioInput');
    if (audioInput) {
        audioInput.addEventListener('change', handleAudioUpload);
        console.log('🔊 Upload audio initialisé');
    }
}

async function handleAudioUpload(event) {
    const file = event.target.files[0];
    if (!file || !adminArtworkId) {
        alert('⚠️ Aucune œuvre sélectionnée ou fichier manquant');
        return;
    }
    
    // Vérifier taille (max 10 MB)
    if (file.size > 10 * 1024 * 1024) {
        alert('⚠️ Audio trop volumineux. Maximum 10 MB.');
        return;
    }
    
    // Vérifier type audio
    if (!file.type.startsWith('audio/')) {
        alert('⚠️ Format non supporté. Utilisez MP3, WAV, OGG.');
        return;
    }
    
    try {
        const base64 = await fileToBase64(file);
        
        if (isElectron) {
            // Générer un nom de fichier standardisé : audio-{numero}.ext
            const ext = file.name.split('.').pop();
            const numMatch = adminArtworkId.match(/artwork-(\d+)/);
            const num = numMatch ? numMatch[1] : adminArtworkId;
            const fileName = `audio-${num}.${ext}`;
            const result = await window.electronAPI.saveAudio(fileName, base64);
            if (!result.success) {
                throw new Error(result.error);
            }
        } else {
            // Web : stocker en localStorage
            const savedAudios = JSON.parse(localStorage.getItem(ARTWORK_AUDIO_KEY) || '{}');
            savedAudios[adminArtworkId] = base64;
            localStorage.setItem(ARTWORK_AUDIO_KEY, JSON.stringify(savedAudios));
        }
        
        console.log('🔊 Audio sauvegardé pour', adminArtworkId);
        alert('✅ Audio téléchargé avec succès !');
        
        // Mettre à jour UI du panneau admin
        updateAudioAdminPanel(adminArtworkId, true);
        
        // Si le cartel est ouvert, recharger l'audio
        if (isCartelOpen && currentArtworkId === adminArtworkId) {
            const titleEl = document.querySelector('#cartelTitle');
            loadAudioForArtwork(adminArtworkId, titleEl ? titleEl.textContent : '');
        }
        
        // Réinitialiser l'input
        event.target.value = '';
    } catch (e) {
        console.error('❌ Erreur upload audio:', e);
        alert('⚠️ Erreur lors de l\'upload audio.');
    }
}

function updateAudioAdminPanel(artworkId, hasSavedAudio, filePath = null, isVideoDescription = false) {
    const existingSection = document.getElementById('audioExistingSection');
    const currentAudioPath = document.getElementById('currentAudioPath');
    const deleteAudioBtn = document.getElementById('deleteAudioBtn');
    
    if (!existingSection || !currentAudioPath) return;
    
    if (isVideoDescription) {
        existingSection.style.display = 'block';
        currentAudioPath.textContent = 'Videodescription integree a la video';
        currentAudioPath.style.color = '#2ECC71';
        if (deleteAudioBtn) deleteAudioBtn.style.display = 'none';
    } else if (hasSavedAudio) {
        existingSection.style.display = 'block';
        currentAudioPath.textContent = 'Audio personnalisé (uploadé)';
        currentAudioPath.style.color = '#2ECC71';
        if (deleteAudioBtn) deleteAudioBtn.style.display = 'block';
    } else {
        if (deleteAudioBtn) deleteAudioBtn.style.display = 'block';
        // Vérifier si un fichier physique existe
        const numMatch = artworkId.match(/artwork-(\d+)/);
        if (numMatch) {
            const audioNum = numMatch[1];
            const path = filePath || `assets/audiodescriptions/audio-${audioNum}.mp3`;
            existingSection.style.display = 'block';
            currentAudioPath.textContent = path;
            currentAudioPath.style.color = '#87CEEB';
        } else {
            existingSection.style.display = 'none';
        }
    }
}

function confirmDeleteAudio() {
    if (!adminArtworkId) {
        alert('⚠️ Aucune œuvre sélectionnée');
        return;
    }
    const confirmed = confirm(`🗑️ Supprimer l'audio de "${adminArtworkId}" ?`);
    if (!confirmed) return;
    
    if (isElectron) {
        window.electronAPI.deleteAudio(adminArtworkId).then(() => {
            alert('✅ Audio supprimé');
            updateAudioAdminPanel(adminArtworkId, false);
            // Si le cartel est ouvert, recharger l'audio
            if (isCartelOpen && currentArtworkId === adminArtworkId) {
                const titleEl = document.querySelector('#cartelTitle');
                loadAudioForArtwork(adminArtworkId, titleEl ? titleEl.textContent : '');
            }
        }).catch(err => {
            console.error('Erreur suppression audio:', err);
            alert('⚠️ Erreur lors de la suppression');
        });
    } else {
        const savedAudios = JSON.parse(localStorage.getItem(ARTWORK_AUDIO_KEY) || '{}');
        delete savedAudios[adminArtworkId];
        localStorage.setItem(ARTWORK_AUDIO_KEY, JSON.stringify(savedAudios));
        
        alert('✅ Audio supprimé');
        updateAudioAdminPanel(adminArtworkId, false);
        
        // Si le cartel est ouvert, recharger l'audio
        if (isCartelOpen && currentArtworkId === adminArtworkId) {
            const titleEl = document.querySelector('#cartelTitle');
            loadAudioForArtwork(adminArtworkId, titleEl ? titleEl.textContent : '');
        }
    }
}

function setupAdminPanelControls() {
    const closeAdminBtn = document.getElementById('closeAdminBtn');
    const deleteArtworkBtn = document.getElementById('deleteArtworkBtn');
    const posXInput = document.getElementById('posX');
    const posYInput = document.getElementById('posY');
    const posZInput = document.getElementById('posZ');
    const rotYInput = document.getElementById('rotY');
    const scaleInput = document.getElementById('scale');
    const borderWidthInput = document.getElementById('borderWidth');
    const saveBtn = document.getElementById('saveArtworkBtn');
    
    // Fermer le panel admin
    if (closeAdminBtn) {
        closeAdminBtn.addEventListener('click', closeAdminPanel);
    }
    
    // Supprimer l'œuvre
    if (deleteArtworkBtn) {
        deleteArtworkBtn.addEventListener('click', confirmDeleteArtwork);
    }
    
    // Mettre à jour les valeurs affichées et l'œuvre en temps réel
    if (posXInput) {
        posXInput.addEventListener('input', (e) => {
            document.getElementById('posXValue').textContent = e.target.value;
            updateArtworkPosition();
        });
    }
    if (posYInput) {
        posYInput.addEventListener('input', (e) => {
            document.getElementById('posYValue').textContent = e.target.value;
            updateArtworkPosition();
        });
    }
    if (posZInput) {
        posZInput.addEventListener('input', (e) => {
            document.getElementById('posZValue').textContent = e.target.value;
            updateArtworkPosition();
        });
    }
    if (rotYInput) {
        rotYInput.addEventListener('input', (e) => {
            document.getElementById('rotYValue').textContent = e.target.value + '°';
            updateArtworkRotation();
        });
    }
    if (scaleInput) {
        scaleInput.addEventListener('input', (e) => {
            document.getElementById('scaleValue').textContent = e.target.value + 'x';
            updateArtworkScale();
        });
    }
    if (borderWidthInput) {
        borderWidthInput.addEventListener('input', (e) => {
            document.getElementById('borderWidthValue').textContent = parseFloat(e.target.value).toFixed(2) + 'm';
            updateArtworkBorder();
        });
    }
    
    // Mise à jour du cartel en temps réel
    const titleInput = document.getElementById('artworkTitle');
    const artistInput = document.getElementById('artworkArtist');
    const descInput = document.getElementById('artworkDescription');
    
    if (titleInput) {
        titleInput.addEventListener('input', (e) => updateArtworkCartel());
    }
    if (artistInput) {
        artistInput.addEventListener('input', (e) => updateArtworkCartel());
    }
    if (descInput) {
        descInput.addEventListener('input', (e) => updateArtworkCartel());
    }
    
    // Sauvegarder
    if (saveBtn) {
        saveBtn.addEventListener('click', saveArtworkData);
    }

    // Suppression audio
    const deleteAudioBtn = document.getElementById('deleteAudioBtn');
    if (deleteAudioBtn) {
        deleteAudioBtn.addEventListener('click', confirmDeleteAudio);
    }

    // ==========================================
    // ONGLETS DU PANEL ADMIN
    // ==========================================
    initAdminTabs();
}

function initAdminTabs() {
    const tabButtons = document.querySelectorAll('.admin-tab-btn');
    const tabPanes = document.querySelectorAll('.admin-tab-pane');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');

            // Désactiver tous les onglets
            tabButtons.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));

            // Activer l'onglet cliqué
            btn.classList.add('active');
            const targetPane = document.getElementById(`tab-${tabId}`);
            if (targetPane) {
                targetPane.classList.add('active');
            }
        });
    });
}



async function openAdminPanel(artworkId) {
    if (!isAdminLoggedIn) return;

    // En mode Electron, ouvrir la fenêtre admin séparée (meilleure expérience)
    if (isElectron && window.electronAPI && window.electronAPI.openAdminWindow) {
        try {
            await window.electronAPI.openAdminWindow(artworkId);
            return;
        } catch (e) {
            console.error('Erreur ouverture fenêtre admin Electron:', e);
            // Fallback vers panneau intégré
        }
    }

    // Mode web ou fallback: panneau admin intégré dans la page
    adminArtworkId = artworkId;
    const artwork = document.querySelector(`#${artworkId}`);
    if (!artwork) return;

    document.body.classList.add('ui-active');

    // Cacher le cartel (uiContainer) s'il est visible pour éviter qu'il ne bloque l'admin panel
    const uiContainer = document.getElementById('uiContainer');
    if (uiContainer && !uiContainer.classList.contains('hidden')) {
        uiContainer.classList.add('hidden');
    }

    const pos = artwork.getAttribute('position');
    const rot = artwork.getAttribute('rotation') || { x: 0, y: 0, z: 0 };
    const scale = artwork.getAttribute('scale') || { x: 1, y: 1, z: 1 };

    const numMatch = artworkId.match(/artwork-(\d+)/);
    const displayName = numMatch ? `Tableau ${numMatch[1]}` : artworkId;
    document.getElementById('selectedArtwork').textContent = displayName;
    document.getElementById('posX').value = pos.x;
    document.getElementById('posXValue').textContent = pos.x;
    document.getElementById('posY').value = pos.y;
    document.getElementById('posYValue').textContent = pos.y;
    document.getElementById('posZ').value = pos.z;
    document.getElementById('posZValue').textContent = pos.z;
    document.getElementById('rotY').value = rot.y;
    document.getElementById('rotYValue').textContent = rot.y + '°';
    document.getElementById('scale').value = scale.x;
    document.getElementById('scaleValue').textContent = scale.x + 'x';

    // Charger la bordure depuis les données sauvegardées
    let borderWidth = 0.1;
    if (isElectron) {
        const savedDataResult = await loadArtworkDataFromFile();
        const savedData = savedDataResult.success ? savedDataResult.data : {};
        borderWidth = savedData[artworkId]?.borderWidth || 0.1;
    } else {
        const savedData = JSON.parse(localStorage.getItem('artworkData') || '{}');
        borderWidth = savedData[artworkId]?.borderWidth || 0.1;
    }
    document.getElementById('borderWidth').value = borderWidth;
    document.getElementById('borderWidthValue').textContent = borderWidth.toFixed(2) + 'm';

    // Charger les informations du cartel (priorité aux fichiers JSON)
    let title = '', artist = '', description = '';

    // Vérifier d'abord dans cartelsData (déjà chargé)
    if (cartelsData[artworkId]) {
        title = cartelsData[artworkId].title || '';
        artist = cartelsData[artworkId].artist || '';
        description = cartelsData[artworkId].description || '';
        console.log(`📂 Cartel chargé depuis cartelsData pour ${artworkId}`);
    } else if (numMatch) {
        // Charger via IPC (vérifie userData puis assets)
        const result = await loadCartelFromFileIPC(artworkId);
        if (result.success) {
            cartelsData[artworkId] = result.data;
            title = result.data.title || '';
            artist = result.data.artist || '';
            description = result.data.description || '';
            console.log(`📥 Cartel chargé via IPC pour ${artworkId}`);
        } else {
            // Fallback vers attributs HTML
            title = artwork.getAttribute('data-title') || '';
            artist = artwork.getAttribute('data-artist') || '';
            description = artwork.getAttribute('data-description') || '';
            console.log(`📋 Fallback HTML pour ${artworkId} (fichier non trouvé)`);
        }
    } else {
        // Pas de numéro, fallback HTML
        title = artwork.getAttribute('data-title') || '';
        artist = artwork.getAttribute('data-artist') || '';
        description = artwork.getAttribute('data-description') || '';
    }

    document.getElementById('artworkTitle').value = title;
    document.getElementById('artworkArtist').value = artist;
    document.getElementById('artworkDescription').value = description;

    // Charger l'image sauvegardée si elle existe, sinon utiliser l'image par défaut
    try {
        const savedMedia = await loadArtworkMediaFromStorage(artworkId);
        if (savedMedia) {
            updateArtworkPreview(savedMedia.src, savedMedia.mediaType);
        } else {
            const media = getArtworkMediaElement(artwork);
            if (media) {
                updateArtworkPreview(getArtworkMediaSource(artwork), getArtworkMediaType(artwork));
            }
        }
    } catch (e) {
        console.error('❌ Erreur chargement image aperçu:', e);
    }

    // Mettre à jour la section audio (affiche si audio existe)
    updateAudioAdminPanel(artworkId, false, null, getArtworkMediaType(artwork) === 'video');

    adminPanel.classList.remove('hidden');
}

function updateArtworkPosition() {
    if (!adminArtworkId) return;
    
    const artwork = document.querySelector(`#${adminArtworkId}`);
    if (!artwork) return;
    
    const x = parseFloat(document.getElementById('posX').value);
    const y = parseFloat(document.getElementById('posY').value);
    const z = parseFloat(document.getElementById('posZ').value);
    
    artwork.setAttribute('position', { x, y, z });
}

function updateArtworkRotation() {
    if (!adminArtworkId) return;
    
    const artwork = document.querySelector(`#${adminArtworkId}`);
    if (!artwork) return;
    
    const rotY = parseFloat(document.getElementById('rotY').value);
    const currentRot = artwork.getAttribute('rotation') || { x: 0, y: 0, z: 0 };
    
    artwork.setAttribute('rotation', { x: currentRot.x, y: rotY, z: currentRot.z });
}

function updateArtworkBorder() {
    if (!adminArtworkId) return;
    
    const artwork = document.querySelector(`#${adminArtworkId}`);
    if (!artwork) return;
    
    const borderVal = parseFloat(document.getElementById('borderWidth').value);
    const imgPlane = getArtworkMediaElement(artwork);
    const frameBox = getArtworkFrameElement(artwork);
    
    if (imgPlane && frameBox) {
        const width = parseFloat(imgPlane.getAttribute('width'));
        const height = parseFloat(imgPlane.getAttribute('height'));
        if (isNaN(width) || isNaN(height)) {
            console.warn('Dimensions de l\'image non encore définies');
            return;
        }
        frameBox.setAttribute('width', width + borderVal * 2);
        frameBox.setAttribute('height', height + borderVal * 2);
    }
}

function updateArtworkScale() {
    if (!adminArtworkId) return;
    
    const artwork = document.querySelector(`#${adminArtworkId}`);
    if (!artwork) return;
    
    const scaleVal = parseFloat(document.getElementById('scale').value);
    artwork.setAttribute('scale', { x: scaleVal, y: scaleVal, z: scaleVal });
}

function updateArtworkCartel() {
    if (!adminArtworkId) return;
    
    const artwork = document.querySelector(`#${adminArtworkId}`);
    if (!artwork) return;
    
    const title = document.getElementById('artworkTitle').value;
    const artist = document.getElementById('artworkArtist').value;
    const description = document.getElementById('artworkDescription').value;
    
    artwork.setAttribute('data-title', title);
    artwork.setAttribute('data-artist', artist);
    artwork.setAttribute('data-description', description);
}

// ==========================================
// SAUVEGARDE DES MÉTADONNÉES
// ==========================================

async function saveArtworkData(silent = false) {
    if (!adminArtworkId) {
        console.warn('⚠️ Aucune œuvre sélectionnée');
        return;
    }

    const artwork = document.querySelector(`#${adminArtworkId}`);
    if (!artwork) {
        console.error(`❌ Entité #${adminArtworkId} non trouvée`);
        return;
    }

    // Les champs sont déjà mis à jour en temps réel, mais on récupère au cas où
    const title = document.getElementById('artworkTitle').value;
    const artist = document.getElementById('artworkArtist').value;
    const description = document.getElementById('artworkDescription').value;

    // Mettre à jour les attributs (sécurité)
    if (title) artwork.setAttribute('data-title', title);
    if (artist) artwork.setAttribute('data-artist', artist);
    if (description) artwork.setAttribute('data-description', description);

    // Sauvegarder le cartel via IPC ou localStorage
    await saveCartelToFileIPC(adminArtworkId, { title, artist, description });
    
    // Mettre à jour le cache mémoire pour que handleArtworkClick voit les nouvelles infos
    cartelsData[adminArtworkId] = { title, artist, description };

    // Récupérer position, rotation, scale
    const pos = artwork.getAttribute('position');
    const rot = artwork.getAttribute('rotation') || { x: 0, y: 0, z: 0 };
    const scale = artwork.getAttribute('scale') || { x: 1, y: 1, z: 1 };

    // Récupérer la largeur de bordure
    const borderWidth = parseFloat(document.getElementById('borderWidth').value);
    const mediaSrc = getArtworkMediaSource(artwork);
    const mediaType = getArtworkMediaType(artwork);
    const sourceArtworkNumber = artwork.getAttribute('data-source-artwork-number');
    const mediaData = {};
    if (sourceArtworkNumber) {
        mediaData.sourceArtworkNumber = sourceArtworkNumber;
    }
    if (mediaSrc && !mediaSrc.startsWith('data:')) {
        mediaData.mediaSrc = mediaSrc;
        mediaData.mediaType = mediaType;
    }

    // Sauvegarder dans fichier (IPC) ou localStorage
    try {
        const savedData = await loadArtworkDataFromFile();
        const data = savedData.success ? savedData.data : {};
        
        data[adminArtworkId] = {
            position: pos && typeof pos === 'object' ? { ...pos } : pos,
            rotation: rot && typeof rot === 'object' ? { ...rot } : rot,
            scale: scale && typeof scale === 'object' ? { ...scale } : scale,
            borderWidth: borderWidth,
            title: title,
            artist: artist,
            description: description,
            ...mediaData
        };
        
        const result = await saveArtworkDataToFile(data);
        
        if (result.success) {
            // Mettre à jour le cadre avec la nouvelle bordure
            updateArtworkBorder();
            
            if (!silent) {
                alert('✅ Œuvre sauvegardée !');
            }
            console.log('💾 Métadonnées sauvegardées pour:', adminArtworkId);
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('❌ Erreur sauvegarde métadonnées:', error);
        if (!silent) {
            alert('⚠️ Impossible de sauvegarder. Vérifiez la console (F12).');
        }
    }
}

// ==========================================
// CRÉATION & SUPPRESSION D'ŒUVRES
// ==========================================

/**
 * Génère un ID unique pour une nouvelle œuvre
 */
function generateArtworkId() {
    const artworks = document.querySelectorAll('.clickable-artwork');
    let maxNum = 0;
    artworks.forEach(art => {
        const match = art.id.match(/artwork-(\d+)/);
        if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxNum) maxNum = num;
        }
    });
    return `artwork-${maxNum + 1}`;
}

function getSelectedSingleArtworkNumber() {
    const input = document.getElementById('singleArtworkNumberInput');
    const value = input ? Number.parseInt(input.value, 10) : 1;

    if (!Number.isInteger(value) || value < 1) {
        return null;
    }

    if (input) input.value = value;
    return value;
}

function getPlacementInFrontOfVisitor(cameraEl, distance = CONFIG.SINGLE_ARTWORK_DISTANCE) {
    const worldPosition = new THREE.Vector3();
    const forward = new THREE.Vector3();
    const cameraObject = cameraEl.getObject3D?.('camera') || cameraEl.object3D;

    cameraEl.object3D.updateMatrixWorld(true);
    cameraObject.updateMatrixWorld(true);
    cameraObject.getWorldPosition(worldPosition);
    cameraObject.getWorldDirection(forward);
    if (!cameraObject.isCamera) {
        forward.negate();
    }
    forward.y = 0;

    if (forward.lengthSq() < 0.0001) {
        forward.set(0, 0, -1);
    } else {
        forward.normalize();
    }

    const limit = CONFIG.GALLERY_SIZE - 0.5;
    const x = Math.max(-limit, Math.min(limit, worldPosition.x + forward.x * distance));
    const z = Math.max(-limit, Math.min(limit, worldPosition.z + forward.z * distance));
    const y = CONFIG.SINGLE_ARTWORK_HEIGHT;
    const rotY = Math.atan2(-forward.x, -forward.z) * 180 / Math.PI;

    return { x, y, z, rotY };
}

/**
 * Crée une nouvelle œuvre (tableau) positionnée devant l'admin
 */
async function createNewArtwork() {
    if (!isAdminLoggedIn) {
        alert('⚠ Vous devez être admin pour créer un tableau.');
        return;
    }

    const camera = document.querySelector('[camera]');
    if (!camera) {
        alert('❌ Caméra non trouvée');
        return;
    }

    const artworkNumber = getSelectedSingleArtworkNumber();
    if (!artworkNumber) {
        alert('⚠️ Choisissez un numéro de tableau valide.');
        return;
    }

    const selectedMedia = await findArtworkMediaByNumber(artworkNumber);
    if (!selectedMedia) {
        alert(`⚠️ Aucun média trouvé pour le tableau ${artworkNumber} dans assets/tableaux.`);
        return;
    }

    const placement = getPlacementInFrontOfVisitor(camera);

    // Créer l'entité
    const artworkId = generateArtworkId();
    const entity = document.createElement('a-entity');
    entity.setAttribute('id', artworkId);
    entity.setAttribute('class', 'clickable-artwork admin-editable');
    entity.setAttribute('data-id', artworkId);
    entity.setAttribute('data-source-artwork-number', artworkNumber);
    entity.setAttribute('position', `${placement.x.toFixed(2)} ${placement.y.toFixed(2)} ${placement.z.toFixed(2)}`);
    entity.setAttribute('rotation', `0 ${placement.rotY.toFixed(2)} 0`);
    entity.setAttribute('data-title', `Tableau ${artworkNumber}`);
    entity.setAttribute('data-artist', 'Artiste inconnu');
    entity.setAttribute('data-description', 'Description de l\'œuvre...');

    const mediaElement = createArtworkMediaElement(selectedMedia.mediaType);

    // Créer le cadre
    const frameBox = document.createElement('a-box');
    frameBox.setAttribute('class', 'artwork-frame');
    frameBox.setAttribute('depth', '0.05');
    frameBox.setAttribute('position', '0 0 -0.025');
    frameBox.setAttribute('src', 'assets/textures/bordures.jpg');
    frameBox.setAttribute('material', 'metalness: 0.1; roughness: 0.8');

    entity.appendChild(mediaElement);
    entity.appendChild(frameBox);

    // Ajouter à la scène
    const scene = document.querySelector('a-scene');
    scene.appendChild(entity);

    // Attacher le listener de clic
    entity.addEventListener('click', handleArtworkClick);

    applyMediaToArtwork(entity, selectedMedia.src, selectedMedia);

    // Ouvrir immédiatement le panneau d'édition
    await openAdminPanel(artworkId);

    // Sauvegarde automatique (silencieuse) de la nouvelle œuvre
    saveArtworkData(true);

    alert(`✅ Tableau ${artworkNumber} importé : ${artworkId}\nPosition: ${placement.x.toFixed(2)}, ${placement.y.toFixed(2)}, ${placement.z.toFixed(2)}`);
    console.log(`🆕 Œuvre créée: ${artworkId} depuis tableau-${artworkNumber} à (${placement.x}, ${placement.y}, ${placement.z})`);
}

/**
 * Supprime l'œuvre actuellement éditée (avec confirmation)
 */
function confirmDeleteArtwork() {
    if (!adminArtworkId) return;

    const confirmed = confirm(`🗑️ Supprimer définitivement le tableau "${adminArtworkId}" ?\n\nCette action est irréversible.`);

    if (!confirmed) {
        console.log('❌ Suppression annulée');
        return;
    }

    deleteArtwork(adminArtworkId);
}

/**
 * Supprime une œuvre de la scène et du stockage
 */
async function deleteArtwork(artworkId) {
    const artwork = document.querySelector(`#${artworkId}`);
    if (artwork) {
        artwork.remove();
        console.log(`🗑️ Œuvre ${artworkId} supprimée de la scène`);
    }

    // Supprimer les données du fichier ou localStorage
    try {
        const result = await loadArtworkDataFromFile();
        const savedData = result.success ? result.data : {};
        delete savedData[artworkId];
        await saveArtworkDataToFile(savedData);

        // Supprimer l'image associée si elle existe
        if (isElectron) {
            // Supprimer toutes les images associées (toutes extensions)
            const imgDirResult = await window.electronAPI.listFiles('assets/tableaux');
            if (imgDirResult.success) {
                for (const f of imgDirResult.files) {
                    if (f.startsWith(artworkId + '.')) {
                        await window.electronAPI.deleteFile('assets/tableaux/' + f);
                    }
                }
            }
            // Supprimer le cartel
            await window.electronAPI.deleteFile(`assets/cartels/${artworkId}.json`);
            // Supprimer l'audio
            await window.electronAPI.deleteAudio(artworkId);
        } else {
            const savedImages = JSON.parse(localStorage.getItem(ARTWORK_IMAGES_KEY) || '{}');
            delete savedImages[artworkId];
            localStorage.setItem(ARTWORK_IMAGES_KEY, JSON.stringify(savedImages));

            const savedCartels = JSON.parse(localStorage.getItem(ARTWORK_CARTELS_KEY) || '{}');
            delete savedCartels[artworkId];
            localStorage.setItem(ARTWORK_CARTELS_KEY, JSON.stringify(savedCartels));

            const savedAudios = JSON.parse(localStorage.getItem(ARTWORK_AUDIO_KEY) || '{}');
            delete savedAudios[artworkId];
            localStorage.setItem(ARTWORK_AUDIO_KEY, JSON.stringify(savedAudios));
        }

        console.log(`💾 Données supprimées pour ${artworkId}`);
    } catch (e) {
        console.error('❌ Erreur suppression:', e);
    }

    // Fermer le panneau admin
    closeAdminPanel();

    alert(`✅ Tableau "${artworkId}" supprimé avec succès`);
}

// ==========================================
// SUPPRESSION & GÉNÉRATION DE GALERIE
// ==========================================

async function deleteAllArtworks() {
    const confirmed = confirm('🗑️ Supprimer TOUS les tableaux de la galerie ?\n\nCette action est irréversible !');
    
    if (!confirmed) {
        console.log('❌ Suppression annulée');
        return;
    }
    
    const artworks = document.querySelectorAll('.clickable-artwork');
    const ids = Array.from(artworks).map(a => a.id);
    let count = 0;
    
    artworks.forEach(artwork => {
        artwork.remove();
        count++;
    });
    
    try {
        if (isElectron) {
            // Supprimer les fichiers associés pour chaque œuvre
            for (const artworkId of ids) {
                // Images (toutes extensions)
                const imgDirResult = await window.electronAPI.listFiles('assets/tableaux');
                if (imgDirResult.success) {
                    for (const f of imgDirResult.files) {
                        if (f.startsWith(artworkId + '.')) {
                            await window.electronAPI.deleteFile('assets/tableaux/' + f);
                        }
                    }
                }
                // Cartel
                await window.electronAPI.deleteFile(`assets/cartels/${artworkId}.json`);
                // Audio
                await window.electronAPI.deleteAudio(artworkId);
            }
        } else {
            localStorage.removeItem('artworkData');
            localStorage.removeItem(ARTWORK_IMAGES_KEY);
            localStorage.removeItem(ARTWORK_AUDIO_KEY);
        }
    } catch (e) {
        console.error('❌ Erreur suppression:', e);
    }
    
    alert(`✅ ${count} tableaux supprimés avec succès`);
    console.log(`🗑️ ${count} œuvres supprimées`);
}

function getGalleryWallCounts(totalCount) {
    const base = Math.floor(totalCount / 4);
    const counts = [base, base, base, base]; // front, right, back, left

    switch (totalCount % 4) {
        case 1:
            counts[2] += 1;
            break;
        case 2:
            counts[1] += 1;
            counts[3] += 1;
            break;
        case 3:
            counts[1] += 1;
            counts[2] += 1;
            counts[3] += 1;
            break;
    }

    return counts;
}

function getGalleryWallSummary(wallCounts) {
    return `devant ${wallCounts[0]}, droite ${wallCounts[1]}, derriere ${wallCounts[2]}, gauche ${wallCounts[3]}`;
}

function getClockwiseGalleryPlacement(index, wallCounts, spacing, y) {
    const wallOffset = 0.2;
    const limit = CONFIG.GALLERY_SIZE;
    let wallIndex = 0;
    let firstIndexOnWall = 0;

    for (let i = 0; i < wallCounts.length; i++) {
        const countOnWall = wallCounts[i];
        if (index < firstIndexOnWall + countOnWall) {
            wallIndex = i;
            break;
        }
        firstIndexOnWall += countOnWall;
    }

    const wallCount = Math.max(1, wallCounts[wallIndex]);
    const positionOnWall = index - firstIndexOnWall;
    const totalSpan = (wallCount - 1) * spacing;
    const offset = -totalSpan / 2 + positionOnWall * spacing;

    // Clockwise from the wall facing the visitor at spawn: front -> right -> back -> left.
    if (wallIndex === 0) {
        return { x: offset, y, z: -limit + wallOffset, rotY: 0 };
    }

    if (wallIndex === 1) {
        return { x: limit - wallOffset, y, z: offset, rotY: -90 };
    }

    if (wallIndex === 2) {
        return { x: -offset, y, z: limit - wallOffset, rotY: 180 };
    }

    return { x: -limit + wallOffset, y, z: -offset, rotY: 90 };
}

async function generateGallery() {
    const count = Number(document.getElementById('galleryCount').value);
    const globalScale = parseFloat(document.getElementById('globalScale').value);
    const globalBorder = parseFloat(document.getElementById('globalBorderWidth').value);
    const globalY = parseFloat(document.getElementById('globalYPos').value);
    const globalSpacing = parseFloat(document.getElementById('globalSpacing').value) || 1;

    if (!Number.isInteger(count) || count < 1) {
        alert('Choisissez un nombre de tableaux valide.');
        return;
    }

    const confirmed = confirm(`🔨 Générer une galerie avec ${count} tableaux ?\n\nCela supprimera tous les tableaux existants.`);

    if (!confirmed) {
        console.log('❌ Génération annulée');
        return;
    }

    await deleteAllArtworksWithoutConfirm();

    const wallCounts = getGalleryWallCounts(count);
    const perWall = Math.max(...wallCounts);
    const artworks = [];

    for (let i = 0; i < count; i++) {
        const wallIndex = Math.floor(i / perWall) % 4;
        const positionOnWall = i % perWall;

        let x, y, z, rotY;

        const wallPositions = {
            0: { axis: 'x', limit: 15, rot: -90, offsetDirection: 1 },
            1: { axis: 'z', limit: 15, rot: 180, offsetDirection: -1 },
            2: { axis: 'x', limit: -15, rot: 90, offsetDirection: -1 },
            3: { axis: 'z', limit: -15, rot: 0, offsetDirection: 1 }
        };

        const wall = wallPositions[wallIndex];
        const totalSpan = (perWall - 1) * globalSpacing;
        const startOffset = -totalSpan / 2;
        const offset = startOffset + positionOnWall * globalSpacing;
        const positionedOffset = offset * (wall.offsetDirection || 1);

        // Décale les tableaux de 20 cm vers l'intérieur de la galerie
        // pour que le cadre soit légèrement en avant du mur
        const WALL_OFFSET = 0.2;

        if (wall.axis === 'z') {
            x = positionedOffset;
            y = globalY;
            z = wall.limit < 0 ? wall.limit + WALL_OFFSET : wall.limit - WALL_OFFSET;
            rotY = wall.rot;
        } else {
            x = wall.limit < 0 ? wall.limit + WALL_OFFSET : wall.limit - WALL_OFFSET;
            y = globalY;
            z = positionedOffset;
            rotY = wall.rot;
        }
        ({ x, y, z, rotY } = getClockwiseGalleryPlacement(i, wallCounts, globalSpacing, globalY));
        
        const entity = document.createElement('a-entity');
        const artworkId = `artwork-${i + 1}`;
        
        entity.setAttribute('id', artworkId);
        entity.setAttribute('class', 'clickable-artwork admin-editable');
        entity.setAttribute('data-id', artworkId);
        entity.setAttribute('position', `${x.toFixed(2)} ${y.toFixed(2)} ${z.toFixed(2)}`);
        entity.setAttribute('rotation', `0 ${rotY} 0`);
        entity.setAttribute('scale', `${globalScale} ${globalScale} ${globalScale}`);
        entity.setAttribute('data-title', `Tableau ${i + 1}`);
        entity.setAttribute('data-artist', 'Artiste');
        entity.setAttribute('data-description', `Description du tableau ${i + 1}`);
        
        const imgNum = i + 1;
        const selectedMedia = await findArtworkMediaByNumber(imgNum);

        const imgPlane = createArtworkMediaElement(selectedMedia ? selectedMedia.mediaType : 'image');
        if (!selectedMedia) {
            const imgPath = `assets/tableaux/tableau-${imgNum}`;
            imgPlane.setAttribute('src', `${imgPath}.jpeg`);
            imgPlane.setAttribute('data-src', `${imgPath}.jpeg`);
            imgPlane.setAttribute('data-fallback', `${imgPath}.jpg`);
            imgPlane.setAttribute('data-fallback-2', `${imgPath}.JPG`);
            imgPlane.setAttribute('data-fallback-3', `${imgPath}.JPEG`);
            imgPlane.setAttribute('data-fallback-4', `${imgPath}.Jpeg`);
            imgPlane.setAttribute('data-fallback-5', `${imgPath}.png`);
            imgPlane.setAttribute('data-fallback-6', `${imgPath}.mp4`);
            imgPlane.setAttribute('data-fallback-7', `${imgPath}.webm`);
        }
        
        const frameBox = document.createElement('a-box');
        frameBox.setAttribute('class', 'artwork-frame');
        frameBox.setAttribute('depth', '0.05');
        frameBox.setAttribute('position', '0 0 -0.025');
        frameBox.setAttribute('src', 'assets/textures/bordures.jpg');
        frameBox.setAttribute('material', 'metalness: 0.1; roughness: 0.8');
        
        entity.appendChild(imgPlane);
        entity.appendChild(frameBox);
        
        const scene = document.querySelector('a-scene');
        scene.appendChild(entity);
        
        entity.addEventListener('click', handleArtworkClick);
        
        if (selectedMedia) {
            applyMediaToArtwork(entity, selectedMedia.src, {
                ...selectedMedia,
                borderWidth: globalBorder
            });
        } else {
            applyImageDimensionsWithBorder(entity, `assets/tableaux/tableau-${imgNum}.jpeg`, globalBorder);
        }
        
        artworks.push({
            id: artworkId,
            x, y, z,
            rotY,
            scale: globalScale,
            borderWidth: globalBorder
        });
    }
    
    await saveGeneratedGallery(artworks);
    
    await loadCartelsFromFiles();
    
    alert(`✅ Galerie générée avec ${count} tableaux !\nRépartition : ${getGalleryWallSummary(wallCounts)}.`);
    console.log(`🎨 Galerie générée: ${count} tableaux (${getGalleryWallSummary(wallCounts)})`);
}

async function deleteAllArtworksWithoutConfirm() {
    const artworks = document.querySelectorAll('.clickable-artwork');
    const ids = Array.from(artworks).map(a => a.id);
    // Supprimer tous les tableaux du DOM
    artworks.forEach(artwork => {
        if (artwork.parentNode) {
            artwork.parentNode.removeChild(artwork);
        }
    });

    try {
        if (isElectron) {
            // Supprimer les fichiers associés pour chaque œuvre
            for (const artworkId of ids) {
                // Images (toutes extensions)
                const imgDirResult = await window.electronAPI.listFiles('assets/tableaux');
                if (imgDirResult.success) {
                    for (const f of imgDirResult.files) {
                        if (f.startsWith(artworkId + '.')) {
                            await window.electronAPI.deleteFile('assets/tableaux/' + f);
                        }
                    }
                }
                // Cartel
                await window.electronAPI.deleteFile(`assets/cartels/${artworkId}.json`);
                // Audio
                await window.electronAPI.deleteAudio(artworkId);
            }
            // Réinitialiser les données des œuvres
            await saveArtworkDataToFile({});
        } else {
            localStorage.removeItem('artworkData');
            localStorage.removeItem(ARTWORK_IMAGES_KEY);
            localStorage.removeItem(ARTWORK_AUDIO_KEY);
        }
    } catch (e) {
        console.error('❌ Erreur suppression:', e);
    }

    console.log('🗑️ Tous les tableaux supprimés');
}

function applyImageDimensionsWithBorder(artwork, src, borderWidth) {
    const img = new Image();
    img.onload = function() {
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        
        if (!w || !h || w <= 0 || h <= 0) {
            w = 3000;
            h = 2250;
        }
        
        const displayWidth = w * 0.001;
        const displayHeight = h * 0.001;
        
        const imgPlane = getArtworkMediaElement(artwork);
        const frameBox = getArtworkFrameElement(artwork);
        
        if (imgPlane) {
            imgPlane.setAttribute('width', displayWidth);
            imgPlane.setAttribute('height', displayHeight);
        }
        if (frameBox) {
            frameBox.setAttribute('width', displayWidth + borderWidth * 2);
            frameBox.setAttribute('height', displayHeight + borderWidth * 2);
        }
    };
    img.src = src;
}

async function saveGeneratedGallery(artworks) {
    try {
        const data = {};
        artworks.forEach(art => {
            data[art.id] = {
                position: { x: art.x, y: art.y, z: art.z },
                rotation: { x: 0, y: art.rotY, z: 0 },
                scale: { x: art.scale, y: art.scale, z: art.scale },
                borderWidth: art.borderWidth,
                title: `Tableau ${art.id.split('-')[1]}`,
                artist: 'Artiste',
                description: `Description du tableau ${art.id.split('-')[1]}`
            };
        });
        await saveArtworkDataToFile(data);
        console.log('💾 Galerie sauvegardée');
    } catch (e) {
        console.error('❌ Erreur sauvegarde:', e);
    }
}

function initGenerationControls() {
    const generateBtn = document.getElementById('generateGalleryBtn');
    const deleteAllBtn = document.getElementById('deleteAllArtworksBtn');
    const createSingleGalleryBtn = document.getElementById('createSingleArtworkGalleryBtn');
    
    if (generateBtn) {
        generateBtn.addEventListener('click', () => {
            generateGallery().catch(e => console.error('Erreur generation galerie:', e));
        });
        console.log('🔨 Génération galerie initialisée');
    }
    
    if (deleteAllBtn) {
        deleteAllBtn.addEventListener('click', deleteAllArtworks);
        console.log('🗑️ Suppression tous tableaux initialisée');
    }
    
    if (createSingleGalleryBtn) {
        createSingleGalleryBtn.addEventListener('click', async () => {
            createSingleGalleryBtn.disabled = true;
            try {
                await createNewArtwork();
            } finally {
                createSingleGalleryBtn.disabled = false;
            }
        });
        console.log('Creation tableau unique initialisee dans onglet galerie');
    }

    const singleArtworkNumberInput = document.getElementById('singleArtworkNumberInput');
    if (singleArtworkNumberInput && createSingleGalleryBtn) {
        singleArtworkNumberInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                createSingleGalleryBtn.click();
            }
        });
    }

    const globalScaleInput = document.getElementById('globalScale');
    const globalBorderInput = document.getElementById('globalBorderWidth');
    const globalYInput = document.getElementById('globalYPos');
    
    if (globalScaleInput) {
        globalScaleInput.addEventListener('input', (e) => {
            const span = document.getElementById('globalScaleValue');
            if (span) span.textContent = e.target.value + 'x';
            applyGlobalSettings(); // Appliquer en direct
        });
    }
    if (globalBorderInput) {
        globalBorderInput.addEventListener('input', (e) => {
            const span = document.getElementById('globalBorderWidthValue');
            if (span) span.textContent = parseFloat(e.target.value).toFixed(2) + ' m';
            applyGlobalSettings(); // Appliquer en direct
        });
    }
    if (globalYInput) {
        globalYInput.addEventListener('input', (e) => {
            const span = document.getElementById('globalYPosValue');
            if (span) span.textContent = parseFloat(e.target.value).toFixed(2) + ' m';
            applyGlobalSettings(); // Appliquer en direct
        });
    }
    
    const globalSpacingInput = document.getElementById('globalSpacing');
    if (globalSpacingInput) {
        globalSpacingInput.addEventListener('input', (e) => {
            const span = document.getElementById('globalSpacingValue');
            if (span) span.textContent = parseFloat(e.target.value).toFixed(1) + ' m';
            updateArtPosition(); // Mettre à jour les positions en temps réel
        });
    }
    
    // Gestion des onglets du panneau galerie
    const galleryTabButtons = document.querySelectorAll('.gallery-tab-btn');
    const galleryTabPanes = document.querySelectorAll('.gallery-tab-pane');
    
    galleryTabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            
            galleryTabButtons.forEach(b => b.classList.remove('active'));
            galleryTabPanes.forEach(p => p.classList.remove('active'));
            
            btn.classList.add('active');
            const targetPane = document.getElementById(`tab-${tabId}`);
            if (targetPane) {
                targetPane.classList.add('active');
            }
        });
    });

    // === EXPORT / IMPORT CONFIGURATION ===
    const exportConfigBtn = document.getElementById('exportConfigBtn');
    const importConfigBtn = document.getElementById('importConfigBtn');
    const importConfigInput = document.getElementById('importConfigInput');

    if (exportConfigBtn) {
        exportConfigBtn.addEventListener('click', async () => {
            // Récupérer les données actuelles depuis localStorage ou cache
            const result = await loadArtworkDataFromFile();
            const configData = result.success ? result.data : {};
            
            // Ajouter les cartels actuels
            const exportData = {};
            for (const [artworkId, data] of Object.entries(configData)) {
                exportData[artworkId] = {
                    ...data,
                    // Inclure titre, artiste, description depuis cartelsData ou fallback
                    title: cartelsData[artworkId]?.title || data.title || '',
                    artist: cartelsData[artworkId]?.artist || data.artist || '',
                    description: cartelsData[artworkId]?.description || data.description || ''
                };
            }

            // Créer le fichier JSON
            const jsonStr = JSON.stringify(exportData, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = 'configuration.json';
            a.click();
            URL.revokeObjectURL(url);
            
            console.log('✅ Configuration téléchargée');
            alert('✅ Configuration téléchargée ! (configuration.json)');
        });
    }

    if (importConfigInput && importConfigBtn) {
        // Stocker le fichier sélectionné
        let selectedFile = null;
        
        importConfigInput.addEventListener('change', (e) => {
            selectedFile = e.target.files[0];
            if (selectedFile) {
                importConfigBtn.disabled = false;
                importConfigBtn.style.opacity = '1';
                console.log('📂 Fichier sélectionné:', selectedFile.name);
            }
        });

        importConfigBtn.addEventListener('click', async () => {
            if (!selectedFile) {
                alert('⚠️ Veuillez d\'abord sélectionner un fichier configuration.json');
                return;
            }

            const confirmed = confirm(`⚠️ Importer "${selectedFile.name}" ?\nCeci remplacera TOUTES les données actuelles (positions, métadonnées). Les œuvres seront rechargées.`);
            if (!confirmed) return;

            try {
                const text = await selectedFile.text();
                const importedData = JSON.parse(text);
                
                // Valider la structure (doit être un objet, pas un array)
                if (typeof importedData !== 'object' || importedData === null || Array.isArray(importedData)) {
                    throw new Error('Format invalide');
                }

                // Extraire les métadonnées (cartels) depuis la configuration importée
                const importedCartels = {};
                for (const [artworkId, data] of Object.entries(importedData)) {
                    importedCartels[artworkId] = {
                        title: data.title || '',
                        artist: data.artist || '',
                        description: data.description || ''
                    };
                }

                // Sauvegarder dans localStorage
                localStorage.setItem('artworkData', JSON.stringify(importedData));
                
                // Mettre à jour le cache
                window.artworkDataCache = importedData;
                
                // Supprimer toutes les œuvres existantes de la scène avant de recharger
                const existingArtworks = document.querySelectorAll('.clickable-artwork');
                existingArtworks.forEach(artwork => artwork.remove());
                
                // Recharger les œuvres dans la scène (créera seulement celles de la nouvelle config)
                await loadSavedArtworks();
                
                // Recharger les images (précharger et appliquer dimensions)
                await preloadArtworkImages();
                
                // Fermer le panneau galerie
                closeGalleryPanel();
                
                console.log('✅ Configuration importée avec succès');
                alert('✅ Configuration importée ! La galerie a été mise à jour.');
                
                // Reset file input
                importConfigInput.value = '';
                selectedFile = null;
                importConfigBtn.disabled = true;
                importConfigBtn.style.opacity = '0.5';
                
            } catch (e) {
                console.error('❌ Erreur import:', e);
                alert('❌ Erreur: fichier JSON invalide ou corrompu');
            }
        });

        // Désactiver le bouton import par défaut
        importConfigBtn.disabled = true;
        importConfigBtn.style.opacity = '0.5';
    }
}

async function applyGlobalSettings() {
    const globalScale = parseFloat(document.getElementById('globalScale').value);
    const globalBorder = parseFloat(document.getElementById('globalBorderWidth').value);
    const globalY = parseFloat(document.getElementById('globalYPos').value);
    const globalSpacing = parseFloat(document.getElementById('globalSpacing')?.value) || 1;

    const artworks = document.querySelectorAll('.clickable-artwork');
    let count = 0;

    // Charger les données actuelles
    const result = await loadArtworkDataFromFile();
    const savedData = result.success ? result.data : {};

    artworks.forEach(artwork => {
        count++;
        const pos = artwork.getAttribute('position') || { x: 0, y: 3, z: 0 };
        artwork.setAttribute('position', { x: pos.x, y: globalY, z: pos.z });
        artwork.setAttribute('scale', { x: globalScale, y: globalScale, z: globalScale });

        const imgPlane = getArtworkMediaElement(artwork);
        const frameBox = getArtworkFrameElement(artwork);

        if (imgPlane && frameBox) {
            const w = parseFloat(imgPlane.getAttribute('width'));
            const h = parseFloat(imgPlane.getAttribute('height'));

            // Ne pas appliquer la bordure si l'image n'a pas encore de dimensions
            // (pas encore chargée). Les dimensions seront appliquées lors du chargement.
            if (!isNaN(w) && w > 0 && !isNaN(h) && h > 0) {
                frameBox.setAttribute('width', w + globalBorder * 2);
                frameBox.setAttribute('height', h + globalBorder * 2);
            }
        }

        const artworkId = artwork.id;
        if (savedData[artworkId]) {
            savedData[artworkId].borderWidth = globalBorder;
            savedData[artworkId].scale = { x: globalScale, y: globalScale, z: globalScale };
            savedData[artworkId].position = { x: pos.x, y: globalY, z: pos.z };
        }
    });

    // Sauvegarder toutes les modifications
    await saveArtworkDataToFile(savedData);

    console.log(`⚙️ Réglages globaux appliqués: scale=${globalScale}, border=${globalBorder}, y=${globalY}`);
}

async function updateArtPosition() {
    const globalSpacing = parseFloat(document.getElementById('globalSpacing').value) || 1;
    const WALL_OFFSET = 0.2;

    const artworks = Array.from(document.querySelectorAll('.clickable-artwork'));
    if (artworks.length === 0) return;

    // Trier les œuvres par numéro d'ID (artwork-1, artwork-2, etc.)
    artworks.sort((a, b) => {
        const numA = parseInt(a.id.replace('artwork-', '')) || 0;
        const numB = parseInt(b.id.replace('artwork-', '')) || 0;
        return numA - numB;
    });

    const totalCount = artworks.length;
    const wallCounts = getGalleryWallCounts(totalCount);
    const perWall = Math.max(...wallCounts); // Nombre max sur un mur

    const wallPositions = {
        0: { axis: 'z', limit: -15, rot: 0 }, // Mur arrière
        1: { axis: 'z', limit: 15, rot: 180 }, // Mur avant
        2: { axis: 'x', limit: -15, rot: 90 }, // Mur gauche
        3: { axis: 'x', limit: 15, rot: -90 } // Mur droit
    };

    // Charger les données actuelles
    const result = await loadArtworkDataFromFile();
    const savedData = result.success ? result.data : {};

    artworks.forEach((artwork, i) => {
        const wallIndex = Math.floor(i / perWall) % 4;
        const positionOnWall = i % perWall;
        const wall = wallPositions[wallIndex];

        // Calcul de l'espacement centré
        const totalSpan = (perWall - 1) * globalSpacing;
        const startOffset = -totalSpan / 2;
        const offset = startOffset + positionOnWall * globalSpacing;

        let x, y, z;
        const currentPos = artwork.getAttribute('position') || { x: 0, y: 3, z: 0 };
        y = currentPos.y; // Garder la hauteur Y actuelle

        if (wall.axis === 'z') {
            x = offset;
            z = wall.limit < 0 ? wall.limit + WALL_OFFSET : wall.limit - WALL_OFFSET;
        } else {
            x = wall.limit < 0 ? wall.limit + WALL_OFFSET : wall.limit - WALL_OFFSET;
            z = offset;
        }
        const placement = getClockwiseGalleryPlacement(i, wallCounts, globalSpacing, y);
        x = placement.x;
        z = placement.z;

        const newPos = { x, y, z };
        artwork.setAttribute('position', `${x.toFixed(2)} ${y.toFixed(2)} ${z.toFixed(2)}`);
        artwork.setAttribute('rotation', `0 ${placement.rotY} 0`);

        // Sauvegarder la nouvelle position
        if (savedData[artwork.id]) {
            savedData[artwork.id].position = newPos;
            savedData[artwork.id].rotation = { x: 0, y: placement.rotY, z: 0 };
        }
    });

    // Sauvegarder toutes les modifications
    await saveArtworkDataToFile(savedData);

    console.log(`📐 Espacement mis à jour: ${globalSpacing}m (${getGalleryWallSummary(wallCounts)})`);
}

// Note: saveArtworkData() is already defined earlier with borderWidth support

// ==========================================
// GESTION DES IMAGES – UPLOAD & STORAGE
// ==========================================

// Charger les positions des œuvres (fonction existante, ne charge pas les images)
// Les images par défaut sont celles du HTML. On charge les images séparément.

// Charger l'image d'une œuvre spécifique depuis le stockage (IPC ou localStorage)
async function loadArtworkMediaFromStorage(artworkId) {
    try {
        let data = null;
        
        if (isElectron) {
            // En mode Electron, charger l'image depuis le dossier assets
            const result = await window.electronAPI.getImage(artworkId);
            if (result.success && result.data) {
                // Appliquer l'image à l'entité
                data = { src: result.data, mediaType: getMediaTypeFromSource(result.data) };
            } else {
                return null;
            }
        } else {
            const savedImages = JSON.parse(localStorage.getItem(ARTWORK_MEDIA_KEY) || '{}');
            data = savedImages[artworkId];
        }

        if (typeof data === 'string') {
            data = { src: data };
        }
        
        const savedData = await loadArtworkDataFromFile();
        const metadata = savedData.success ? (savedData.data[artworkId] || {}) : {};
        const borderWidth = metadata.borderWidth || 0.1;

        if (data && data.src) {
            const entity = document.querySelector(`#${artworkId}`);
            if (entity) {
                applyMediaToArtwork(entity, data.src, {
                    mediaType: data.mediaType,
                    width: data.width,
                    height: data.height,
                    borderWidth
                });
                const imgPlane = null;
                const frameBox = null;

                if (imgPlane) {
                    // Appliquer l'image sauvegardée (base64)
                    imgPlane.setAttribute('src', data.src);
                    // Restaurer les dimensions de l'image si elles ont été personnalisées
                    if (data.width && data.height) {
                        imgPlane.setAttribute('width', data.width);
                        imgPlane.setAttribute('height', data.height);
                    }
                }

                if (frameBox && data.width && data.height) {
                    // Restaurer les dimensions du cadre avec la bordure sauvegardée
                    frameBox.setAttribute('width', data.width + borderWidth * 2);
                    frameBox.setAttribute('height', data.height + borderWidth * 2);
                }
            }
            return {
                src: data.src,
                mediaType: getMediaTypeFromSource(data.src, data.mediaType),
                width: data.width || null,
                height: data.height || null
            };
        }
    } catch (error) {
        console.error('❌ Erreur chargement image', artworkId, error);
    }
    return null;
}

// Sauvegarder l'image d'une œuvre (IPC ou localStorage)
async function loadArtworkImageFromStorage(artworkId) {
    const media = await loadArtworkMediaFromStorage(artworkId);
    return media ? media.src : null;
}

async function saveArtworkImageToStorage(artworkId, base64, width = null, height = null, mediaType = 'image') {
    try {
        if (isElectron) {
            // Sauvegarder via IPC
            const result = await saveImageIPC(artworkId, base64);
            if (!result.success) {
                throw new Error(result.error);
            }
        } else {
            const savedImages = JSON.parse(localStorage.getItem(ARTWORK_MEDIA_KEY) || '{}');
            // Récupérer l'image existante pour conserver les dimensions si non fournies
            const existing = savedImages[artworkId] || {};
            savedImages[artworkId] = {
                src: base64,
                mediaType,
                width: width || existing.width || (mediaType === 'video' ? DEFAULT_VIDEO_UNITS.width : DEFAULT_IMAGE_UNITS.width),
                height: height || existing.height || (mediaType === 'video' ? DEFAULT_VIDEO_UNITS.height : DEFAULT_IMAGE_UNITS.height)
            };
            localStorage.setItem(ARTWORK_MEDIA_KEY, JSON.stringify(savedImages));
        }
        console.log('🖼️ Image sauvegardée pour', artworkId);
    } catch (error) {
        console.error('❌ Erreur sauvegarde image', artworkId, error);
        alert('⚠️ Impossible de sauvegarder l\'image.');
    }
}

// Mettre à jour l'aperçu de l'image dans le panneau admin
function updateArtworkPreview(base64Src, mediaType = null) {
    const preview = document.getElementById('currentArtworkPreview');
    const videoPreview = document.getElementById('currentArtworkVideoPreview');
    const kind = getMediaTypeFromSource(base64Src, mediaType);

    if (kind === 'video') {
        if (preview) {
            preview.classList.add('hidden');
            preview.removeAttribute('src');
        }
        if (videoPreview) {
            videoPreview.src = base64Src;
            videoPreview.classList.remove('hidden');
            videoPreview.muted = true;
            videoPreview.loop = true;
            videoPreview.load();
            const playPromise = videoPreview.play();
            if (playPromise && typeof playPromise.catch === 'function') {
                playPromise.catch(() => {});
            }
        }
        return;
    }

    if (videoPreview) {
        videoPreview.pause();
        videoPreview.removeAttribute('src');
        videoPreview.classList.add('hidden');
    }
    if (preview) {
        preview.classList.remove('hidden');
        preview.src = base64Src;
    }
}

// Gérer l'upload d'une nouvelle image – mode "contain" : affichage taille réelle proportions exactes
async function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file || !adminArtworkId) return;

    const mediaType = file.type.startsWith('video/') ? 'video' : (file.type.startsWith('image/') ? 'image' : '');
    if (!mediaType) {
        alert('Format non supporte. Utilisez une image ou une video.');
        return;
    }

    const maxSize = mediaType === 'video' ? 50 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxSize) {
        alert(mediaType === 'video' ? 'Video trop volumineuse. Maximum 50 MB.' : 'Image trop volumineuse. Maximum 5 MB.');
        return;
    }

    if (mediaType === 'video') {
        try {
            const originalBase64 = await fileToBase64(file);
            const video = document.createElement('video');

            video.onloadedmetadata = async function() {
                const units = mediaPixelsToUnits(video.videoWidth, video.videoHeight, DEFAULT_VIDEO_UNITS);
                const borderWidthInput = document.getElementById('borderWidth');
                const BORDER = borderWidthInput ? parseFloat(borderWidthInput.value) : 0.1;
                const entity = document.querySelector(`#${adminArtworkId}`);

                if (entity) {
                    applyMediaToArtwork(entity, originalBase64, {
                        mediaType: 'video',
                        width: units.width,
                        height: units.height,
                        borderWidth: BORDER
                    });
                }

                updateArtworkPreview(originalBase64, 'video');
                await saveArtworkImageToStorage(adminArtworkId, originalBase64, units.width, units.height, 'video');
                updateAudioAdminPanel(adminArtworkId, false, null, true);

                event.target.value = '';
                alert(`Video mise a jour!\nDimensions affichees: ${units.width.toFixed(2)}m x ${units.height.toFixed(2)}m`);
            };

            video.onerror = function() {
                alert('Erreur lors de la lecture des dimensions de la video');
            };

            video.preload = 'metadata';
            video.src = originalBase64;
            video.load();
        } catch (e) {
            console.error('Erreur upload video:', e);
            alert('Erreur lors de la lecture de la video');
        }
        return;
    }

    // Vérifier taille (max 5 MB)
    if (file.size > 5 * 1024 * 1024) {
        alert('⚠️ Image trop volumineuse. Maximum 5 MB.');
        return;
    }

    // Vérifier type
    if (!file.type.startsWith('image/')) {
        alert('⚠️ Format non supporté. Utilisez JPG, PNG, SVG ou WebP.');
        return;
    }

    const reader = new FileReader();
    reader.onload = async function(e) {
        const originalBase64 = e.target.result;

        // Charger l'image pour lire ses dimensions originales
        const img = new Image();
        img.onload = async function() {
            let naturalWidth = img.naturalWidth;
            let naturalHeight = img.naturalHeight;
            
            // Fallback si dimensions invalides
            if (!naturalWidth || !naturalHeight || naturalWidth <= 0 || naturalHeight <= 0) {
                console.warn('Dimensions d\'image invalides, utilisation de dimensions par défaut');
                naturalWidth = 3000;
                naturalHeight = 2250;
            }

            const PIXEL_TO_UNIT = 0.001;
            const displayWidth = naturalWidth * PIXEL_TO_UNIT;
            const displayHeight = naturalHeight * PIXEL_TO_UNIT;

            // Récupérer la largeur de bordure depuis le panneau admin (ou 0.1 par défaut)
            const borderWidthInput = document.getElementById('borderWidth');
            const BORDER = borderWidthInput ? parseFloat(borderWidthInput.value) : 0.1;

            // Dimensions du cadre en 3D: image + bordure de chaque côté
            const frameWidth = displayWidth + (BORDER * 2);
            const frameHeight = displayHeight + (BORDER * 2);

            // Appliquer les dimensions à l'entité A-Frame
            const entity = document.querySelector(`#${adminArtworkId}`);
            if (entity) {
                applyMediaToArtwork(entity, originalBase64, {
                    mediaType: 'image',
                    width: displayWidth,
                    height: displayHeight,
                    borderWidth: BORDER
                });
                const imgPlane = entity.querySelector('a-plane.artwork-image');
                const frameBox = entity.querySelector('a-box.artwork-frame');

                if (imgPlane) {
                    imgPlane.setAttribute('width', displayWidth);
                    imgPlane.setAttribute('height', displayHeight);
                    imgPlane.setAttribute('src', originalBase64);
                }

                if (frameBox) {
                    frameBox.setAttribute('width', frameWidth);
                    frameBox.setAttribute('height', frameHeight);
                }
            }

            // Mettre à jour l'aperçu dans le panneau admin
            updateArtworkPreview(originalBase64, 'image');

            // Sauvegarder l'image avec ses dimensions (IPC ou localStorage)
            await saveArtworkImageToStorage(adminArtworkId, originalBase64, displayWidth, displayHeight, 'image');
            updateAudioAdminPanel(adminArtworkId, false);

            alert(`✅ Image mise à jour!\nDimensions affichées: ${displayWidth.toFixed(2)}m × ${displayHeight.toFixed(2)}m\nCadre: bordure ${BORDER.toFixed(2)}m (total: ${frameWidth.toFixed(2)}m × ${frameHeight.toFixed(2)}m)`);
        };
        img.onerror = function() {
            alert('❌ Erreur lors de la lecture des dimensions de l\'image');
        };
        img.src = originalBase64;
    };
    reader.onerror = function() {
        alert('❌ Erreur lors de la lecture du fichier');
    };
    reader.readAsDataURL(file);
}

// Initialiser l'upload d'image
function initImageUpload() {
    try {
        const fileInput = document.getElementById('artworkImageInput');
        if (fileInput) {
            fileInput.addEventListener('change', handleImageUpload);
            console.log('📤 Upload d\'image initialisé');
        }
    } catch (error) {
        console.error('❌ Erreur initialisation upload:', error);
    }
}

// ==========================================
// CHARGEMENT IMAGES AU DÉMARRAGE (optionnel, sans blocage)
// ==========================================

function applyImageDimensions(artwork, src) {
    const img = new Image();
    img.onload = function() {
        let naturalWidth = img.naturalWidth;
        let naturalHeight = img.naturalHeight;
        
        // Fallback si dimensions invalides (ex: SVG sans viewBox)
        if (!naturalWidth || !naturalHeight || naturalWidth <= 0 || naturalHeight <= 0) {
            console.warn(`Dimensions d'image invalides pour ${artwork.id}, utilisation de dimensions par défaut`);
            naturalWidth = 3000; // 3m
            naturalHeight = 2250; // 2.25m
        }
        
        const PIXEL_TO_UNIT = 0.001;
        const displayWidth = naturalWidth * PIXEL_TO_UNIT;
        const displayHeight = naturalHeight * PIXEL_TO_UNIT;
        
        // Déterminer la bordure depuis les données sauvegardées
        let BORDER = 0.1; // défaut
        if (isElectron) {
            if (window.artworkDataCache && window.artworkDataCache[artwork.id]) {
                BORDER = window.artworkDataCache[artwork.id].borderWidth || 0.1;
            }
        } else {
            const savedData = JSON.parse(localStorage.getItem('artworkData') || '{}');
            BORDER = savedData[artwork.id]?.borderWidth || 0.1;
        }

        const imgPlane = getArtworkMediaElement(artwork);
        const frameBox = getArtworkFrameElement(artwork);

        if (imgPlane) {
            imgPlane.setAttribute('width', displayWidth);
            imgPlane.setAttribute('height', displayHeight);
        }
        if (frameBox) {
            frameBox.setAttribute('width', displayWidth + BORDER * 2);
            frameBox.setAttribute('height', displayHeight + BORDER * 2);
        }
        
        console.log(`✅ Dimensions appliquées pour ${artwork.id}: ${displayWidth.toFixed(2)}×${displayHeight.toFixed(2)}m, bordure: ${BORDER}m`);
    };
    img.onerror = function() {
        console.error(`❌ Erreur chargement image pour ${artwork.id}`);
        if (getArtworkNumberFromMediaSource(src)) {
            tryBetterMedia(null, artwork, [src]);
        }
    };
    img.src = src;
}
        


async function loadCartelsFromFiles() {
    const artworks = document.querySelectorAll('.clickable-artwork');
    const maxArtwork = Math.max(...Array.from(artworks).map(a => {
        const match = a.id.match(/artwork-(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
    }), 10); // At least check up to 10

    let loadedCount = 0;
    
    for (let i = 1; i <= maxArtwork; i++) {
        const artworkId = `artwork-${i}`;
        let cartelLoaded = false;
        
        // Priority 1: Try to load physical cartel file from assets/cartels/ (fichier physique)
        const cartelPath = `assets/cartels/cartel-${i}.json`;
        try {
            const response = await fetch(cartelPath + '?t=' + Date.now());
            if (response.ok) {
                const cartelData = await response.json();
                if (cartelData.title) {
                    cartelsData[artworkId] = cartelData;
                    loadedCount++;
                    console.log(`📂 Cartel chargé (fichier physique): ${artworkId} - "${cartelData.title}"`);
                    cartelLoaded = true;
                }
            }
        } catch (e) {
            // File not found, continue to next priority
        }
        
        if (cartelLoaded) continue;
        
        // Priority 2: Try to load via IPC (Electron)
        const result = await loadCartelFromFileIPC(artworkId);
        if (result.success && result.data.title) {
            cartelsData[artworkId] = result.data;
            loadedCount++;
            console.log(`📂 Cartel chargé (IPC): ${artworkId} - "${result.data.title}"`);
            continue;
        }
        
        // Priority 3: Fallback to configuration.json / localStorage (données sauvegardées)
        const savedData = JSON.parse(localStorage.getItem('artworkData') || '{}');
        if (savedData[artworkId] && savedData[artworkId].title) {
            // Only use if it's not a generic "Tableau n" title from auto-generation
            const isGenericTitle = savedData[artworkId].title === `Tableau ${i}`;
            if (!isGenericTitle) {
                cartelsData[artworkId] = {
                    title: savedData[artworkId].title,
                    artist: savedData[artworkId].artist,
                    description: savedData[artworkId].description
                };
                loadedCount++;
                console.log(`📂 Cartel chargé depuis config: ${artworkId} - "${savedData[artworkId].title}"`);
                continue;
            }
        }
        
        // Priority 4: Use HTML data attributes as fallback
        const artworkEl = document.getElementById(artworkId);
        if (artworkEl) {
            const title = artworkEl.getAttribute('data-title');
            const artist = artworkEl.getAttribute('data-artist');
            const description = artworkEl.getAttribute('data-description');
            if (title && title !== `Tableau ${i}`) {
                cartelsData[artworkId] = { title, artist: artist || 'Artiste inconnu', description: description || '' };
                loadedCount++;
                console.log(`📂 Cartel chargé depuis HTML: ${artworkId} - "${title}"`);
            }
        }
    }
    
    console.log(`🔍 Cartels chargés: ${loadedCount} sur ${maxArtwork} artworks`);
}

async function saveCartelToFile(artworkId, title, artist, description) {
    const numMatch = artworkId.match(/artwork-(\d+)/);
    if (!numMatch) return;
    
    const num = numMatch[1];
    const cartelData = { title, artist, description };
    
    // Sauvegarder via IPC ou localStorage
    await saveCartelToFileIPC(artworkId, cartelData);
    
    // Mettre à jour la mémoire
    cartelsData[artworkId] = cartelData;
    
    console.log(`💾 Cartel sauvegardé pour ${artworkId}`);
}

async function preloadArtworkImages() {
    const artworks = document.querySelectorAll('.clickable-artwork');
    for (const artwork of artworks) {
        try {
            const id = artwork.id;
            const imgPlane = getArtworkMediaElement(artwork);
            if (!imgPlane) continue;
            
            const savedMedia = await loadArtworkMediaFromStorage(id);
            const currentSrc = getArtworkMediaSource(artwork);
            
            if (savedMedia) {
                // L'image est déjà appliquée par loadArtworkImageFromStorage (side-effect)
                // On applique juste les dimensions supplémentaires
                // Media already applied by loadArtworkMediaFromStorage.
                console.log(`📷 ${id}: image chargée depuis localStorage`);
                continue;
            }
            
            const configuredMedia = await resolveArtworkMediaData(id, window.artworkDataCache?.[id] || {});
            if (configuredMedia) {
                applyMediaToArtwork(artwork, configuredMedia.src, configuredMedia);
                continue;
            }

            if (currentSrc && currentSrc.includes('/tableaux/tableau-')) {
                const img = new Image();
                img.onload = () => {
                    console.log(`📷 ${id}: image chargée: ${currentSrc}`);
                    applyImageDimensions(artwork, currentSrc);
                };
                img.onerror = () => {
                    console.warn(`⚠️ ${id}: erreur chargement ${currentSrc}, tentative de fallback`);
                    tryBetterImage(imgPlane, artwork);
                };
                img.src = currentSrc;
            }
        } catch (e) {
            console.error('❌ Erreur préchargement images:', e);
        }
    }
}

async function tryBetterMedia(imgPlane, artwork, triedPaths = []) {
    const sourceArtworkNumber = artwork.getAttribute('data-source-artwork-number') || getArtworkNumber(artwork.id);
    const candidates = getDefaultMediaCandidatesByNumber(sourceArtworkNumber).filter(p => !triedPaths.includes(p));
    if (candidates.length === 0) {
        console.warn(`Aucun media trouve pour ${artwork.id}`);
        return;
    }

    const candidate = candidates[0];
    console.log(`Tentative media: ${candidate} pour ${artwork.id}`);
    const tested = await testMediaSource(candidate);

    if (tested) {
        applyMediaToArtwork(artwork, tested.src, tested);
        console.log(`Media charge: ${tested.src} pour ${artwork.id}`);
        return;
    }

    tryBetterMedia(imgPlane, artwork, [...triedPaths, candidate]);
}

function tryBetterImage(imgPlane, artwork, triedPaths = []) {
    return tryBetterMedia(imgPlane, artwork, triedPaths);
    const src = imgPlane.getAttribute('src');
    if (!src) return;
    
    if (src.includes('/tableaux/tableau-')) {
        const numMatch = src.match(/tableau-(\d+)/);
        if (numMatch) {
            const num = numMatch[1];
            // Ordre de priorité : .jpeg (minuscule) d'abord, puis .jpg, puis autres
            const extensions = ['jpeg', 'jpg', 'png', 'gif', 'JPG', 'JPEG', 'PNG', 'GIF', 'Jpeg'];
            const basePath = `assets/tableaux/tableau-${num}.`;
            
            for (const ext of extensions) {
                const p = basePath + ext;
                if (!triedPaths.includes(p)) {
                    console.log(`🔄 Tentative: ${p} pour ${artwork.id}`);
                    imgPlane.setAttribute('src', p);
                    
                    const img = new Image();
                    const newTriedPaths = [...triedPaths, p];
                    
                    img.onload = () => {
                        console.log(`✅ Image chargée: ${p} pour ${artwork.id}`);
                        applyImageDimensions(artwork, p);
                    };
                    img.onerror = () => {
                        if (newTriedPaths.length >= extensions.length) {
                            console.warn(`⚠️ Aucune image trouvée pour ${artwork.id} après ${extensions.length} tentatives`);
                        } else {
                            tryBetterImage(imgPlane, artwork, newTriedPaths);
                        }
                    };
                    img.src = p;
                    return;
                }
            }
        }
    }
}

function tryImageFallback(imgPlane, artwork) {
    const currentSrc = imgPlane.getAttribute('src');
    if (!currentSrc) return;
    
    const img = new Image();
    let handled = false;
    img.onload = () => {
        if (handled) return;
        handled = true;
        applyImageDimensions(artwork, currentSrc);
    };
    img.onerror = () => {
        if (handled) return;
        handled = true;
        const src = imgPlane.getAttribute('src');
        if (!src) return;
        
        if (src.includes('/tableaux/tableau-')) {
            const base = src.replace(/\.[jJpP][eE][gG]$/, '');
            // Ordre de priorité : .jpeg, .jpg, .png
            const fallbacks = [base + '.jpeg', base + '.jpg', base + '.JPG', base + '.JPEG', base + '.png'];
            for (const fb of fallbacks) {
                if (fb !== src) {
                    console.log(`🔍 Fallback: tentative ${fb} pour ${artwork.id}`);
                    imgPlane.setAttribute('src', fb);
                    tryImageFallback(imgPlane, artwork);
                    return;
                }
            }
        }
        
        const fallback = imgPlane.getAttribute('data-fallback');
        const fallback2 = imgPlane.getAttribute('data-fallback-2');
        const fallback3 = imgPlane.getAttribute('data-fallback-3');
        const fallback4 = imgPlane.getAttribute('data-fallback-4');
        const fallback5 = imgPlane.getAttribute('data-fallback-5');
        
        if (fallback) {
            imgPlane.setAttribute('src', fallback);
            imgPlane.removeAttribute('data-fallback');
            tryImageFallback(imgPlane, artwork);
        } else if (fallback2) {
            imgPlane.setAttribute('src', fallback2);
            imgPlane.removeAttribute('data-fallback-2');
            tryImageFallback(imgPlane, artwork);
        } else if (fallback3) {
            imgPlane.setAttribute('src', fallback3);
            imgPlane.removeAttribute('data-fallback-3');
            tryImageFallback(imgPlane, artwork);
        } else if (fallback4) {
            imgPlane.setAttribute('src', fallback4);
            imgPlane.removeAttribute('data-fallback-4');
            tryImageFallback(imgPlane, artwork);
        } else if (fallback5) {
            imgPlane.setAttribute('src', fallback5);
            imgPlane.removeAttribute('data-fallback-5');
            tryImageFallback(imgPlane, artwork);
        }
    };
    img.src = src;
}



async function loadSavedArtworks() {
    const result = await loadArtworkDataFromFile();
    const savedData = result.success ? result.data : {};
    const scene = document.querySelector('a-scene');

    for (const [artworkId, data] of Object.entries(savedData)) {
        let artwork = document.querySelector(`#${artworkId}`);
        
        // Resolve numbered files from disk so stale mediaSrc/mediaType cannot force the wrong renderer.
        const configuredMedia = await resolveArtworkMediaData(artworkId, data);
        const mediaType = configuredMedia ? configuredMedia.mediaType : 'image';
        const mediaSrc = configuredMedia ? configuredMedia.src : null;
        
        // Si l'œuvre n'existe pas dans le DOM, la créer
        if (!artwork && scene) {
            artwork = document.createElement('a-entity');
            artwork.setAttribute('id', artworkId);
            artwork.setAttribute('class', 'clickable-artwork admin-editable');
            if (data.sourceArtworkNumber) {
                artwork.setAttribute('data-source-artwork-number', data.sourceArtworkNumber);
            }
            
            // Create the media element with the correct type from saved data
            const mediaElement = createArtworkMediaElement(mediaType);
            
            // Set the source from saved data if available, otherwise use default fallbacks
            const artworkNum = artworkId.replace('artwork-', '');
            if (mediaSrc) {
                mediaElement.setAttribute('src', mediaSrc);
                mediaElement.setAttribute('data-src', mediaSrc);
                mediaElement.setAttribute('data-media-type', mediaType);
            } else {
                // Default fallback paths
                const imgPath = `assets/tableaux/tableau-${artworkNum}`;
                if (mediaType === 'video') {
                    mediaElement.setAttribute('src', `${imgPath}.mp4`);
                    mediaElement.setAttribute('data-src', `${imgPath}.mp4`);
                    mediaElement.setAttribute('data-fallback', `${imgPath}.webm`);
                } else {
                    mediaElement.setAttribute('src', `${imgPath}.jpeg`);
                    mediaElement.setAttribute('data-src', `${imgPath}.jpeg`);
                    mediaElement.setAttribute('data-fallback', `${imgPath}.jpg`);
                    mediaElement.setAttribute('data-fallback-2', `${imgPath}.JPG`);
                    mediaElement.setAttribute('data-fallback-3', `${imgPath}.JPEG`);
                    mediaElement.setAttribute('data-fallback-4', `${imgPath}.png`);
                }
            }
            
            const frameBox = document.createElement('a-box');
            frameBox.setAttribute('class', 'artwork-frame');
            frameBox.setAttribute('depth', '0.05');
            frameBox.setAttribute('position', '0 0 -0.025');
            frameBox.setAttribute('src', 'assets/textures/bordures.jpg');
            frameBox.setAttribute('material', 'metalness: 0.1; roughness: 0.8');
            
            artwork.appendChild(mediaElement);
            artwork.appendChild(frameBox);
            scene.appendChild(artwork);
            artwork.addEventListener('click', handleArtworkClick);
            
            console.log(`➕ Œuvre créée: ${artworkId} (mediaType: ${mediaType})`);
        }
        
        // Appliquer les données sauvegardées
        if (artwork) {
            if (data.position) {
                artwork.setAttribute('position', data.position);
            }
            if (data.rotation) {
                artwork.setAttribute('rotation', data.rotation);
            }
            if (data.scale) {
                artwork.setAttribute('scale', data.scale);
            }
            if (data.title) {
                artwork.setAttribute('data-title', data.title);
            }
            if (data.artist) {
                artwork.setAttribute('data-artist', data.artist);
            }
            if (data.description) {
                artwork.setAttribute('data-description', data.description);
            }
            if (data.sourceArtworkNumber) {
                artwork.setAttribute('data-source-artwork-number', data.sourceArtworkNumber);
            }
            // Apply media if configured in saved data
            if (configuredMedia && configuredMedia.src) {
                applyMediaToArtwork(artwork, configuredMedia.src, configuredMedia);
            }
        }
    }

    const count = Object.keys(savedData).length;
    console.log(`📂 Données chargées: ${count} œuvres`);
    if (count > 0) {
        console.log('📂 Œuvres chargées:', Object.keys(savedData));
    }
    
    // Stocker les données en cache global pour un accès rapide (part borderWidth)
    window.artworkDataCache = savedData;
    
    // Compter les œuvres dans le DOM
    const domCount = document.querySelectorAll('.clickable-artwork').length;
    console.log(`🎨 Œuvres dans le DOM: ${domCount}`);
}

function checkTextureLoading() {
    const artworks = document.querySelectorAll('.clickable-artwork');

    artworks.forEach(artwork => {
        const plane = artwork.querySelector('[src]');
        if (plane) {
            const src = plane.getAttribute('src');
            console.log(`🔍 Vérification texture pour ${artwork.id}: ${src}`);

            // Vérifier si l'image se charge
            const img = new Image();
            img.onload = () => {
                console.log(`✅ Texture chargée: ${src}`);
            };
            img.onerror = () => {
                console.error(`❌ Erreur de chargement texture: ${src}`);
            };
            img.src = src;

            // Vérifier le matériel A-Frame
            const material = plane.getAttribute('material');
            console.log(`🎨 Matériel pour ${artwork.id}:`, material);
        }
    });
}

// ==========================================
// RENDU PHYSIQUE ET POST-PROCESSING
// ==========================================
// UTILITAIRES
// ==========================================

/**
 * Affiche un message dans la console avec style
 * 
 * @param {string} message - Le message à afficher
 * @param {string} type - Type: 'info', 'success', 'warning', 'error'
 */
function log(message, type = 'info') {
    const styles = {
        info: 'color: #4ECDC4; font-weight: bold',
        success: 'color: #2ECC71; font-weight: bold',
        warning: 'color: #F39C12; font-weight: bold',
        error: 'color: #E74C3C; font-weight: bold',
    };

    console.log(`%c${message}`, styles[type] || styles.info);
}

/**
 * Utilitaire pour contrôler la portée du raycaster
 * Modifiez ces valeurs pour changer la détection d'interaction
 */
function updateRaycasterRange(near, far) {
    const raycasterElement = camera.querySelector('[raycaster]');
    if (raycasterElement) {
        raycasterElement.setAttribute('raycaster', {
            near: near,
            far: far,
        });
    }
}

// ==========================================
// GESTION DE PERSONNALISATION
// ==========================================

/**
 * Fonction utilitaire pour modifier les dimensions des cadres
 * Utilisez cette fonction dans la console pour tester différentes tailles:
 * 
 * Exemple: updateArtworkSize(4, 3);
 * 
 * @param {number} width - Nouvelle largeur (par défaut: 3m)
 * @param {number} height - Nouvelle hauteur (par défaut: 2.25m)
 */
window.updateArtworkSize = function(width, height) {
    const artworks = document.querySelectorAll('.clickable-artwork');
    artworks.forEach(artwork => {
        const plane = artwork.querySelector('[src]');
        const box = artwork.querySelector('[geometry]') || artwork.querySelector('[width]');

        if (plane) {
            plane.setAttribute('width', width);
            plane.setAttribute('height', height);
        }

        if (box) {
            box.setAttribute('width', width * 1.1);
            box.setAttribute('height', height * 1.1);
        }
    });

    console.log(`✅ Tailles des cadres mises à jour: ${width}m × ${height}m`);
};

/**
 * Fonction pour modifier la couleur d'un mur
 * Exemple: updateWallColor('wallLeft', '#ff0000');
 * 
 * @param {string} wallId - ID du mur ('wallBack', 'wallFront', 'wallLeft', 'wallRight', 'ceiling')
 * @param {string} color - Couleur en hexadécimal
 */
window.updateWallColor = function(wallId, color) {
    const wall = document.querySelector(`#${wallId}`);
    if (wall) {
        wall.setAttribute('color', color);
        console.log(`✅ Mur ${wallId} changé en couleur ${color}`);
    } else {
        console.error(`❌ Mur ${wallId} non trouvé`);
    }
};

/**
 * Fonction pour modifier les informations d'une œuvre
 * Exemple: updateArtworkInfo('artwork-1', 'Nouveau Titre', 'Nouvel Artiste', 'Nouvelle Description');
 * 
 * @param {string} artworkId - ID de l'œuvre
 * @param {string} title - Nouveau titre
 * @param {string} artist - Nouvel artiste
 * @param {string} description - Nouvelle description
 */
window.updateArtworkInfo = function(artworkId, title, artist, description) {
    const artwork = document.querySelector(`#${artworkId}`);
    if (artwork) {
        artwork.setAttribute('data-title', title);
        artwork.setAttribute('data-artist', artist);
        artwork.setAttribute('data-description', description);
        console.log(`✅ Informations de ${artworkId} mises à jour`);
    } else {
        console.error(`❌ Œuvre ${artworkId} non trouvée`);
    }
};

/**
 * Fonction pour changer l'image d'une œuvre
 * Exemple: updateArtworkImage('artwork-1', 'assets/images/my-image.jpg');
 * 
 * @param {string} artworkId - ID de l'œuvre
 * @param {string} imagePath - Chemin vers la nouvelle image
 */
window.updateArtworkImage = function(artworkId, imagePath) {
    const artwork = document.querySelector(`#${artworkId}`);
    const plane = artwork.querySelector('[src]');
    if (plane) {
        plane.setAttribute('src', imagePath);
        console.log(`✅ Image de ${artworkId} changée en ${imagePath}`);
    } else {
        console.error(`❌ Plane d'image pour ${artworkId} non trouvé`);
    }
};

// ==========================================
// LANCEMENT DE L'APPLICATION
// ==========================================

/**
 * Démarrage après chargement du DOM
 */
document.addEventListener('DOMContentLoaded', () => {
    const scene = document.querySelector('a-scene');
    if (!scene) {
        console.error('❌ Scène A-Frame non trouvée');
        return;
    }
    
    if (scene.hasLoaded) {
        initializeGallery().catch(e => console.error('Erreur initialisation:', e));
    } else {
        scene.addEventListener('loaded', () => {
            initializeGallery().catch(e => console.error('Erreur initialisation:', e));
        });
    }
});

console.log('%c🎨 Galerie d\'Urval', 'font-size: 20px; color: #FF6B6B; font-weight: bold');
console.log('%cChargement en cours...', 'color: #4ECDC4; font-size: 14px');
