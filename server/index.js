require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const {
  createIndividualRegistration,
  createTeamRegistration,
  listTeams,
  teamUpIndividuals,
  markAttendance,
  exportTeams
} = require('./registrationService');

// Ensure Firebase is configured in production (fail fast) so admin actions
// like team-up and attendance persist to Firestore. For development we allow
// an in-memory mock.
try {
  const { db, admin } = require('./firebase');
  if (process.env.NODE_ENV !== 'development' && (!db || !admin)) {
    console.error('Firebase not configured in production. Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_CREDENTIALS. Exiting.');
    process.exit(1);
  }
} catch (err) {
  // ignore; registrationService will handle missing DB in development
}

const app = express();
const PORT = process.env.PORT || 3000;

// Configure CORS: allow origin from env or default to same origin only in prod
const allowedOrigin = process.env.CORS_ORIGIN || (process.env.NODE_ENV === 'production' ? null : '*');
app.use(cors({ origin: allowedOrigin || undefined }));
app.use(express.json({ limit: '1mb' }));

// Request logging
app.use(morgan(process.env.MORGAN_FORMAT || 'combined'));

// Security middleware
  try {
    const helmet = require('helmet');
    const rateLimit = require('express-rate-limit');
    app.use(helmet());
    // Make rate limit configurable via env
    const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || (15 * 60 * 1000);
    const max = parseInt(process.env.RATE_LIMIT_MAX, 10) || 200;
    app.use(rateLimit({ windowMs, max }));
  } catch (err) {
    console.warn('Helmet or rate-limit not installed. Run npm install to enable security middleware.');
  }

const clientRoot = path.join(__dirname, '..');

function sendClientFile(res, relativePath) {
  return res.sendFile(path.join(clientRoot, relativePath));
}

function validateEmail(value) {
  return /.+@.+\..+/i.test(value);
}

function requireAdmin(req, res, next) {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey) {
    return res.status(500).json({ error: 'Admin key is not configured on the server.' });
  }

  const providedKey = req.get('x-admin-key');
  if (!providedKey || providedKey !== adminKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  return next();
}

app.post('/api/register', async (req, res) => {
  try {
    const { type } = req.body || {};

    if (type === 'individual') {
      const { name, email, phone, profileLink, notes } = req.body.participant || {};

      if (!name || !email) {
        return res.status(400).json({ error: 'Name and email are required.' });
      }

      if (!validateEmail(email)) {
        return res.status(400).json({ error: 'Please provide a valid email address.' });
      }

      const result = await createIndividualRegistration({
        name,
        email,
        phone,
        profile: profileLink,
        notes
      });

      return res.status(201).json({
        message: 'Individual registration received.',
        teamId: result.id
      });
    }

    if (type === 'team') {
      const { teamName, leader, members = [], notes } = req.body;

      if (!teamName || !leader) {
        return res.status(400).json({ error: 'Team name and leader details are required.' });
      }

      if (!leader.name || !leader.email) {
        return res.status(400).json({ error: 'Leader name and email are required.' });
      }

      if (!validateEmail(leader.email)) {
        return res.status(400).json({ error: 'Please provide a valid leader email address.' });
      }

      const sanitizedMembers = Array.isArray(members)
        ? members.slice(0, 3).map((member) => ({
            name: member?.name || '',
            email: member?.email || '',
            phone: member?.phone || '',
            profile: member?.profileLink || member?.profile || ''
          }))
        : [];

      const result = await createTeamRegistration({
        teamName,
        leader: {
          name: leader.name,
          email: leader.email,
          phone: leader.phone,
          profile: leader.profileLink || leader.profile
        },
        members: sanitizedMembers.filter((member) => member.name.trim()),
        notes
      });

      return res.status(201).json({
        message: 'Team registration received.',
        teamId: result.id
      });
    }

    return res.status(400).json({ error: 'Unsupported registration type.' });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Unable to save registration right now.' });
  }
});

app.get('/api/admin/registrations', requireAdmin, async (req, res) => {
  try {
    console.log('Admin registrations request received; view=', req.query.view);
    const view = req.query.view === 'individuals' || req.query.view === 'teams'
      ? req.query.view
      : 'all';

    const teams = await listTeams(view);
    return res.json({ teams });
  } catch (error) {
    console.error('List registrations error:', error);
    // Ensure JSON is always returned on error
    return res.status(500).json({ error: error.message || 'Unable to fetch registrations.' });
  }
});

