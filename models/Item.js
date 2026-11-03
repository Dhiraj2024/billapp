const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    category: { type: String, required: true, trim: true, maxlength: 80 },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    price: { type: Number, required: true, min: 0 },
    unit: { type: String, required: true, enum: ['Kg', 'Piece', 'Liter'] },
    visibleIn: { type: String, required: true, enum: ['OPEN', 'PACK'], index: true },
  },
  { timestamps: true }
);

itemSchema.index({ user: 1, visibleIn: 1, category: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Item', itemSchema);
