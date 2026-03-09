require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { errorHandler } = require('./middleware/errorHandler');

// ── Startup Environment Validation ────────────────────────────────────────────
if (!process.env.JWT_SECRET) {
  const msg = 'FATAL: JWT_SECRET environment variable is not set. Authentication will not work.';
  console.error(msg);
  if (process.env.NODE_ENV === 'production') process.exit(1);
}
if (!process.env.STRIPE_WEBHOOK_SECRET && process.env.NODE_ENV === 'production') {
  console.warn('WARNING: STRIPE_WEBHOOK_SECRET is not set. Stripe webhooks will be rejected.');
}

const app = express();
const PORT = process.env.PORT || 3000;

// Client directory (Express 5 / send 1.2+ requires root option for sendFile)
const CLIENT_DIR = path.join(__dirname, '..', 'client');
const sendOpts = { root: CLIENT_DIR };

// ── Security Headers (CSP) ────────────────────────────────────────────────────
// Scoreboard pages use React/Babel from unpkg.com with inline transpilation (needs unsafe-eval).
// All other pages only allow scripts from 'self' and unpkg.com.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // unpkg.com for lucide-icons, html5-qrcode; unsafe-eval for Babel on scoreboard pages
      scriptSrc: ["'self'", 'https://unpkg.com', "'unsafe-inline'", "'unsafe-eval'"],
      // HTML files use inline event handlers (onchange, onclick, etc.) — must allow them
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      // Socket.IO and API connections; unpkg.com for source-map fetches (.js.map)
      connectSrc: ["'self'", 'ws:', 'wss:', 'https://unpkg.com'],
      fontSrc: ["'self'", 'https:'],
      // Block Flash/plugin attacks
      objectSrc: ["'none'"],
      // Prevent clickjacking — only allow framing from same origin
      frameAncestors: ["'self'"],
    },
  },
}));

// ── Rate Limiting ─────────────────────────────────────────────────────────────
// Payment endpoints: 10 requests per minute per IP
const paymentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please wait a moment and try again.' },
});
// General API endpoints: 200 requests per minute per IP
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
});

