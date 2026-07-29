// EPE LGEA Birthday Dashboard - backend
// Serves the PWA, stores push subscriptions, and sends daily birthday push
// notifications using the Web Push protocol.

const express = require('express');
const webpush = require('web-push');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

const PORT = process.env.PORT || 3000;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';
const CRON_SECRET = process.env.CRON_SECRET || ''; // required to trigger /api/send-daily
const TIMEZONE = process.env.TZ_NAME || 'Africa/Lagos';

const SUBS_FILE = path.join(__dirname, 'subscriptions.json');
const DATA_FILE = path.join(__dirname, 'public', 'data', 'birthdays.json');
const VAPID_FILE = path.join(__dirname, 'vapid-keys.json');

// ─── VAPID KEYS: self-healing, no manual paste required ────────────────────
// If valid keys are set as env vars, use them. Otherwise, generate a fresh
// valid pair automatically and save it to disk so it stays the same across
// restarts (until the next code deploy, which resets the filesystem).
function isValidVapidPrivateKey(key) {
  try {
    const s = String(key).replace(/-/g, '+').replace(/_/g, '/');
    const padded = s + '='.repeat((4 - (s.length % 4)) % 4);
    return Buffer.from(padded, 'base64').length === 32;
  } catch (e) {
    return false;
  }
}

let VAPID_PUBLIC_KEY = (process.env.VAPID_PUBLIC_KEY || '').trim();
let VAPID_PRIVATE_KEY = (process.env.VAPID_PRIVATE_KEY || '').trim();

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !isValidVapidPrivateKey(VAPID_PRIVATE_KEY)) {
  let saved = null;
  try { saved = JSON.parse(fs.readFileSync(VAPID_FILE, 'utf-8')); } catch (e) { /* none yet */ }

  if (saved && isValidVapidPrivateKey(saved.privateKey)) {
    VAPID_PUBLIC_KEY = saved.publicKey;
    VAPID_PRIVATE_KEY = saved.privateKey;
    console.log('ℹ️  Using previously auto-generated VAPID keys from vapid-keys.json');
  } else {
    const generated = webpush.generateVAPIDKeys();
    VAPID_PUBLIC_KEY = generated.publicKey;
    VAPID_PRIVATE_KEY = generated.privateKey;
    fs.writeFileSync(VAPID_FILE, JSON.stringify(generated, null, 2));
    console.log('✅ No valid VAPID keys were provided — generated and saved a new pair automatically.');
  }
} else {
  console.log('ℹ️  Using VAPID keys from environment variables.');
}

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

function loadSubscriptions() {
  try {
    return JSON.parse(fs.readFileSync(SUBS_FILE, 'utf-8'));
  } catch (e) {
    return [];
  }
}
function saveSubscriptions(subs) {
  fs.writeFileSync(SUBS_FILE, JSON.stringify(subs, null, 2));
}
function loadBirthdays() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  } catch (e) {
    console.error('Could not read birthdays.json', e);
    return [];
  }
}

function todayInTZ() {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: TIMEZONE, month: 'numeric', day: 'numeric' });
  const parts = fmt.formatToParts(now).reduce((acc, p) => (acc[p.type] = p.value, acc), {});
  return { month: parseInt(parts.month, 10), day: parseInt(parts.day, 10) };
}

async function sendDailyBirthdayPush() {
  const { month, day } = todayInTZ();
  const birthdays = loadBirthdays();
  const todays = birthdays.filter((b) => b.month === month && b.day === day);

  if (todays.length === 0) {
    console.log(`[${new Date().toISOString()}] No birthdays today (${month}/${day}). Skipping push.`);
    return { sent: 0, todayCount: 0 };
  }

  const names = todays.map((b) => b.name).join(', ');
  const title = todays.length === 1 ? '🎂 1 Birthday Today!' : `🎂 ${todays.length} Birthdays Today!`;
  const body = names.length > 150 ? names.slice(0, 147) + '…' : names;
  const payload = JSON.stringify({ title, body, url: './index.html' });

  const subs = loadSubscriptions();
  let sent = 0;
  const stillValid = [];

  for (const sub of subs) {
    try {
      await webpush.sendNotification(sub, payload);
      sent++;
      stillValid.push(sub);
    } catch (err) {
      if (err.statusCode !== 410 && err.statusCode !== 404) {
        console.error('Push send error:', err.statusCode, err.body);
        stillValid.push(sub);
      } else {
        console.log('Removing expired subscription');
      }
    }
  }
  saveSubscriptions(stillValid);
  console.log(`[${new Date().toISOString()}] Sent ${sent}/${subs.length} pushes for ${todays.length} birthday(s).`);
  return { sent, todayCount: todays.length };
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/config.js', (req, res) => {
  res.type('application/javascript');
  res.send(`const VAPID_PUBLIC_KEY = "${VAPID_PUBLIC_KEY}";`);
});

app.post('/api/subscribe', (req, res) => {
  const sub = req.body;
  if (!sub || !sub.endpoint) return res.status(400).json({ error: 'Invalid subscription' });
  const subs = loadSubscriptions();
  if (!subs.find((s) => s.endpoint === sub.endpoint)) {
    subs.push(sub);
    saveSubscriptions(subs);
  }
  res.json({ ok: true });
});

app.post('/api/unsubscribe', (req, res) => {
  const { endpoint } = req.body || {};
  const subs = loadSubscriptions().filter((s) => s.endpoint !== endpoint);
  saveSubscriptions(subs);
  res.json({ ok: true });
});

app.all('/api/send-daily', async (req, res) => {
  const key = req.query.key || (req.body && req.body.key);
  if (!CRON_SECRET || key !== CRON_SECRET) {
    return res.status(401).json({ error: 'Missing or invalid key' });
  }
  const result = await sendDailyBirthdayPush();
  res.json(result);
});

app.get('/api/health', (req, res) => res.json({ ok: true, subscriberCount: loadSubscriptions().length }));

cron.schedule('0 7 * * *', () => {
  sendDailyBirthdayPush().catch((e) => console.error('Cron send failed', e));
}, { timezone: TIMEZONE });

app.listen(PORT, () => {
  console.log(`EPE Birthday Dashboard running on port ${PORT}`);
});
