require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const connectDatabase = require('./config/db');
const authMiddleware = require('./middleware/authMiddleware');

const required = ['MONGO_URL', 'SECRET_KEY'];
for (const name of required) {
  if (!process.env[name]) throw new Error(`${name} is required`);
}
if (process.env.SECRET_KEY.length < 32) throw new Error('SECRET_KEY must be at least 32 characters');

const app = express();
const origins = (process.env.CLIENT_ORIGINS || 'http://localhost:8081,http://localhost:19006')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || origins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by CORS'));
  },
}));
app.use(express.json({ limit: '1mb' }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 100 }));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/items', authMiddleware, require('./routes/itemRoutes'));
app.use('/api/bills', authMiddleware, require('./routes/billRoutes'));
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  if (err.message === 'Origin is not allowed by CORS') return res.status(403).json({ message: err.message });
  if (err.name === 'ValidationError') return res.status(400).json({ message: 'Submitted data is invalid.' });
  if (err.name === 'MongoServerError' && err.code === 11000) return res.status(409).json({ message: 'A duplicate record already exists.' });
  return res.status(500).json({ message: 'An unexpected server error occurred.' });
});

const port = Number(process.env.PORT) || 5000;
connectDatabase()
  .then(() => app.listen(port, () => console.log(`Billin.go API listening on port ${port}`)))
  .catch((error) => {
    console.error('Failed to start Billin.go API:', error);
    process.exitCode = 1;
  });
