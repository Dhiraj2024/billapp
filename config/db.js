const mongoose = require('mongoose');

async function connectDatabase() {
  const uri = process.env.MONGO_URL;
  if (!uri) {
    throw new Error('MONGO_URL is required');
  }

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
  });
  console.log('Connected to MongoDB');
}

module.exports = connectDatabase;
