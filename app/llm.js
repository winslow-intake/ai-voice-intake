const { OpenAI } = require('openai');
require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function generateResponse(transcript, conversationHistory = null) {
  try {
    // If we have conversation history, use it for context
    if (conversationHistory && conversationHistory.length > 0) {
      console.log('🧠 Using conversation history for context');
      
      const chatResponse = await openai.chat.completions.create({
        messages: conversationHistory, // Use the full conversation history
        model: 'gpt-4-turbo'
      });
      
      return chatResponse.choices[0]?.message?.content || 'I apologize, but I had trouble processing that. Could you please repeat what happened?';
    }
    
    // Fallback to old method if no history provided
    const prompt = `You are Riley, a friendly legal intake assistant. Based on the caller's statement: "${transcript}", respond politely and guide them toward explaining more about their accident.`;
    
    const chatResponse = await openai.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'gpt-4-turbo'
    });
    
    return chatResponse.choices[0]?.message?.content || 'Thanks for the information. Our team will follow up soon.';
  } catch (error) {
    console.error('❌ Error generating response:', error);
    return 'I apologize, but I had trouble processing that. Could you please repeat what happened?';
  }
}

module.exports = { generateResponse };