// Endpoint pour annuler une prédiction Replicate
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
  const { predictionId } = req.body;

  if (!predictionId) {
    return res.status(400).json({ error: 'predictionId is required' });
  }

  try {
    const response = await fetch(
      `https://api.replicate.com/v1/predictions/${predictionId}/cancel`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${REPLICATE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.ok) {
      const data = await response.json();
      return res.status(200).json({ success: true, data });
    } else {
      const error = await response.json().catch(() => ({}));
      return res.status(response.status).json({ 
        success: false, 
        error: error.detail || 'Failed to cancel prediction' 
      });
    }
  } catch (error) {
    console.error('Error canceling prediction:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}
