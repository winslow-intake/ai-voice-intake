const axios = require('axios');
require('dotenv').config();

async function textToSpeech(text) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;

  try {
    const response = await axios({
      method: 'post',
      url: `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      responseType: 'arraybuffer',
      data: {
        text,
        model_id: 'eleven_monolingual_v1', // Highest quality model
        voice_settings: {
          stability: 0.85,        // Higher = more consistent, professional
          similarity_boost: 0.90, // Higher = stronger voice character
          style: 0.25,           // Lower = more serious, but not robotic
          use_speaker_boost: true // Clearer for phone calls
        }
      }
    });

    return response.data;
  } catch (error) {
    console.error('ElevenLabs TTS error:', error.response?.data || error.message);
    throw error;
  }
}

module.exports = { textToSpeech };