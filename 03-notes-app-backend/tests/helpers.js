// Shared test setup. Must be required BEFORE the app so NODE_ENV is "test".
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-secret-0123456789abcdef0123456789abcdef';
process.env.JWT_EXPIRES_IN = '1h';
process.env.BCRYPT_SALT_ROUNDS = '4'; // fast hashing for tests only

const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../src/config/db');

const TEST_URI = process.env.MONGO_URI_TEST || 'mongodb://127.0.0.1:27017/notes_app_test';

async function setupDB() {
  await connectDB(TEST_URI);
  const dbName = mongoose.connection.db.databaseName;
  // Safety net: tests wipe data, so never run them against a real database.
  if (!dbName.endsWith('_test')) {
    await disconnectDB();
    throw new Error(`Refusing to run tests on database "${dbName}": its name must end with "_test".`);
  }
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
}

async function clearDB() {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
}

async function teardownDB() {
  await mongoose.connection.dropDatabase();
  await disconnectDB();
}

module.exports = { setupDB, clearDB, teardownDB };
