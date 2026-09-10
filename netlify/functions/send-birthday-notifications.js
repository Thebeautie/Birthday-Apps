const webpush = require('web-push');
const { getStore } = require('@netlify/blobs');
const birthdays = require('./birthdays.json');

webpush.setVapidDetails('mailto:admin@epelgea.example.com', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);

function todayInLagos() {
  const now = new Date(Date.now() + 60 * 60 * 1000);
  return { day: now.getUTCDate(), month: now.getUTCMonth() + 1 };
}

exports.handler = async () => {
  const { day, month } = todayInLagos();
  const todays = birthdays.filter((b) => b.day === day && b.month === month);
  const store = getStore('push-subscriptions');
  const { blobs } = await store.list();
  if (!todays.length) return { statusCode: 200, body: 'No birthdays today, nothing sent.' };

  const title = todays.length === 1 ? `🎂 Birthday today: ${todays[0].name}` : `🎂 ${todays.length} birthdays today at EPE LGEA`;
  const body = todays.slice(0, 5).map((b) => `${b.name} — ${b.school}`).join('\n') + (todays.length > 5 ? `\n…and ${todays.length - 5} more` : '');
  const payload = JSON.stringify({ title, body, url: '/' });

  let sent = 0, failed = 0;
  for (const blobEntry of blobs) {
    const sub = await store.get(blobEntry.key, { type: 'json' });
    if (!sub) continue;
    try { await webpush.sendNotification(sub, payload); sent++; }
    catch (err) { failed++; if (err.statusCode === 404 || err.statusCode === 410) await store.delete(blobEntry.key); }
  }
  return { statusCode: 200, body: `Sent ${sent}, failed ${failed}, birthdays ${todays.length}.` };
};
