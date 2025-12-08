const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [30, 'Username cannot exceed 30 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  totalTests: {
    type: Number,
    default: 0
  },
  averageWPM: {
    type: Number,
    default: 0
  },
  averageAccuracy: {
    type: Number,
    default: 0
  },
  bestWPM: {
    type: Number,
    default: 0
  },
  bestAccuracy: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};

// Update user statistics
userSchema.methods.updateStats = function(wpm, accuracy) {
  this.totalTests += 1;
  this.averageWPM = ((this.averageWPM * (this.totalTests - 1)) + wpm) / this.totalTests;
  this.averageAccuracy = ((this.averageAccuracy * (this.totalTests - 1)) + accuracy) / this.totalTests;
  
  if (wpm > this.bestWPM) {
    this.bestWPM = wpm;
  }
  
  if (accuracy > this.bestAccuracy) {
    this.bestAccuracy = accuracy;
  }
  
  return this.save();
};

const User = mongoose.model('User', userSchema);

module.exports = User;