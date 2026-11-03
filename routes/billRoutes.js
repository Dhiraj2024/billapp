const express = require('express');
const mongoose = require('mongoose');
const Bill = require('../models/Bill');
const Counter = require('../models/Counter');

const router = express.Router();

async function nextBillNumber(userId) {
  try {
    const counter = await Counter.findOneAndUpdate(
      { user: userId },
      { $inc: { sequence: 1 } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    return counter.sequence;
  } catch (error) {
    if (error.code !== 11000) throw error;
    const counter = await Counter.findOneAndUpdate(
      { user: userId },
      { $inc: { sequence: 1 } },
      { new: true }
    );
    return counter.sequence;
  }
}

router.post('/', async (req, res, next) => {
  try {
    const { items, format } = req.body;
    if (!Array.isArray(items) || items.length === 0 || items.length > 200 || !['TXT', 'PDF'].includes(format)) {
      return res.status(400).json({ message: 'A bill needs items and a TXT or PDF format.' });
    }
    let totalAmount = 0;
    const lines = [];
    for (const row of items) {
      const quantity = Number(row.quantity);
      const unitPrice = Number(row.unitPrice);
      if (!row.name || typeof row.name !== 'string' || !Number.isFinite(quantity) || quantity <= 0 ||
          !Number.isFinite(unitPrice) || unitPrice < 0 || !['Kg', 'Piece', 'Liter'].includes(row.unit)) {
        return res.status(400).json({ message: 'One or more bill lines are invalid.' });
      }
      const lineTotal = Math.round(quantity * unitPrice * 100) / 100;
      totalAmount += lineTotal;
      lines.push({
        ...(mongoose.isValidObjectId(row.itemId) ? { itemId: row.itemId } : {}),
        name: row.name.trim(),
        quantity,
        unit: row.unit,
        unitPrice,
        lineTotal,
      });
    }
    totalAmount = Math.round(totalAmount * 100) / 100;
    const bill = await Bill.create({
      user: req.userId,
      billNo: await nextBillNumber(req.userId),
      items: lines,
      totalAmount,
      format,
    });
    return res.status(201).json({ bill });
  } catch (error) {
    return next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const filter = { user: req.userId };
    if (req.query.date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(req.query.date)) {
        return res.status(400).json({ message: 'date must use YYYY-MM-DD format.' });
      }
      const start = new Date(`${req.query.date}T00:00:00.000Z`);
      if (Number.isNaN(start.getTime())) return res.status(400).json({ message: 'Invalid date.' });
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 1);
      filter.createdAt = { $gte: start, $lt: end };
    }
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 100, 1), 200);
    return res.json({ bills: await Bill.find(filter).sort({ createdAt: -1 }).limit(limit).lean() });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid bill id.' });
    const bill = await Bill.findOne({ _id: req.params.id, user: req.userId }).lean();
    if (!bill) return res.status(404).json({ message: 'Bill not found.' });
    return res.json({ bill });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
