const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    ownerName: { type: String, trim: true, maxlength: 120, default: '' },
    shopName: { type: String, trim: true, maxlength: 120, default: '' },
    mobNo: { type: String, trim: true, maxlength: 30, default: '' },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    address: { type: String, trim: true, maxlength: 500, default: '' },
    endMsg: { type: String, trim: true, maxlength: 200, default: 'Thank you! Visit again.' },
    passwordHash: { type: String, select: false },
    googleId: { type: String, sparse: true, unique: true, select: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
