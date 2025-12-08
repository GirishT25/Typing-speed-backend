const mongoose = require("mongoose");

const typingResultSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  wpm: Number,
  accuracy: Number,
  timeElapsed: Number,
  totalCharacters: Number,
  correctCharacters: Number,
  incorrectCharacters: Number,
  textSample: String,
  sessionId: String,
  device: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("TypingResult", typingResultSchema);
