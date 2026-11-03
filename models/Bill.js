const mongoose = require('mongoose');

const billLineSchema = new mongoose.Schema(
  {
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    quantity: { type: Number, required: true, min: 0.001 },
    unit: { type: String, required: true, enum: ['Kg', 'Piece', 'Liter'] },
    unitPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const billSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    billNo: { type: Number, required: true },
    items: { type: [billLineSchema], required: true, validate: (v) => v.length > 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    format: { type: String, enum: ['TXT', 'PDF'], required: true },
  },
  { timestamps: true }
);

billSchema.index({ user: 1, billNo: 1 }, { unique: true });
billSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Bill', billSchema);
