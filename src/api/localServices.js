// Services locaux pour remplacer Base44
// Cloudinary pour l'upload, API serverless pour Replicate

const CLOUDINARY_CLOUD_NAME = 'dq6fmczeb';
const CLOUDINARY_UPLOAD_PRESET = 'ml_defaulte';

// Compresser une image avant envoi à Replicate
export async function compressImage(file, maxWidth = 1280, maxHeight = 1280, quality = 0.85) {
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

// Supprimer une image de Cloudinary par public_id
export async function deleteCloudinaryImage(publicId) {
  try {
    console.log('🗑️ Suppression de l\'image temporaire:', publicId);
    
    const response = await fetch('/api/cloudinary-delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ public_id: publicId }),
    });

    const result = await response.json();

    if (result.success) {
      console.log('✅ Image supprimée avec succès:', publicId);
      return true;
    } else {
      console.error('❌ Échec de la suppression:', result.error);
      return false;
    }
  } catch (error) {
    console.error('❌ Erreur lors de la suppression:', error);
    return false;
  }
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
export async function generateSofaWithFabric({ sofaImageUrl, fabricImageUrl, userDetails, onProgress, modelVersion = null }) {
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
  
  // Modèle à utiliser (par défaut: nano-banana-pro, fallback: flux-schnell)
  const currentModel = modelVersion || 'google/nano-banana-pro';
  
  // Configurations de compression progressive (taille max, qualité)
  const compressionLevels = [
    { maxWidth: 1280, quality: 0.80 }, // Déjà appliqué
    { maxWidth: 1024, quality: 0.70 }, // Compression moyenne
    { maxWidth: 800, quality: 0.60 }, // Compression agressive
  ];

  while (attempt <= maxRetries) {
    try {
      // 1. Lancer la génération avec le modèle spécifié
      const startResponse = await fetch('/api/replicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sofaImageUrl: currentSofaUrl, 
          fabricImageUrl: currentFabricUrl, 
          prompt,
          modelVersion: currentModel 
        }),
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

      // 2. Polling adaptatif : rapide au début, puis ralentit
      const maxAttempts = 90; // 90 tentatives max (~120 secondes)
      let consecutiveStarting = 0;
      
      for (let i = 0; i < maxAttempts; i++) {
        // Polling adaptatif : 1s les 10 premières tentatives, puis 2s
        const pollInterval = i < 10 ? 1000 : 2000;
        await sleep(pollInterval);

        const elapsedSeconds = i < 10 ? i + 1 : 10 + (i - 9) * 2;
        if (onProgress) {
          onProgress(`🎨 Génération en cours... (${elapsedSeconds}s)`);
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

        // Détecter les longues files d'attente (plus de 2 minutes)
        if (pollData.queueTime && pollData.queueTime > 120) {
          if (onProgress) {
            onProgress(`⚠️ File d'attente trop longue (${Math.floor(pollData.queueTime)}s). Annulation...`);
          }
          
          // Annuler la prédiction via l'endpoint backend
          try {
            await fetch('/api/replicate-cancel', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ predictionId }),
            });
          } catch (err) {
            console.error('Erreur annulation:', err);
          }
          
          throw new Error(`Le serveur IA est surchargé (attente: ${Math.floor(pollData.queueTime / 60)} min). Veuillez réessayer dans quelques minutes ou à une heure moins chargée.`);
        }

        if (pollData.status === 'succeeded') {
          return { status: 'success', imageUrl: pollData.imageUrl };
        } else if (pollData.status === 'failed') {
          throw new Error(pollData.message || 'La génération a échoué');
        } else if (pollData.status === 'canceled') {
          throw new Error('La génération a été annulée');
        } else if (pollData.status === 'starting') {
          consecutiveStarting++;
          // Si bloqué en "starting" plus de 50 secondes, essayer le fallback
          if (consecutiveStarting > 40) {
            // Annuler la prédiction bloquée
            try {
              await fetch('/api/replicate-cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ predictionId }),
              });
            } catch (err) {
              console.error('Erreur annulation:', err);
            }
            
            throw new Error('Le serveur IA est surchargé et ne répond pas. Veuillez réessayer dans quelques minutes ou à une heure de moindre affluence.');
          }
          // Afficher le temps d'attente si disponible
          if (pollData.queueTime && onProgress) {
            onProgress(`⏳ En attente (${Math.floor(pollData.queueTime)}s)...`);
          }
        } else {
          // processing ou autre état
          consecutiveStarting = 0;
        }
        // Continue le polling
      }

      // Si on arrive ici, c'est un timeout
      throw new Error('Timeout: la génération a pris trop de temps (max 120s)');
      
    } catch (error) {
      // Si erreur 413, on continue la boucle pour réessayer avec compression
      if (error.message && error.message.includes('413')) {
        attempt++;
        if (attempt > maxRetries) {
          throw new Error('Les images sont trop volumineuses même après compression maximale');
        }
        continue;
      }
      
      // Toute autre erreur est fatale
      throw error;
    }
  }
  
  // Si on sort de la boucle sans succès
  throw new Error('Échec de la génération après plusieurs tentatives');
}