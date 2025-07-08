const { createClient } = require('@deepgram/sdk');
const axios = require('axios');
const { Readable } = require('stream');
require('dotenv').config();

const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

async function transcribeAudio(recordingUrl) {
  try {
    // Fetch the audio file
    const response = await axios.get(recordingUrl, {
      responseType: 'arraybuffer',
      auth: {
        username: process.env.TWILIO_ACCOUNT_SID,
        password: process.env.TWILIO_AUTH_TOKEN
      }
    });

    const audioBuffer = response.data;

    // Use the new API for transcription
    const { result } = await deepgram.listen.prerecorded.transcribeFile(
      audioBuffer,
      {
        model: 'nova',
        language: 'en-US',
        smart_format: true,
        punctuate: true
      }
    );

    // Extract the transcript
    const transcript = result.results?.channels?.[0]?.alternatives?.[0]?.transcript;
    return transcript || 'Sorry, we couldn\'t understand that.';

  } catch (err) {
    console.error('Error with Deepgram transcription:', err.response?.data || err.message);
    return 'Sorry, something went wrong transcribing that.';
  }
}

module.exports = { transcribeAudio };