// Stripe webhook — must be mounted BEFORE express.json() so the raw body
// is available for signature verification
app.use('/api/webhooks', require('./routes/webhook'));

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
app.use('/api/auth', apiLimiter, require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/academies', require('./routes/academies'));
app.use('/api/tournaments', require('./routes/tournaments'));
app.use('/api/profiles', require('./routes/profiles'));
app.use('/api/profiles', require('./routes/documents'));
// Payment checkout endpoints: strict rate limit
app.use('/api/registrations/checkout', paymentLimiter);
app.use('/api/credits/checkout', paymentLimiter);
app.use('/api/registrations', require('./routes/registrations'));
app.use('/api/guardians', require('./routes/guardians'));
app.use('/api/credits', require('./routes/credits'));
app.use('/api/super-admin', require('./routes/superAdmin'));
app.use('/api/email', require('./routes/email'));
app.use('/api/tournament-members', require('./routes/tournamentMembers'));
app.use('/api/tournaments', require('./routes/tournamentInvitations'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/my', require('./routes/myTournaments'));
app.use('/api/waivers', require('./routes/waivers'));
app.use('/api/tournaments', require('./routes/results'));
app.use('/api/tournaments', require('./routes/publicData'));
app.use('/api/tournaments', require('./routes/pricingPeriods'));
app.use('/api/tournaments', require('./routes/staffRoles'));
app.use('/api/tournaments', require('./routes/checkin'));
app.use('/api/tournaments', require('./routes/schedule'));
app.use('/api/tournaments', require('./routes/divisions'));
app.use('/api/tournaments', require('./routes/brackets'));
app.use('/api/tournaments', require('./routes/exports'));
app.use('/api/tournaments', require('./routes/certificates'));
app.use('/api/tournaments', require('./routes/scoreboardConfig'));
app.use('/api/tournaments', require('./routes/teams'));
app.use('/api/tournaments', require('./routes/discountCodes'));
app.use('/api/tournaments', require('./routes/medicalIncidents'));
app.use('/api/tournaments', require('./routes/sponsors'));
app.use('/api/feedback', require('./routes/feedback'));
app.use('/api/tournaments', require('./routes/feedback').tournamentRouter);
app.use('/api/tournaments', require('./routes/judgeAnalytics'));
app.use('/api/admin', require('./routes/judgeAnalyticsAdmin'));

// ── Static Files ────────────────────────────────────────────────────────────

// Serve uploaded files (dev fallback — production uses R2 URLs)
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Landing page — root URL serves the tournament directory
app.get('/', (req, res) => {
  res.sendFile('landing.html', sendOpts);
});

// Block old public page — redirect to landing page (file kept but not routable)
app.get('/public.html', (req, res) => {
  res.redirect('/');
});

// Serve client files (HTML, JS, CSS, images)
app.use(express.static(CLIENT_DIR));

// Route aliases
app.get('/admin', (req, res) => {
  res.sendFile('admin.html', sendOpts);
});
app.get('/register', (req, res) => {
  res.sendFile('register.html', sendOpts);
});
app.get('/director', (req, res) => {
  res.sendFile('director.html', sendOpts);
});
app.get('/my-events', (req, res) => {
  res.sendFile('my-events.html', sendOpts);
});
app.get('/badge', (req, res) => {
  res.sendFile('badge.html', sendOpts);
});
app.get('/coach', (req, res) => {
  res.sendFile('coach.html', sendOpts);
});
app.get('/waiver', (req, res) => {
  res.sendFile('waiver.html', sendOpts);
});
app.get('/staff', (req, res) => {
  res.sendFile('staff.html', sendOpts);
});
app.get('/feedback', (req, res) => {
  res.sendFile('feedback.html', sendOpts);
});

// Tournament Builder Wizard
app.get('/director/tournaments/new', (req, res) => {
  res.sendFile('wizard.html', sendOpts);
});
app.get('/director/tournaments/:id/wizard', (req, res) => {
  res.sendFile('wizard.html', sendOpts);
});

// Tournament Management (divisions, brackets, scoring, scoreboards)
app.get('/director/tournaments/:id/manage', (req, res) => {
  res.sendFile('manage.html', sendOpts);
});

// /tournaments/:slug — Serve public tournament page
app.get('/tournaments/:slug', (req, res) => {
  res.sendFile('tournament.html', sendOpts);
});

// ── Error Handler ───────────────────────────────────────────────────────────
app.use(errorHandler);

// ── Start Server ────────────────────────────────────────────────────────────

async function startServer() {
  // Run database migrations before starting
  if (process.env.DATABASE_URL) {
    try {
      const { execSync } = require('child_process');
      console.log('Running database migrations...');
      execSync('npx node-pg-migrate up', {
        stdio: 'inherit',
        env: { ...process.env },
        cwd: path.join(__dirname, '..'),
      });
      console.log('✓ Migrations complete');
    } catch (err) {
      console.warn('✗ Migration warning:', err.message);
      // Don't crash — server can still start if tables already exist
    }

    // Test database connection
    const pool = require('./db/pool');
    try {
      await pool.query('SELECT NOW()');
      console.log('✓ Database connected');
    } catch (err) {
      console.warn('✗ Database connection failed:', err.message);
    }
  }

  app.listen(PORT, () => {
    console.log(`Taikai by Kimesoft running on http://localhost:${PORT}`);
    console.log(`Landing:   http://localhost:${PORT}/`);
    console.log(`Director:  http://localhost:${PORT}/director`);
    console.log(`Register:  http://localhost:${PORT}/register`);
    console.log(`Admin:     http://localhost:${PORT}/admin`);
  });
}

startServer();
