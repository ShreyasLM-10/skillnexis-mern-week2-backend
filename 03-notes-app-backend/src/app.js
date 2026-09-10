const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const { rateLimit } = require('express-rate-limit');

const config = require('./config/env');
require('./config/db'); // applies global Mongoose security settings
const authRoutes = require('./routes/authRoutes');
const noteRoutes = require('./routes/noteRoutes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

if (config.trustProxy) app.set('trust proxy', config.trustProxy);

// --- Security & parsing middleware --------------------------------------
app.use(helmet()); // secure HTTP headers, removes X-Powered-By
app.use(
  cors({
    origin: config.corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);
app.use(express.json({ limit: '100kb' })); // notes can be long, but cap the body size
if (config.env === 'development') app.use(morgan('dev'));

app.use(
  '/api',
  rateLimit({
    windowMs: config.rateLimit.windowMs,
    limit: config.rateLimit.max,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => config.isTest,
    message: { success: false, error: { message: 'Too many requests, please try again later.' } },
  }),
);

// --- Routes ---------------------------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok' } });
});
app.use('/api/auth', authRoutes);
app.use('/api/notes', noteRoutes);

// --- Errors ---------------------------------------------------------------
app.use(notFound);
app.use(errorHandler);

module.exports = app;
