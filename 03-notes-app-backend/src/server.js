const config = require('./config/env');
const { connectDB, disconnectDB } = require('./config/db');
const app = require('./app');

async function start() {
  await connectDB(config.mongoUri);
  console.log('MongoDB connected');

  const server = app.listen(config.port, () => {
    console.log(`Notes API running at http://localhost:${config.port} (${config.env})`);
  });

  const shutdown = (signal) => {
    console.log(`${signal} received - shutting down gracefully`);
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((err) => {
  // Only print the message: the error object may contain the connection string.
  console.error('Failed to start server:', err.message);
  process.exit(1);
});
