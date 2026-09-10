const mongoose = require('mongoose');

// Security-related global Mongoose settings:
// - strictQuery: silently drop filter fields that are not in the schema.
// - sanitizeFilter: wrap any user-supplied object containing `$` keys in `$eq`,
//   which neutralises NoSQL "query selector injection" such as { "$ne": null }.
mongoose.set('strictQuery', true);
mongoose.set('sanitizeFilter', true);

async function connectDB(uri) {
  if (!uri) {
    throw new Error('MONGO_URI is not set. Copy .env.example to .env and configure it.');
  }
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
  return mongoose.connection;
}

async function disconnectDB() {
  await mongoose.disconnect();
}

module.exports = { connectDB, disconnectDB };
