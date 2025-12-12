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
    const { sofaImageUrl, fabricImageUrl, prompt, predictionId } = req.body;

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

      if (statusData.status === 'succeeded') {
        const imageUrl = Array.isArray(statusData.output) ? statusData.output[0] : statusData.output;
        return res.status(200).json({ status: 'succeeded', imageUrl });
      } else if (statusData.status === 'failed') {
        return res.status(500).json({ status: 'failed', message: statusData.error || 'Generation failed' });
      } else {
        // Encore en cours (starting, processing)
        return res.status(200).json({ status: statusData.status, predictionId });
      }
    }

    // Sinon, on lance une nouvelle génération
    const response = await fetch(
      'https://api.replicate.com/v1/models/google/nano-banana-pro/predictions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${REPLICATE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: {
            prompt: prompt,
            resolution: '1K',
            image_input: [sofaImageUrl, fabricImageUrl],
            aspect_ratio: '4:3',
            output_format: 'jpg',
            safety_filter_level: 'block_only_high',
          },
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
