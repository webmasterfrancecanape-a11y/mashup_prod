import crypto from 'crypto';

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { public_id } = req.body;

  if (!public_id) {
    return res.status(400).json({ error: 'public_id is required' });
  }

  const cloudName = process.env.VITE_CLOUDINARY_CLOUD_NAME || 'dq6fmczeb';
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!apiKey || !apiSecret) {
    console.error('Missing Cloudinary API credentials');
    return res.status(500).json({ 
      error: 'Server configuration error: Missing API credentials' 
    });
  }

  try {
    // Generate timestamp
    const timestamp = Math.round(Date.now() / 1000);

    // Create signature for authentication
    // Format: public_id=value&timestamp=value
    const stringToSign = `public_id=${public_id}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto
      .createHash('sha1')
      .update(stringToSign)
      .digest('hex');

    // Make DELETE request to Cloudinary
    const formData = new URLSearchParams();
    formData.append('public_id', public_id);
    formData.append('timestamp', timestamp.toString());
    formData.append('api_key', apiKey);
    formData.append('signature', signature);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      }
    );

    const result = await response.json();

    if (result.result === 'ok') {
      return res.status(200).json({ 
        success: true, 
        message: 'Image deleted successfully',
        public_id 
      });
    } else {
      console.error('Cloudinary deletion failed:', result);
      return res.status(400).json({ 
        success: false, 
        error: 'Deletion failed', 
        details: result 
      });
    }
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error', 
      message: error.message 
    });
  }
}
