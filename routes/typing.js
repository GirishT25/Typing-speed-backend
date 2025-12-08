const express = require('express');
const router = express.Router();
const TypingResult = require('../models/TypingResult');
const { protect } = require('../middleware/auth');

// Example typing texts
const typingTexts = [
  "The quick brown fox jumps over the lazy dog.",
  "Hello world! Welcome to the typing speed test.",
  "Practice makes perfect. Keep typing every day."
];

/* ---------------------- GET RANDOM TEXT ---------------------- */
router.get('/text', (req, res) => {
  try {
    const randomIndex = Math.floor(Math.random() * typingTexts.length);
    res.status(200).json({ success: true, text: typingTexts[randomIndex] });
  } catch (err) {
    console.error('Get text error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ---------------------- SUBMIT RESULT ---------------------- */
router.post('/result', protect, async (req, res) => {
  try {
    const {
      wpm,
      accuracy,
      timeElapsed,
      totalCharacters,
      correctCharacters,
      incorrectCharacters,
      textSample,
      sessionId,
      device
    } = req.body;

    // Basic validation
    if (!wpm || !accuracy) {
      return res.status(400).json({
        success: false,
        message: "WPM & accuracy are required"
      });
    }

    // Save typing result in DB
    const result = await TypingResult.create({
      userId: req.user._id,
      wpm,
      accuracy,
      timeElapsed,
      totalCharacters,
      correctCharacters,
      incorrectCharacters,
      textSample,
      sessionId,
      device,
      createdAt: new Date()
    });

    res.status(201).json({
      success: true,
      message: 'Result stored successfully',
      data: result
    });

  } catch (err) {
    console.error("Submit result error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ---------------------- GET USER RESULTS ---------------------- */
router.get('/results', protect, async (req, res) => {
  try {
    const results = await TypingResult.find({ userId: req.user._id })
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, results });
  } catch (err) {
    console.error('Get results error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ---------------------- BEST RESULTS (Leaderboard) ---------------------- */
router.get('/best-results', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const topUsers = await TypingResult.find()
      .sort({ wpm: -1 })
      .limit(limit)
      .populate('userId', 'username');

    res.status(200).json({ success: true, topUsers });
  } catch (err) {
    console.error('Get best results error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ---------------------- USER STATS ---------------------- */
router.get('/stats', protect, async (req, res) => {
  try {
    const results = await TypingResult.find({ userId: req.user._id });

    if (results.length === 0) {
      return res.status(200).json({
        success: true,
        stats: { tests: 0 }
      });
    }

    const averageWPM = Math.round(results.reduce((a, b) => a + b.wpm, 0) / results.length);
    const averageAccuracy = Math.round(results.reduce((a, b) => a + b.accuracy, 0) / results.length);
    const bestWPM = Math.max(...results.map(r => r.wpm));
    const bestAccuracy = Math.max(...results.map(r => r.accuracy));

    res.status(200).json({
      success: true,
      stats: {
        totalTests: results.length,
        averageWPM,
        averageAccuracy,
        bestWPM,
        bestAccuracy
      }
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
