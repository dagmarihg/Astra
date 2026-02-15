const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const config = require('../config');

// Configure transporter if SMTP env present, otherwise use a noop logger that writes to /tmp
let transporter = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
} else {
  // fallback: simple file logger
  transporter = {
    sendMail: async (mailOptions) => {
      const outDir = process.env.EMAIL_LOG_DIR || '/tmp/astra-emails';
      try { fs.mkdirSync(outDir, { recursive: true }); } catch (e) {}
      const filename = path.join(outDir, `email-${Date.now()}.json`);
      fs.writeFileSync(filename, JSON.stringify(mailOptions, null, 2));
      console.log('[MAILER] Saved email to', filename);
      return { accepted: [mailOptions.to] };
    }
  };
}

const FROM_EMAIL = process.env.FROM_EMAIL || `no-reply@${process.env.HOSTNAME || 'astra.local'}`;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || process.env.FROM_EMAIL || null;

async function sendMail(to, subject, html, text) {
  const mailOptions = {
    from: FROM_EMAIL,
    to,
    subject,
    html,
    text,
  };
  try {
    const info = await transporter.sendMail(mailOptions);
    return info;
  } catch (err) {
    console.error('[MAILER_ERROR]', err.message);
    return null;
  }
}

async function notifyAdmins(subject, html, text) {
  if (!ADMIN_EMAIL) {
    console.warn('[MAILER] No ADMIN_EMAIL set, skipping admin notification');
    return;
  }
  return sendMail(ADMIN_EMAIL, subject, html, text);
}

module.exports = { sendMail, notifyAdmins };
