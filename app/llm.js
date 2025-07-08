const { OpenAI } = require('openai');
require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function generateResponse(transcript) {
  const prompt = `You are Riley, a friendly legal intake assistant. Based on the caller's statement: "${transcript}", respond politely and guide them toward explaining more about their accident.`;

  const chatResponse = await openai.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: 'gpt-4-turbo'
  });

  return chatResponse.choices[0]?.message?.content || 'Thanks for the information. Our team will follow up soon.';
}

module.exports = { generateResponse };