const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    visibleIn: { type: String, required: true, enum: ['OPEN', 'PACK'] },
  },
  { timestamps: true }
);

categorySchema.index({ user: 1, visibleIn: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Category', categorySchema);
