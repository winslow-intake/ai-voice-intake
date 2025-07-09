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
    url: 'wss://ai-media-server.onrender.com/media', // Make sure to include /media path
    track: 'inbound_track'
  });

  // Initial greeting using Twilio TTS (we'll upgrade this to ElevenLabs later)
  twiml.say({
    voice: 'alice',
    language: 'en-US'
  }, 'Hi, this is Marcus from Langston and Wells. I understand you\'ve been in an accident. Please tell me what happened.');

  // Keep the call alive and listening
  twiml.pause({ length: 30 }); // Wait 30 seconds for user to respond
  
  // If they don't respond, prompt again
  twiml.say({
    voice: 'alice',
    language: 'en-US'
  }, 'Are you still there? Please tell me what happened in your accident.');
  
  // Keep the call open indefinitely
  twiml.pause({ length: 3600 }); // Wait 1 hour (effectively keeps call alive)

  res.type('text/xml');
  res.send(twiml.toString());
});

// This endpoint will be called by your media-server when it has a complete transcript
app.post('/process-transcript', async (req, res) => {
  console.log('🔥 /process-transcript called with body:', req.body);
  
  try {
    const { transcript, callSid } = req.body;
    
    if (!transcript || !callSid) {
      console.error('❌ Missing transcript or callSid:', { transcript, callSid });
      return res.status(400).json({ error: 'Missing transcript or callSid' });
    }

    console.log('✅ Processing transcript:', transcript);
    console.log('✅ Call SID:', callSid);

    // Check if required functions exist
    if (!generateResponse) {
      console.error('❌ generateResponse function not found');
      return res.status(500).json({ error: 'generateResponse function not available' });
    }

    if (!textToSpeech) {
      console.error('❌ textToSpeech function not found');
      return res.status(500).json({ error: 'textToSpeech function not available' });
    }

    // 1. Generate AI response
    console.log('🤖 Generating AI response...');
    const aiResponse = await generateResponse(transcript);
    console.log('✅ AI Response:', aiResponse);

    // Truncate response if too long to avoid TwiML size limits
    const maxResponseLength = 500; // Keep responses under 500 characters
    const truncatedResponse = aiResponse.length > maxResponseLength 
      ? aiResponse.substring(0, maxResponseLength) + "..."
      : aiResponse;
    
    console.log('✅ Response length:', truncatedResponse.length, 'characters');

    // 2. For now, skip ElevenLabs to avoid TwiML size issues
    // const audioBuffer = await textToSpeech(aiResponse);
    // console.log('✅ Generated audio buffer, size:', audioBuffer.length);

    // 3. Check if Twilio credentials exist
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      console.error('❌ Missing Twilio credentials');
      return res.status(500).json({ error: 'Missing Twilio credentials' });
    }

    // 4. Create TwiML to play the response using Twilio's built-in TTS
    console.log('📞 Creating TwiML response...');
    const twiml = new twilio.twiml.VoiceResponse();
    
    // Use Twilio's built-in TTS (no size limit issues)
    twiml.say({
      voice: 'alice',
      language: 'en-US'
    }, truncatedResponse);
    
    // Keep the call alive for the next response
    twiml.pause({ length: 30 });
    
    console.log('📝 TwiML size:', twiml.toString().length, 'characters');
    
    // 5. Send the TwiML to the active call using Twilio REST API
    console.log('📡 Sending TwiML to active call...');
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    
    await client.calls(callSid).update({
      twiml: twiml.toString()
    });

    console.log('✅ AI response sent to caller successfully');

    res.json({ 
      success: true, 
      response: aiResponse,
      twimlSize: twiml.toString().length
    });

  } catch (error) {
    console.error('❌ Error in /process-transcript:', error);
    console.error('❌ Error stack:', error.stack);
    
    // Send fallback response to caller
    try {
      console.log('🔄 Sending fallback response...');
      const fallbackTwiml = new twilio.twiml.VoiceResponse();
      fallbackTwiml.say({
        voice: 'alice',
        language: 'en-US'
      }, 'I apologize, but I had trouble processing that. Could you please repeat what happened?');
      fallbackTwiml.pause({ length: 30 });
      
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      await client.calls(req.body.callSid).update({
        twiml: fallbackTwiml.toString()
      });
      
      console.log('✅ Fallback response sent');
    } catch (fallbackError) {
      console.error('❌ Fallback error:', fallbackError);
    }
    
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});