const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const googleClient = new OAuth2Client();

function issueToken(user) {
  return jwt.sign({ sub: user.id }, process.env.SECRET_KEY, { expiresIn: '30d' });
}

function publicUser(user) {
  return {
    id: user.id,
    ownerName: user.ownerName,
    shopName: user.shopName,
    mobNo: user.mobNo,
    email: user.email,
    address: user.address,
    endMsg: user.endMsg,
  };
}

router.post('/signup', async (req, res, next) => {
  try {
    const { ownerName, email, password } = req.body;
    if (!ownerName?.trim() || !emailPattern.test(email || '') || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ message: 'Enter a name, valid email, and password of at least 8 characters.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (await User.exists({ email: normalizedEmail })) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ ownerName: ownerName.trim(), email: normalizedEmail, passwordHash });
    return res.status(201).json({ token: issueToken(user), user: publicUser(user) });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'An account with this email already exists.' });
    return next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = req.body.password;
    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user || !user.passwordHash || typeof password !== 'string' || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ message: 'Email or password is incorrect.' });
    }
    return res.json({ token: issueToken(user), user: publicUser(user) });
  } catch (error) {
    return next(error);
  }
});

router.post('/google', async (req, res, next) => {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const { idToken } = req.body;
    if (!clientId) return res.status(503).json({ message: 'Google sign-in is not configured on the server.' });
    if (typeof idToken !== 'string' || !idToken) return res.status(400).json({ message: 'Google ID token is required.' });

    const ticket = await googleClient.verifyIdToken({ idToken, audience: clientId });
    const profile = ticket.getPayload();
    if (!profile?.email || !profile.email_verified) {
      return res.status(401).json({ message: 'Google account email is not verified.' });
    }

    let user = await User.findOne({ email: profile.email.toLowerCase() });
    if (!user) {
      user = await User.create({
        email: profile.email.toLowerCase(),
        ownerName: profile.name || '',
        googleId: profile.sub,
      });
    } else if (!user.googleId) {
      user.googleId = profile.sub;
      await user.save();
    }
    return res.json({ token: issueToken(user), user: publicUser(user) });
  } catch (error) {
    return next(error);
  }
});

router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'Account not found.' });
    return res.json({ user: publicUser(user) });
  } catch (error) {
    return next(error);
  }
});

router.patch('/profile', authMiddleware, async (req, res, next) => {
  try {
    const fields = ['ownerName', 'shopName', 'mobNo', 'email', 'address', 'endMsg'];
    const updates = {};
    for (const field of fields) {
      if (Object.hasOwn(req.body, field)) {
        if (typeof req.body[field] !== 'string') {
          return res.status(400).json({ message: `${field} must be text.` });
        }
        updates[field] = req.body[field].trim();
      }
    }
    if ('email' in updates && !emailPattern.test(updates.email)) {
      return res.status(400).json({ message: 'Enter a valid email address.' });
    }
    const user = await User.findByIdAndUpdate(req.userId, updates, { new: true, runValidators: true });
    if (!user) return res.status(404).json({ message: 'Account not found.' });
    return res.json({ user: publicUser(user) });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'That email is already in use.' });
    return next(error);
  }
});

module.exports = router;
