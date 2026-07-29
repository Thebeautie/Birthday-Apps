# EPE LGEA Birthday Dashboard — App + Push Notifications

This turns the original dashboard into an installable app (PWA) with real
push notifications for staff birthdays, even when the app is closed.

## What's inside
- `public/` — the app itself (same dashboard, now installable + offline-capable)
- `public/data/birthdays.json` — the 1,035 staff records (kept separate from
  the HTML so the app loads fast)
- `server.js` — small backend that stores who wants notifications and sends
  the daily birthday push
- `sw.js` (inside `public/`) — the service worker that receives push
  notifications and shows them, even if the browser is closed

I can't deploy this live for you from here (this environment has no internet
access), but the steps below get you running in about 10–15 minutes, for free.

## Step 1 — Get the code online
Upload this whole `app` folder to a free host that keeps Node servers running.
**Render.com** is the easiest for this:

1. Create a free account at render.com
2. Push this folder to a GitHub repo (or use Render's "Upload" option if available)
3. On Render: **New → Web Service** → connect the repo
4. Build command: `npm install`
5. Start command: `npm start`

Any Node host works the same way (Railway, Fly.io, a cPanel Node app, etc.) —
the steps are the same: install, then `npm start`.

## Step 2 — Generate your push keys (one-time)
On your own computer, with Node installed, run:
```
npx web-push generate-vapid-keys
```
This prints a **Public Key** and a **Private Key**. Copy both.

## Step 3 — Set environment variables on your host
On Render (or whichever host), add these environment variables:
| Variable | Value |
|---|---|
| `VAPID_PUBLIC_KEY` | the public key from Step 2 |
| `VAPID_PRIVATE_KEY` | the private key from Step 2 |
| `VAPID_SUBJECT` | `mailto:youremail@example.com` |
| `CRON_SECRET` | any random string you make up, e.g. `epe2026secret` |
| `TZ_NAME` | `Africa/Lagos` |

Redeploy after setting these.

## Step 4 — Make sure the daily reminder actually fires
Free hosts put the server to sleep when nobody's visiting, so a timer inside
the app can miss its 7am alarm. The reliable fix: use a free external cron
service to "wake" the server at 7am and trigger the send.

1. Go to **cron-job.org** (free, no card needed) and create an account
2. Create a new cron job:
   - URL: `https://YOUR-APP-URL/api/send-daily?key=YOUR_CRON_SECRET`
   - Schedule: every day at 07:00 (Africa/Lagos time)
3. Save it

That's it — every morning it'll check the day's birthdays and push a
notification to every phone that turned on alerts. (You can also just visit
that URL in a browser to send a test push right now.)

## Step 5 — Install the app on your phone
1. Open your deployed URL in Chrome (Android) or Safari (iPhone)
2. Tap **⬇ Install App** in the top bar (Android/Chrome) — or on iPhone: Share
   button → "Add to Home Screen"
3. Tap **🔔 Enable Alerts** and allow notifications when prompted

Now it behaves like a normal app: icon on your home screen, opens instantly,
works offline for browsing, and sends you a push each morning there's a
birthday.

## Updating the staff list later
Replace `public/data/birthdays.json` with a new export (same field names as
the current file) and redeploy — no code changes needed.

## Notes
- Data stays on your own server; nothing is sent to a third party.
- iPhone push notifications for installed web apps need iOS 16.4+ and the app
  must be added to the home screen first (Safari won't push to a browser tab).
- If you'd rather not run a server yourself, the same `public/` folder works
  fine as a plain installable app with **local** daily reminders instead of
  true push — just ask and I'll add that lighter-weight fallback too.
