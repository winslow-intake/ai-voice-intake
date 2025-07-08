require('dotenv').config();
const mic = require('mic');
const { initializeDeepgram, sendAudioToDeepgram, closeDeepgramConnection } = require('./deepgram-stream');

const micInstance = mic({
  rate: '16000',
  channels: '1',
  debug: false,
  exitOnSilence: 6,
});

const micInputStream = micInstance.getAudioStream();

// Initialize Deepgram connection once
initializeDeepgram();

micInputStream.on('data', (data) => {
  // Send each audio chunk to the same Deepgram connection
  sendAudioToDeepgram(data);
});

micInputStream.on('error', (err) => {
  console.error('Mic error:', err);
});

micInputStream.on('startComplete', () => {
  console.log('🎙️ Mic recording started');
});

micInputStream.on('stopComplete', () => {
  console.log('🛑 Mic recording stopped');
  closeDeepgramConnection();
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🔚 Shutting down...');
  micInstance.stop();
  closeDeepgramConnection();
  process.exit(0);
});

micInstance.start();