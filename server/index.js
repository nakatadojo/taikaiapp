require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// Security headers (CSP disabled — scoreboards use inline React/Babel from CDN)
app.use(helmet({
  contentSecurityPolicy: false
}));

// Body parsing (10mb limit for base64 photos)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// CORS for development
if (process.env.NODE_ENV !== 'production') {
  app.use(cors({ origin: true, credentials: true }));
}

// Trust proxy in production (Railway uses reverse proxy)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// ── API Routes ──────────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/academies', require('./routes/academies'));
app.use('/api/tournaments', require('./routes/tournaments'));
app.use('/api/profiles', require('./routes/profiles'));
app.use('/api/registrations', require('./routes/registrations'));
app.use('/api/guardians', require('./routes/guardians'));
app.use('/api/credits', require('./routes/credits'));
app.use('/api/super-admin', require('./routes/superAdmin'));
app.use('/api/email', require('./routes/email'));

// ── Static Files ────────────────────────────────────────────────────────────

// Serve uploaded files (dev fallback — production uses R2 URLs)
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Landing page — root URL serves the tournament directory
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'landing.html'));
});

// Serve client files (HTML, JS, CSS, images)
app.use(express.static(path.join(__dirname, '..', 'client')));

// Route aliases
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'index.html'));
});
app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'register.html'));
});
app.get('/director', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'director.html'));
});

// Tournament Builder Wizard
app.get('/director/tournaments/new', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'wizard.html'));
});
app.get('/director/tournaments/:id/wizard', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'wizard.html'));
});

// /tournaments/:slug — Serve public tournament page
app.get('/tournaments/:slug', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'tournament.html'));
});

// ── Error Handler ───────────────────────────────────────────────────────────
app.use(errorHandler);

// ── Start Server ────────────────────────────────────────────────────────────

// Test database connection if DATABASE_URL is configured
if (process.env.DATABASE_URL) {
  const pool = require('./db/pool');
  pool.query('SELECT NOW()')
    .then(() => console.log('✓ Database connected'))
    .catch(err => console.warn('✗ Database connection failed:', err.message));
}

app.listen(PORT, () => {
  console.log(`Taikai by Kimesoft running on http://localhost:${PORT}`);
  console.log(`Landing:   http://localhost:${PORT}/`);
  console.log(`Director:  http://localhost:${PORT}/director`);
  console.log(`Register:  http://localhost:${PORT}/register`);
  console.log(`Admin:     http://localhost:${PORT}/admin`);
});
