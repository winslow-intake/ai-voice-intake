const http = require('http');
const WebSocket = require('ws');
const { transcribeStream } = require('../app/deepgram-stream'); // Adjust if needed

const PORT = process.env.PORT || 8080;

const server = http.createServer();
const wss = new WebSocket.Server({ server, path: '/media' });

wss.on('connection', (ws) => {
  console.log('Twilio stream connected');

  ws.on('message', async (data) => {
    const msg = JSON.parse(data);

    if (msg.event === 'start') {
      console.log('Stream started');
    }
    
    if (msg.event === 'media' && msg.media && msg.media.payload) {
      const audioBuffer = Buffer.from(msg.media.payload, 'base64');
      transcribeStream(audioBuffer); // ✅ Send to Deepgram
    }

    if (msg.event === 'stop') {
      console.log('Stream stopped');
    }
  });

  ws.on('close', () => {
    console.log('Stream closed');
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Listening on ws://0.0.0.0:${PORT}`);
});