app.post('/api/admin/team-up', requireAdmin, async (req, res) => {
  try {
    const { participantIds, teamName, leaderParticipantId, notes } = req.body || {};

    if (!Array.isArray(participantIds) || participantIds.length === 0) {
      return res.status(400).json({ error: 'Participants are required.' });
    }

    if (!teamName) {
      return res.status(400).json({ error: 'Team name is required.' });
    }

    const { newTeamId } = await teamUpIndividuals({
      participantIds,
      teamName,
      contactParticipantId: leaderParticipantId,
      notes
    });

    return res.status(201).json({
      message: 'Team created from individuals.',
      teamId: newTeamId
    });
  } catch (error) {
    console.error('Team-up error:', error);
    return res.status(400).json({ error: error.message || 'Unable to team up participants.' });
  }
});

app.post('/api/admin/attendance', requireAdmin, async (req, res) => {
  try {
    const { teamId, present = true, seatNumber } = req.body || {};

    if (!teamId) {
      return res.status(400).json({ error: 'Team id is required.' });
    }

    const result = await markAttendance({ teamId, present, seatNumber });
    return res.json({
      message: present ? 'Attendance marked.' : 'Attendance cleared.',
      ...result
    });
  } catch (error) {
    console.error('Attendance error:', error);
    return res.status(400).json({ error: error.message || 'Unable to mark attendance.' });
  }
});

app.get('/api/admin/export', requireAdmin, async (req, res) => {
  try {
    const view = req.query.view === 'individuals' || req.query.view === 'teams'
      ? req.query.view
      : 'all';

    const rows = await exportTeams(view);
    const format = (req.query.format || 'csv').toLowerCase();

    if (format === 'xlsx') {
      // Lazy require to avoid pulling exceljs unless requested
      const ExcelJS = require('exceljs');
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Kickstart Export');
      rows.forEach((r) => ws.addRow(r));
      const filename = `kickstart-${view}-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return wb.xlsx.write(res).then(() => res.end());
    }

    // Default CSV format: add a metadata line describing export time and DB mode
    const metadata = [`Export Time: ${new Date().toISOString()}`, `DB Mode: ${process.env.NODE_ENV || 'production'}`];
    const rowsWithMeta = [metadata, ...rows];

    const csv = rowsWithMeta
      .map((columns) => columns.map((value) => {
        const stringValue = value == null ? '' : String(value);
        if (/[",\n]/.test(stringValue)) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      }).join(','))
      .join('\n');

    const filename = `kickstart-${view}-export-${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    // Prefix with UTF-8 BOM so Excel on Windows detects UTF-8 correctly.
    const bom = '\uFEFF';
    return res.send(bom + csv);
  } catch (error) {
    console.error('Export error:', error);
    return res.status(500).json({ error: error.message || 'Unable to export registrations.' });
  }
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/status', (_req, res) => {
  try {
    const { db, admin } = require('./firebase');
    const mode = process.env.NODE_ENV || 'production';
    const status = db && admin ? 'connected' : (mode === 'development' ? 'mock' : 'offline');
    return res.json({ status, mode });
  } catch (err) {
    return res.json({ status: 'error', message: err.message });
  }
});

app.use('/assets', express.static(path.join(clientRoot, 'assets')));

app.get(['/', '/index.html'], (_req, res) => sendClientFile(res, 'index.html'));
app.get(['/register', '/register.html'], (_req, res) => sendClientFile(res, 'register.html'));
app.get(['/admin', '/admin.html'], (_req, res) => sendClientFile(res, 'admin.html'));
app.get('/style.css', (_req, res) => sendClientFile(res, 'style.css'));
app.get('/register.js', (_req, res) => sendClientFile(res, 'register.js'));
app.get('/admin.js', (_req, res) => sendClientFile(res, 'admin.js'));

app.use((err, _req, res, _next) => {
  console.error('Unexpected error:', err);
  res.status(500).json({ error: 'Unexpected server error.' });
});

function startServer() {
  app.listen(PORT, () => {
    console.log(`Kickstart server running on http://localhost:${PORT}`);
  });
}

// Global error handlers to avoid silent crashes
process.on('unhandledRejection', (reason, p) => {
  console.error('Unhandled Rejection at: Promise', p, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  // In production we want the process to crash so it can be restarted by a supervisor
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

// If this file is run directly, start the server. When required (for serverless)
// the app will be exported instead so a wrapper can handle requests.
if (require.main === module) {
  startServer();
}

module.exports = app;
