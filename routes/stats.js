const express = require('express');
const router = express.Router();
const TypingResult = require('../models/TypingResult');
const User = require('../models/User');
const { optionalAuth } = require('../middleware/auth');
const { redis } = require('../server'); // Import Redis from server.js

// Helper: Safe Redis get
const safeRedisGet = async (key) => {
  if (!redis) return null;
  try {
    const value = await redis.get(key);
    return value;
  } catch (err) {
    console.error('Redis GET error:', err);
    return null;
  }
};

// Helper: Safe Redis setex
const safeRedisSet = async (key, ttl, value) => {
  if (!redis) return;
  try {
    await redis.setex(key, ttl, value);
  } catch (err) {
    console.error('Redis SETEX error:', err);
  }
};

// @route   GET /api/stats/leaderboard
// @desc    Get global leaderboard
// @access  Public
router.get('/leaderboard', optionalAuth, async (req, res) => {
  try {
    const { limit = 10, period = 'all' } = req.query;

    // Try to get from cache
    const cacheKey = `leaderboard:${period}:${limit}`;
    const cached = await safeRedisGet(cacheKey);

    if (cached) {
      return res.status(200).json({
        success: true,
        leaderboard: JSON.parse(cached),
        cached: true
      });
    }

    let dateFilter = {};

    if (period !== 'all') {
      const now = new Date();
      if (period === 'today') {
        dateFilter.createdAt = { $gte: new Date(now.setHours(0, 0, 0, 0)) };
      } else if (period === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        dateFilter.createdAt = { $gte: weekAgo };
      } else if (period === 'month') {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        dateFilter.createdAt = { $gte: monthAgo };
      }
    }

    const leaderboard = await TypingResult.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$user',
          maxWPM: { $max: '$wpm' },
          avgWPM: { $avg: '$wpm' },
          avgAccuracy: { $avg: '$accuracy' },
          testCount: { $sum: 1 }
        }
      },
      { $sort: { maxWPM: -1, avgAccuracy: -1 } },
      { $limit: parseInt(limit) },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $project: {
          username: '$user.username',
          maxWPM: { $round: ['$maxWPM', 0] },
          avgWPM: { $round: ['$avgWPM', 0] },
          avgAccuracy: { $round: ['$avgAccuracy', 2] },
          testCount: 1
        }
      }
    ]);

    // Cache leaderboard
    await safeRedisSet(cacheKey, 300, JSON.stringify(leaderboard));

    res.status(200).json({
      success: true,
      leaderboard,
      period
    });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/stats/global
// @desc    Get global statistics
// @access  Public
router.get('/global', async (req, res) => {
  try {
    const cacheKey = 'global-stats';
    const cached = await safeRedisGet(cacheKey);

    if (cached) {
      return res.status(200).json({
        success: true,
        stats: JSON.parse(cached),
        cached: true
      });
    }

    const totalUsers = await User.countDocuments();
    const totalTests = await TypingResult.countDocuments();

    const avgStats = await TypingResult.aggregate([
      {
        $group: {
          _id: null,
          avgWPM: { $avg: '$wpm' },
          avgAccuracy: { $avg: '$accuracy' },
          maxWPM: { $max: '$wpm' },
          maxAccuracy: { $max: '$accuracy' }
        }
      }
    ]);

    const stats = {
      totalUsers,
      totalTests,
      globalAvgWPM: avgStats[0] ? Math.round(avgStats[0].avgWPM) : 0,
      globalAvgAccuracy: avgStats[0] ? Math.round(avgStats[0].avgAccuracy * 100) / 100 : 0,
      recordWPM: avgStats[0] ? Math.round(avgStats[0].maxWPM) : 0,
      recordAccuracy: avgStats[0] ? Math.round(avgStats[0].maxAccuracy * 100) / 100 : 0
    };

    await safeRedisSet(cacheKey, 600, JSON.stringify(stats));

    res.status(200).json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Get global stats error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/stats/trends
// @desc    Get user's performance trends
// @access  Private
router.get('/trends', optionalAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { days = 30 } = req.query;
    const cacheKey = `trends:${req.user._id}:${days}`;
    const cached = await safeRedisGet(cacheKey);

    if (cached) {
      return res.status(200).json({
        success: true,
        trends: JSON.parse(cached),
        cached: true
      });
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const trends = await TypingResult.aggregate([
      {
        $match: {
          user: req.user._id,
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          avgWPM: { $avg: '$wpm' },
          avgAccuracy: { $avg: '$accuracy' },
          testCount: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          date: '$_id',
          avgWPM: { $round: ['$avgWPM', 0] },
          avgAccuracy: { $round: ['$avgAccuracy', 2] },
          testCount: 1,
          _id: 0
        }
      }
    ]);

    await safeRedisSet(cacheKey, 600, JSON.stringify(trends));

    res.status(200).json({
      success: true,
      trends
    });
  } catch (error) {
    console.error('Get trends error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
