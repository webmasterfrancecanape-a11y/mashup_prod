// Services locaux pour remplacer Base44
// Cloudinary pour l'upload, API serverless pour Replicate

const CLOUDINARY_CLOUD_NAME = 'dq6fmczeb';
const CLOUDINARY_UPLOAD_PRESET = 'ml_defaulte';

// Compresser une image avant envoi à Replicate
export async function compressImage(file, maxWidth = 1920, maxHeight = 1920, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        // Calculer les nouvelles dimensions en gardant le ratio
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.floor(width * ratio);
          height = Math.floor(height * ratio);
        }
        
        // Créer un canvas pour redimensionner
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convertir en Data URL compressé (JPEG pour réduire la taille)
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      };
      
      img.onerror = () => reject(new Error('Erreur chargement image'));
      img.src = e.target.result;
    };
    
    reader.onerror = () => reject(new Error('Erreur lecture fichier'));
    reader.readAsDataURL(file);
  });
}

// Convertir un fichier en Data URL (base64) avec compression automatique
export async function fileToDataUrl(file) {
  // Compresser l'image à 1920px max pour éviter les images trop lourdes
  return compressImage(file, 1920, 1920, 0.85);
}

// Convertir une Data URL en base64 avec recompression plus agressive
async function recompressDataUrl(dataUrl, maxWidth, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      
      if (width > maxWidth || height > maxWidth) {
        const ratio = maxWidth / Math.max(width, height);
        width = Math.floor(width * ratio);
        height = Math.floor(height * ratio);
      }
      
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      
      const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve(compressedDataUrl);
    };
    
    img.onerror = () => reject(new Error('Erreur recompression'));
    img.src = dataUrl;
  });
}

// Upload d'image vers Cloudinary (unsigned upload)
export async function uploadFile(file) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    {
      method: 'POST',
      body: formData,
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Erreur upload Cloudinary');
  }

  const data = await response.json();
  return { file_url: data.secure_url, public_id: data.public_id };
}

// Upload d'une image depuis URL vers Cloudinary (pour sauvegarder les résultats)
export async function uploadFromUrl(imageUrl) {
  const formData = new FormData();
  formData.append('file', imageUrl);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  formData.append('folder', 'france-canape-results');

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    {
      method: 'POST',
      body: formData,
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Erreur upload Cloudinary');
  }

  const data = await response.json();

  // Retourner l'URL en WebP (Cloudinary convertit automatiquement)
  const webpUrl = data.secure_url.replace(/\.[^.]+$/, '.webp');
  const thumbnailUrl = data.secure_url.replace('/upload/', '/upload/w_200,h_200,c_fill,f_webp/');

  return {
    imageUrl: webpUrl,
    thumbnailUrl,
    public_id: data.public_id
  };
}

// Gestion de l'historique dans LocalStorage
const HISTORY_KEY = 'france-canape-history';
const MAX_HISTORY = 20;

export function getHistory() {
  try {
    const history = localStorage.getItem(HISTORY_KEY);
    return history ? JSON.parse(history) : [];
  } catch {
    return [];
  }
}

export function addToHistory(item) {
  try {
    const history = getHistory();
    const newItem = {
      ...item,
      id: Date.now(),
      createdAt: new Date().toISOString(),
    };
    const newHistory = [newItem, ...history].slice(0, MAX_HISTORY);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
    return newHistory;
  } catch {
    return [];
  }
}

export function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
}

// Helper pour attendre
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Génération d'image avec Replicate via API serverless (avec polling)
export async function generateSofaWithFabric({ sofaImageUrl, fabricImageUrl, userDetails, onProgress }) {
  let prompt = `A photorealistic sofa with the exact fabric pattern and texture from the reference image applied seamlessly to its upholstery. The sofa should maintain its original shape and lighting while the fabric covers all cushions and surfaces naturally. High quality, professional furniture photography.`;

  // Ajouter les détails utilisateur au prompt si fournis
  if (userDetails && userDetails.trim()) {
    prompt += ` Additional details: ${userDetails.trim()}.`;
  }

  // Variables pour la recompression progressive
  let currentSofaUrl = sofaImageUrl;
  let currentFabricUrl = fabricImageUrl;
  let attempt = 0;
  const maxRetries = 2;
  
  // Configurations de compression progressive (taille max, qualité)
  const compressionLevels = [
    { maxWidth: 1920, quality: 0.85 }, // Déjà appliqué
    { maxWidth: 1280, quality: 0.70 }, // Compression moyenne
    { maxWidth: 1024, quality: 0.60 }, // Compression agressive
  ];

  while (attempt <= maxRetries) {
    try {
      // 1. Lancer la génération
      const startResponse = await fetch('/api/replicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sofaImageUrl: currentSofaUrl, fabricImageUrl: currentFabricUrl, prompt }),
      });

      // Gestion de l'erreur 413 (Request Entity Too Large)
      if (startResponse.status === 413) {
        attempt++;
        
        if (attempt > maxRetries) {
          throw new Error('Les images sont trop volumineuses même après compression maximale. Veuillez utiliser des images plus petites.');
        }

        const level = compressionLevels[attempt];
        
        if (onProgress) {
          onProgress(`⚠️ Images trop volumineuses, compression niveau ${attempt}/${maxRetries}...`);
        }

        // Recompresser les deux images avec des paramètres plus agressifs
        currentSofaUrl = await recompressDataUrl(sofaImageUrl, level.maxWidth, level.quality);
        currentFabricUrl = await recompressDataUrl(fabricImageUrl, level.maxWidth, level.quality);
        
        // Attendre un peu avant de réessayer
        await sleep(1000);
        continue; // Réessayer avec les images recompressées
      }

      if (!startResponse.ok) {
        const error = await startResponse.json().catch(() => ({}));
        throw new Error(error.message || 'Erreur lancement génération');
      }

      const startData = await startResponse.json();
      const predictionId = startData.predictionId;

      if (!predictionId) {
        throw new Error('Pas de predictionId reçu');
      }

      // 2. Polling jusqu'à ce que ce soit fini (max 3 minutes)
      const maxAttempts = 36; // 36 x 5 secondes = 3 minutes
      for (let i = 0; i < maxAttempts; i++) {
        await sleep(5000); // Attendre 5 secondes entre chaque check

        if (onProgress) {
          onProgress(`🎨 Génération en cours... (${(i + 1) * 5}s)`);
        }

        const pollResponse = await fetch('/api/replicate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ predictionId }),
        });

        if (!pollResponse.ok) {
          const error = await pollResponse.json().catch(() => ({}));
          throw new Error(error.message || 'Erreur polling');
        }

        const pollData = await pollResponse.json();

        if (pollData.status === 'succeeded') {
          return { status: 'success', imageUrl: pollData.imageUrl };
        } else if (pollData.status === 'failed') {
          throw new Error(pollData.message || 'La génération a échoué');
        }
        // Sinon continue le polling (starting, processing)
      }

      throw new Error('Timeout: la génération a pris trop de temps');
      
    } catch (error) {
      // Si ce n'est pas une erreur 413, on la propage directement
      if (error.message && !error.message.includes('volumineuses')) {
        throw error;
      }
      // Sinon on continue la boucle pour réessayer
    }
  }
}