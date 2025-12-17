// Serverless function pour Replicate avec polling
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

  try {
    const { sofaImageUrl, fabricImageUrl, prompt, predictionId, modelVersion } = req.body;
    
    // Modèle par défaut ou alternatif
    const model = modelVersion || 'google/nano-banana-pro';

    // Si on a un predictionId, on vérifie le statut (polling)git
    if (predictionId) {
      const statusResponse = await fetch(
        `https://api.replicate.com/v1/predictions/${predictionId}`,
        {
          headers: {
            'Authorization': `Bearer ${REPLICATE_API_TOKEN}`,
          },
        }
      );

      const statusData = await statusResponse.json();

      // Calculer le temps en queue si disponible
      const metrics = statusData.metrics || {};
      const queueTime = metrics.predict_time ? 0 : (Date.now() - new Date(statusData.created_at).getTime()) / 1000;
      
      if (statusData.status === 'succeeded') {
        const imageUrl = Array.isArray(statusData.output) ? statusData.output[0] : statusData.output;
        return res.status(200).json({ status: 'succeeded', imageUrl });
      } else if (statusData.status === 'failed') {
        return res.status(500).json({ status: 'failed', message: statusData.error || 'Generation failed' });
      } else if (statusData.status === 'canceled') {
        return res.status(200).json({ status: 'canceled', message: 'Prediction was canceled' });
      } else {
        // Encore en cours (starting, processing)
        // Retourner les métriques pour que le client puisse détecter les longues queues
        return res.status(200).json({ 
          status: statusData.status, 
          predictionId,
          queueTime: Math.floor(queueTime),
          metrics: metrics
        });
      }
    }

    // Sinon, on lance une nouvelle génération
    // Configuration selon le modèle
    let inputConfig;
    
    if (model === 'google/nano-banana-pro') {
      inputConfig = {
        prompt: prompt,
        resolution: '1K',
        image_input: [sofaImageUrl, fabricImageUrl],
        aspect_ratio: '4:3',
        output_format: 'jpg',
        output_quality: 80,
        safety_filter_level: 'block_only_high',
      };
    } else if (model === 'black-forest-labs/flux-schnell') {
      // Flux Schnell : ultra rapide mais pas de multi-images natives
      inputConfig = {
        prompt: `${prompt}. Sofa with fabric pattern.`,
        image: sofaImageUrl,
        num_inference_steps: 4,
        output_format: 'jpg',
        output_quality: 80,
      };
    } else {
      // Config générique pour autres modèles
      inputConfig = {
        prompt: prompt,
        image: sofaImageUrl,
        output_format: 'jpg',
      };
    }
    
    const response = await fetch(
      `https://api.replicate.com/v1/models/${model}/predictions`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${REPLICATE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: inputConfig,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ 
        message: data.detail || data.error || 'Erreur Replicate' 
      });
    }

    // Retourne l'ID pour le polling
    return res.status(200).json({ 
      status: data.status, 
      predictionId: data.id 
    });

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ message: error.message });
  }
}
