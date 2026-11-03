const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  sequence: { type: Number, default: 0, min: 0 },
});

module.exports = mongoose.model('Counter', counterSchema);
