// Email and SMS alerts: a copy of each in-app notification, so students hear about matches,
// offers and approvals without having to open the website.
//
// Both are OFF until configured in server/.env, so the app works the same without them:
//
//   Email (Resend, https://resend.com, free tier):   RESEND_API_KEY=...   EMAIL_FROM="Campus Lost & Found <alerts@yourdomain>"
//   SMS (Africa's Talking, https://africastalking.com): AT_USERNAME=...  AT_API_KEY=...  AT_SENDER_ID= (optional)
//       Use AT_USERNAME=sandbox while testing; messages then appear in the AT simulator, not on phones.
//   SITE_URL=https://your-website   (the link at the end of each alert; default http://localhost:5173)
//
// Students choose on their Profile page whether they want email and/or SMS, and add their phone there.
// Sending never blocks or breaks a request: failures are only logged.
const { pool } = require("./db");

function settings() {
  return {
    resendKey: process.env.RESEND_API_KEY || "",
    emailFrom: process.env.EMAIL_FROM || "",
    resendUrl: process.env.RESEND_URL || "https://api.resend.com/emails",
    atUser: process.env.AT_USERNAME || "",
    atKey: process.env.AT_API_KEY || "",
    atSender: process.env.AT_SENDER_ID || "",
    atUrl:
      process.env.AT_URL ||
      (process.env.AT_USERNAME === "sandbox"
        ? "https://api.sandbox.africastalking.com/version1/messaging"
        : "https://api.africastalking.com/version1/messaging"),
    siteUrl: (process.env.SITE_URL || "http://localhost:5173").replace(/\/+$/, ""),
  };
}

function emailEnabled(s = settings()) {
  return Boolean(s.resendKey && s.emailFrom);
}
function smsEnabled(s = settings()) {
  return Boolean(s.atUser && s.atKey);
}

// Kenyan mobile numbers in any common form -> +2547XXXXXXXX / +2541XXXXXXXX. Returns null if not valid.
function normalizePhone(input) {
  if (input == null) return null;
  const digits = String(input).replace(/[\s()-]/g, "");
  let m = digits.match(/^(?:\+?254|0)([17]\d{8})$/);
  return m ? `+254${m[1]}` : null;
}

async function sendEmail(s, to, subject, text) {
  const res = await fetch(s.resendUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${s.resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: s.emailFrom, to: [to], subject, text }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`email provider answered ${res.status}`);
}

async function sendSms(s, to, text) {
  const body = new URLSearchParams({ username: s.atUser, to, message: text });
  if (s.atSender) body.set("from", s.atSender);
  const res = await fetch(s.atUrl, {
    method: "POST",
    headers: { apiKey: s.atKey, Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`SMS provider answered ${res.status}`);
}

// Send `message` to a student by email and/or SMS, as they chose. Never throws.
async function alertUser(userId, message) {
  const s = settings();
  if (!emailEnabled(s) && !smsEnabled(s)) return; // nothing configured: nothing to do
  try {
    const [[user]] = await pool.query(
      "SELECT full_name, email, phone, alerts_email, alerts_sms FROM users WHERE id = ?",
      [userId]
    );
    if (!user) return;
    const text = `${message}\n\nOpen Campus Lost & Found: ${s.siteUrl}/notifications`;
    const jobs = [];
    if (emailEnabled(s) && user.alerts_email && user.email) {
      jobs.push(sendEmail(s, user.email, "Campus Lost & Found update", `Hi ${user.full_name},\n\n${text}`));
    }
    if (smsEnabled(s) && user.alerts_sms && user.phone) {
      // SMS is short: the message and the link only.
      jobs.push(sendSms(s, user.phone, `${message.slice(0, 300)} ${s.siteUrl}/notifications`));
    }
    const results = await Promise.allSettled(jobs);
    for (const r of results) if (r.status === "rejected") console.error("Alert failed:", r.reason.message);
  } catch (err) {
    console.error("Alert failed:", err.message);
  }
}

// Alerts still being sent (tests wait for these).
const pending = new Set();
function queueAlert(userId, message) {
  const p = alertUser(userId, message).finally(() => pending.delete(p));
  pending.add(p);
}
async function waitForAlerts() {
  await Promise.all([...pending]);
}

module.exports = { alertUser, queueAlert, waitForAlerts, normalizePhone, emailEnabled, smsEnabled };
