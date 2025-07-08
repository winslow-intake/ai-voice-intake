module.exports.transcribeStream = (audioBuffer) => {
  // For now, just log — you’ll replace this with Deepgram streaming later
  console.log('Received audio chunk:', audioBuffer.length);
};
