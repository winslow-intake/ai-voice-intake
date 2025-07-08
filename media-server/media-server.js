const http = require('http');
const WebSocket = require('ws');
const { transcribeStream } = require('../app/deepgram-stream'); // You'll implement this next

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
      const audio = Buffer.from(msg.media.payload, 'base64');
      transcribeStream(audio); // Real-time transcription (you’ll build this next)
    }

    if (msg.event === 'stop') {
      console.log('Stream stopped');
    }
  });

  ws.on('close', () => {
    console.log('Stream closed');
  });
});

server.listen(8080, () => {
  console.log('Media stream server listening on ws://localhost:8080');
});
