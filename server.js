const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const Redis = require('ioredis');

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Redis Client
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  }
});

redis.on('connect', () => {
  console.log('✓ Redis connected successfully');
});

redis.on('error', (err) => {
  console.error('Redis error:', err);
});

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/typing_speed', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✓ MongoDB connected successfully'))
.catch((err) => console.error('MongoDB connection error:', err));

// Routes
const authRoutes = require('./routes/auth');
const typingRoutes = require('./routes/typing');
const statsRoutes = require('./routes/stats');

app.use('/api/auth', authRoutes);
app.use('/api/typing', typingRoutes);
app.use('/api/stats', statsRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    redis: redis.status === 'ready' ? 'connected' : 'disconnected'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false, 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`✓ Server running on port ${PORT}`);
});

module.exports = { redis };