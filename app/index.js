const express = require('express');
const twilio = require('twilio');
const PORT = process.env.PORT || 3000;
const { generateResponse } = require('./llm');
const { textToSpeech } = require('./elevenlabs');

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.get('/', (req, res) => {
  res.send('AI Receptionist is running');
});

app.post('/voice', (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();

  // Start streaming audio to your WebSocket endpoint
  const start = twiml.start();
  start.stream({
    url: 'wss://ai-media-server.onrender.com', // replace with your actual wss endpoint
    track: 'inbound_track'
  });

  // Initial greeting using Twilio TTS (we'll upgrade this to ElevenLabs later)
  twiml.say({
    voice: 'alice',
    language: 'en-US'
  }, 'Hi, this is Marcus from Langston and Wells. I understand you\'ve been in an accident. Please tell me what happened.');

  // Leave stream running indefinitely — no record block here
  res.type('text/xml');
  res.send(twiml.toString());
});

// This endpoint will be called by your media-server when it has a complete transcript
app.post('/process-transcript', async (req, res) => {
  try {
    const { transcript, callSid } = req.body;
    
    if (!transcript || !callSid) {
      return res.status(400).json({ error: 'Missing transcript or callSid' });
    }

    console.log('Processing transcript:', transcript);

    // 1. Generate AI response
    const aiResponse = await generateResponse(transcript);
    console.log('AI Response:', aiResponse);

    // 2. Convert to speech with ElevenLabs
    const audioBuffer = await textToSpeech(aiResponse);
    console.log('Generated audio buffer, size:', audioBuffer.length);

    // 3. Send response back to media-server to play to caller
    res.json({ 
      success: true, 
      response: aiResponse,
      audioLength: audioBuffer.length 
    });

  } catch (error) {
    console.error('Error processing transcript:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});