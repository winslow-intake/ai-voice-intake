const { createClient, LiveTranscriptionEvents } = require('@deepgram/sdk');
require('dotenv').config();

// Debug: Check if API key is loaded
console.log('Deepgram API Key loaded:', process.env.DEEPGRAM_API_KEY ? 'Yes' : 'No');

let deepgram;
let deepgramConnection;
let isConnected = false;

function initializeDeepgram() {
  if (!deepgram) {
    if (!process.env.DEEPGRAM_API_KEY) {
      throw new Error('DEEPGRAM_API_KEY not found in environment variables');
    }
    deepgram = createClient(process.env.DEEPGRAM_API_KEY);
  }

  if (!deepgramConnection || !isConnected) {
    console.log('🎯 Creating new Deepgram connection...');
    
    deepgramConnection = deepgram.listen.live({
      model: 'nova-2',
      language: 'en-US',
      smart_format: true,
      interim_results: false,
      encoding: 'linear16',
      sample_rate: 16000,
      channels: 1
    });

    deepgramConnection.on(LiveTranscriptionEvents.Open, () => {
      console.log('✅ Deepgram connection opened');
      isConnected = true;
    });

    deepgramConnection.on(LiveTranscriptionEvents.Transcript, (data) => {
      const transcript = data.channel.alternatives[0]?.transcript;
      if (transcript && transcript.trim()) {
        console.log('📝 TRANSCRIPT:', transcript);
      }
    });

    deepgramConnection.on(LiveTranscriptionEvents.Close, () => {
      console.log('❌ Deepgram connection closed');
      isConnected = false;
      deepgramConnection = null;
    });

    deepgramConnection.on(LiveTranscriptionEvents.Error, (err) => {
      console.error('❗ Deepgram error:', err);
      isConnected = false;
    });
  }
}

function sendAudioToDeepgram(audioBuffer) {
  try {
    // Initialize connection if needed
    initializeDeepgram();

    // Only send if connected
    if (isConnected && deepgramConnection) {
      deepgramConnection.send(audioBuffer);
      console.log('📡 Sent audio chunk, size:', audioBuffer.length);
    } else {
      console.log('⏳ Waiting for Deepgram connection...');
      // Retry after a short delay
      setTimeout(() => {
        if (isConnected && deepgramConnection) {
          deepgramConnection.send(audioBuffer);
          console.log('📡 Sent delayed audio chunk, size:', audioBuffer.length);
        }
      }, 100);
    }
  } catch (error) {
    console.error('Error sending audio to Deepgram:', error);
  }
}

function closeDeepgramConnection() {
  if (deepgramConnection && isConnected) {
    console.log('🔚 Closing Deepgram connection...');
    deepgramConnection.finish();
    isConnected = false;
    deepgramConnection = null;
  }
}

// Legacy function for compatibility with your existing code
module.exports.transcribeStream = (audioBuffer) => {
  return new Promise((resolve, reject) => {
    sendAudioToDeepgram(audioBuffer);
    // For now, just resolve immediately
    // In a real implementation, you'd collect transcripts over time
    resolve('Audio sent to Deepgram');
  });
};

// Better functions for streaming audio
module.exports.initializeDeepgram = initializeDeepgram;
module.exports.sendAudioToDeepgram = sendAudioToDeepgram;
module.exports.closeDeepgramConnection = closeDeepgramConnection;