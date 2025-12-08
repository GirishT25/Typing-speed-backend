const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { generateToken, protect } = require('../middleware/auth');
const Redis = require('ioredis');

// Initialize Redis client directly here
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  retryStrategy: (times) => Math.min(times * 50, 2000)
});

redis.on('connect', () => console.log('✓ Redis connected'));
redis.on('error', (err) => console.error('Redis error:', err));

// ---------------------- ROUTES ----------------------

// Register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password)
      return res.status(400).json({ success: false, message: 'All fields are required' });

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser)
      return res.status(400).json({ success: false, message: 'User already exists' });

    const user = await User.create({ username, email, password });
    const token = generateToken(user._id);

    await redis.set(`user:${user._id}`, JSON.stringify({ id: user._id, username, email }), 'EX', 3600);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        username,
        email,
        totalTests: user.totalTests,
        averageWPM: user.averageWPM,
        averageAccuracy: user.averageAccuracy
      }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email and password required' });

    const user = await User.findOne({ email }).select('+password');
    if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const isValid = await user.comparePassword(password);
    if (!isValid) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const token = generateToken(user._id);
    await redis.set(`user:${user._id}`, JSON.stringify({ id: user._id, username: user.username, email }), 'EX', 3600);

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        totalTests: user.totalTests,
        averageWPM: user.averageWPM,
        averageAccuracy: user.averageAccuracy,
        bestWPM: user.bestWPM,
        bestAccuracy: user.bestAccuracy
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get current user
router.get('/me', protect, async (req, res) => {
  try {
    const cached = await redis.get(`user:${req.user._id}`);
    if (cached) return res.status(200).json({ success: true, user: JSON.parse(cached) });

    const user = await User.findById(req.user._id).select('-password');
    await redis.set(
      `user:${user._id}`,
      JSON.stringify({
        id: user._id,
        username: user.username,
        email: user.email,
        totalTests: user.totalTests,
        averageWPM: user.averageWPM,
        averageAccuracy: user.averageAccuracy,
        bestWPM: user.bestWPM,
        bestAccuracy: user.bestAccuracy
      }),
      'EX',
      3600
    );

    res.status(200).json({ success: true, user });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Logout
router.post('/logout', protect, async (req, res) => {
  try {
    await redis.del(`user:${req.user._id}`);
    res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
