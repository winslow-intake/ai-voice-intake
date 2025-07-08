const express = require('express');
const twilio = require('twilio');
const PORT = process.env.PORT || 3000;
const { transcribeAudio } = require('./deepgram');
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

  // Initial greeting using Twilio TTS
  twiml.say('Hi, this is Marcus from Langston and Wells. I understand you\'ve been in an accident. Please tell me what happened.', {
    voice: 'alice',
    language: 'en-US'
  });

  // Leave stream running indefinitely — no record block here
  res.type('text/xml');
  res.send(twiml.toString());
});

app.post('/handle-recording', async (req, res) => {
  console.log('Received recording:', req.body.RecordingUrl);
  
  try {
    // 1. Transcribe what they said
    const transcript = await transcribeAudio(req.body.RecordingUrl);
    console.log('Transcript:', transcript);
    
    // 2. Generate AI response
    const aiResponse = await generateResponse(transcript);
    console.log('AI Response:', aiResponse);
    
    // 3. Convert to speech with ElevenLabs
    const audioBuffer = await textToSpeech(aiResponse);
    console.log('Generated audio buffer, size:', audioBuffer.length);
    
    // 4. Create response that plays the audio
    const twiml = new twilio.twiml.VoiceResponse();
    
    // Convert buffer to base64 for Twilio
    const base64Audio = audioBuffer.toString('base64');
    
    // Play the ElevenLabs audio
    twiml.play({
      loop: 1
    }, `data:audio/mpeg;base64,${base64Audio}`);
    
    // After playing, ask if they need anything else
    twiml.say('Is there anything else you\'d like to tell me about the accident?', {
      voice: 'alice'
    });
    
    // Record again for continued conversation
    twiml.record({
      maxLength: 10,
      timeout: 3,
      action: '/handle-recording',
      transcribe: false
    });
    
    res.type('text/xml');
    res.send(twiml.toString());
    
  } catch (error) {
    console.error('Error processing recording:', error);
    
    // Fallback response
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say('I apologize, but I had trouble understanding that. Could you please repeat what happened?');
    twiml.record({
      maxLength: 10,
      timeout: 3,
      action: '/handle-recording',
      transcribe: false
    });
    
    res.type('text/xml');
    res.send(twiml.toString());
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});