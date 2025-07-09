const http = require('http');
const WebSocket = require('ws');
const { createClient, LiveTranscriptionEvents } = require('@deepgram/sdk');
const axios = require('axios');

const PORT = process.env.PORT || 8080;

const server = http.createServer();
const wss = new WebSocket.Server({ server, path: '/media' });

let deepgram;
let deepgramConnection;
let isConnected = false;

function initializeDeepgram() {
  if (!deepgram) {
    deepgram = createClient(process.env.DEEPGRAM_API_KEY);
  }

  if (!deepgramConnection || !isConnected) {
    console.log('🎯 Creating new Deepgram connection...');
    
    deepgramConnection = deepgram.listen.live({
      model: 'nova-2',
      language: 'en-US',
      smart_format: true,
      interim_results: false,
      encoding: 'mulaw',
      sample_rate: 8000,
      channels: 1
    });

    deepgramConnection.on(LiveTranscriptionEvents.Open, () => {
      console.log('✅ Deepgram connection opened');
      isConnected = true;
    });

    deepgramConnection.on(LiveTranscriptionEvents.Transcript, async (data) => {
      const transcript = data.channel.alternatives[0]?.transcript;
      if (transcript && transcript.trim()) {
        console.log('📝 TRANSCRIPT:', transcript);
        
        // Send transcript to main app for processing
        try {
          const response = await axios.post('https://ai-conversation-engine.onrender.com/process-transcript', {
            transcript: transcript,
            callSid: currentCallSid
          });
          console.log('✅ Transcript processed successfully');
        } catch (error) {
          console.error('❌ Error sending transcript to main app:', error);
        }
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

let currentCallSid = '';

wss.on('connection', (ws) => {
  console.log('Twilio stream connected');
  
  // Initialize Deepgram connection for this call
  initializeDeepgram();
  
  ws.on('message', async (data) => {
    const msg = JSON.parse(data);

    if (msg.event === 'start') {
      console.log('Stream started');
      currentCallSid = msg.start.callSid;
    }

    if (msg.event === 'media' && msg.media && msg.media.payload) {
      const audio = Buffer.from(msg.media.payload, 'base64');
      
      // Send audio to Deepgram if connected
      if (isConnected && deepgramConnection) {
        deepgramConnection.send(audio);
      }
    }

    if (msg.event === 'stop') {
      console.log('Stream stopped');
      if (deepgramConnection && isConnected) {
        deepgramConnection.finish();
      }
    }
  });

  ws.on('close', () => {
    console.log('Stream closed');
    if (deepgramConnection && isConnected) {
      deepgramConnection.finish();
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Listening on ws://0.0.0.0:${PORT}`);
});