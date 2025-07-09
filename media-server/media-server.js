const http = require('http');
const WebSocket = require('ws');
const { createClient, LiveTranscriptionEvents } = require('@deepgram/sdk');
const axios = require('axios');
require('dotenv').config();

console.log('🚀 Starting media server...');
console.log('Deepgram API Key:', process.env.DEEPGRAM_API_KEY ? 'Found' : 'Missing');

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
        console.log('📝 RAW TRANSCRIPT:', transcript);
        
        // Add to transcript buffer
        transcriptBuffer += ' ' + transcript.trim();
        lastTranscriptTime = Date.now();
        
        console.log('🔄 BUFFER:', transcriptBuffer);
        
        // Clear any existing timeout
        clearTimeout(sendTranscriptTimeout);
        
        // Check if this looks like a complete sentence or thought
        const isCompleteSentence = 
          transcript.trim().endsWith('.') || 
          transcript.trim().endsWith('?') || 
          transcript.trim().endsWith('!') ||
          transcriptBuffer.trim().length > 50; // Or if buffer is getting long
        
        if (isCompleteSentence) {
          console.log('✅ COMPLETE SENTENCE DETECTED');
          await sendBufferedTranscript();
        } else {
          // Wait 2 seconds after last transcript chunk, then send what we have
          sendTranscriptTimeout = setTimeout(async () => {
            console.log('⏰ TIMEOUT - Sending buffered transcript');
            await sendBufferedTranscript();
          }, 2000);
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
let transcriptBuffer = ''; // Buffer to accumulate partial transcripts
let lastTranscriptTime = 0;
let sendTranscriptTimeout;

wss.on('connection', (ws) => {
  console.log('Twilio stream connected');
  
  // Reset transcript buffer for new call
  transcriptBuffer = '';
  lastTranscriptTime = 0;
  
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

// Function to send buffered transcript
async function sendBufferedTranscript() {
  if (transcriptBuffer.trim().length > 0) {
    const finalTranscript = transcriptBuffer.trim();
    console.log('📤 SENDING FINAL TRANSCRIPT:', finalTranscript);
    
    // Reset buffer
    transcriptBuffer = '';
    
    // Send to main app for processing
    try {
      const response = await axios.post('https://ai-conversation-engine.onrender.com/process-transcript', {
        transcript: finalTranscript,
        callSid: currentCallSid
      });
      console.log('✅ Transcript processed successfully');
    } catch (error) {
      console.error('❌ Error sending transcript to main app:', error);
    }
  }
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Listening on ws://0.0.0.0:${PORT}`);
});