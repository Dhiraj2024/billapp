const express = require('express');
const mongoose = require('mongoose');
const Item = require('../models/Item');
const Category = require('../models/Category');

const router = express.Router();
const units = new Set(['Kg', 'Piece', 'Liter']);
const visibilities = new Set(['OPEN', 'PACK']);

function validateItem(body) {
  return typeof body.category === 'string' && body.category.trim() &&
    typeof body.name === 'string' && body.name.trim() &&
    Number.isFinite(Number(body.price)) && Number(body.price) >= 0 &&
    units.has(body.unit) && visibilities.has(body.visibleIn);
}

router.get('/', async (req, res, next) => {
  try {
    const filter = { user: req.userId };
    if (req.query.visibleIn) {
      if (!visibilities.has(req.query.visibleIn)) return res.status(400).json({ message: 'visibleIn must be OPEN or PACK.' });
      filter.visibleIn = req.query.visibleIn;
    }
    return res.json({ items: await Item.find(filter).sort({ visibleIn: 1, category: 1, name: 1 }).lean() });
  } catch (error) {
    return next(error);
  }
});

router.get('/categories', async (req, res, next) => {
  try {
    const categories = await Category.find({ user: req.userId }).sort({ visibleIn: 1, name: 1 }).lean();
    return res.json({ categories });
  } catch (error) {
    return next(error);
  }
});

router.post('/categories', async (req, res, next) => {
  try {
    const { name, visibleIn } = req.body;
    if (typeof name !== 'string' || !name.trim() || !visibilities.has(visibleIn)) {
      return res.status(400).json({ message: 'Provide a category name and OPEN or PACK visibility.' });
    }
    const category = await Category.create({ user: req.userId, name: name.trim(), visibleIn });
    return res.status(201).json({ category });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'This category already exists.' });
    return next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    if (!validateItem(req.body)) return res.status(400).json({ message: 'Provide valid category, name, price, unit, and visibility.' });
    const item = await Item.create({ ...req.body, user: req.userId, price: Number(req.body.price) });
    return res.status(201).json({ item });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'This item already exists in the category.' });
    return next(error);
  }
});

router.post('/bulk', async (req, res, next) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0 || items.length > 1000) {
      return res.status(400).json({ message: 'Provide between 1 and 1000 items.' });
    }
    const invalidLine = items.findIndex((item) => !validateItem(item));
    if (invalidLine !== -1) return res.status(400).json({ message: `Invalid item at row ${invalidLine + 1}.` });

    const docs = items.map((item) => ({
      user: req.userId,
      category: item.category.trim(),
      name: item.name.trim(),
      price: Number(item.price),
      unit: item.unit,
      visibleIn: item.visibleIn,
    }));
    const keys = new Set();
    for (const item of docs) {
      const key = `${item.visibleIn}\u0000${item.category}\u0000${item.name}`;
      if (keys.has(key)) return res.status(409).json({ message: 'The upload contains duplicate items.' });
      keys.add(key);
    }
    const existing = await Item.exists({
      user: req.userId,
      $or: docs.map(({ visibleIn, category, name }) => ({ visibleIn, category, name })),
    });
    if (existing) return res.status(409).json({ message: 'An item in the upload already exists. Remove duplicates and try again.' });

    const result = await Item.insertMany(docs);
    return res.status(201).json({ inserted: result.length, items: result });
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError || error.code === 11000) {
      return res.status(409).json({ message: 'Some rows were invalid or duplicate; remove duplicates and upload again.' });
    }
    return next(error);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid item id.' });
    if (!validateItem(req.body)) return res.status(400).json({ message: 'Provide valid category, name, price, unit, and visibility.' });
    const item = await Item.findOneAndUpdate(
      { _id: req.params.id, user: req.userId },
      {
        category: req.body.category.trim(),
        name: req.body.name.trim(),
        price: Number(req.body.price),
        unit: req.body.unit,
        visibleIn: req.body.visibleIn,
      },
      { new: true, runValidators: true }
    );
    if (!item) return res.status(404).json({ message: 'Item not found.' });
    return res.json({ item });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'This item already exists in the category.' });
    return next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid item id.' });
    const item = await Item.findOneAndDelete({ _id: req.params.id, user: req.userId });
    if (!item) return res.status(404).json({ message: 'Item not found.' });
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
