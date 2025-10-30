// Server for Prashant Sir Portfolio
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const dotenv = require('dotenv');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const twilio = require('twilio');

dotenv.config();

const app = express();
let PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Data dir for fallbacks
const dataDir = path.join(__dirname, 'data');
const counterFile = path.join(dataDir, 'visitors.json');
const notesFile = path.join(dataDir, 'notes.json');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(counterFile)) fs.writeFileSync(counterFile, JSON.stringify({ count: 0 }, null, 2));
if (!fs.existsSync(notesFile)) fs.writeFileSync(notesFile, JSON.stringify([], null, 2));

// MongoDB connection (optional)
let dbEnabled = false;
(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) return;
  try {
    await mongoose.connect(uri, { dbName: process.env.MONGODB_DB || undefined });
    dbEnabled = true;
    console.log('MongoDB connected');
  } catch (e) {
    console.warn('MongoDB connection failed, falling back to JSON storage.');
    dbEnabled = false;
  }
})();

// Schemas
let Contact, VisitorCounter, Note;
try {
  const contactSchema = new mongoose.Schema({
    name: String,
    email: String,
    phone: String,
    message: String,
  }, { timestamps: { createdAt: true, updatedAt: false } });
  const visitorSchema = new mongoose.Schema({
    _id: { type: String, default: 'global' },
    count: { type: Number, default: 0 },
  }, { timestamps: false });
  const noteSchema = new mongoose.Schema({
    subject: String,
    title: String,
    link: String,
    sizeMB: Number,
  }, { timestamps: { createdAt: true, updatedAt: false } });
  Contact = mongoose.models.Contact || mongoose.model('Contact', contactSchema);
  VisitorCounter = mongoose.models.VisitorCounter || mongoose.model('VisitorCounter', visitorSchema);
  Note = mongoose.models.Note || mongoose.model('Note', noteSchema);
} catch (e) {}

// Helpers for visitor count fallback
function readCount() {
  try { return JSON.parse(fs.readFileSync(counterFile, 'utf8')).count || 0; }
  catch { return 0; }
}
function writeCount(n) {
  fs.writeFileSync(counterFile, JSON.stringify({ count: n }, null, 2));
}

// Visitor endpoint
app.get('/api/visitors', async (req, res) => {
  try {
    if (dbEnabled && VisitorCounter) {
      const doc = await VisitorCounter.findOneAndUpdate(
        { _id: 'global' },
        { $inc: { count: 1 } },
        { new: true, upsert: true }
      );
      return res.json({ count: doc.count });
    }
    const current = readCount() + 1;
    writeCount(current);
    res.json({ count: current });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update counter' });
  }
});

// Notes endpoint (read-only)
app.get('/api/notes', async (req, res) => {
  try {
    if (dbEnabled && Note) {
      const notes = await Note.find({}).sort({ createdAt: -1 }).lean();
      return res.json({ notes });
    }
    const arr = JSON.parse(fs.readFileSync(notesFile, 'utf8'));
    res.json({ notes: Array.isArray(arr) ? arr : [] });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

// Contact endpoint
app.post('/api/contact', async (req, res) => {
  const { name, email, phone, message } = req.body || {};
  if (!name || !email || !phone || !message) {
    return res.status(400).json({ ok: false, error: 'Missing fields' });
  }

  // Persist submission
  try {
    if (dbEnabled && Contact) {
      await Contact.create({ name, email, phone, message });
    }
  } catch (e) {
    console.warn('Failed to write contact to DB, continuing...');
  }

  // Email setup
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, RECIPIENT_EMAIL, FROM_EMAIL } = process.env;
  let mailOk = false, mailErr;
  if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS && RECIPIENT_EMAIL) {
    try {
      const transport = nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT) || 587,
        secure: Number(SMTP_PORT) === 465,
        auth: { user: SMTP_USER, pass: SMTP_PASS }
      });
      // Email to admin
      await transport.sendMail({
        from: FROM_EMAIL || SMTP_USER,
        to: RECIPIENT_EMAIL,
        subject: `New contact from ${name}`,
        replyTo: email,
        text: `Name: ${name}\nEmail: ${email}\nPhone: ${phone}\n\n${message}`,
      });
      // Confirmation email to visitor
      await transport.sendMail({
        from: FROM_EMAIL || SMTP_USER,
        to: email,
        subject: 'Thanks for contacting Prashant Sir',
        text: `Hello ${name},\n\nThank you for reaching out! Prashant Sir will contact you soon.\n\nYour message:\n${message}\n\nRegards,\nPrashant Sir`
      });
      mailOk = true;
    } catch (err) {
      mailErr = err;
      console.error('Email error:', err?.message || err);
    }
  }

  // WhatsApp via Twilio (optional)
  let waOk = false;
  try {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_WHATSAPP_FROM; // e.g. 'whatsapp:+14155238886'
    const defaultCc = process.env.TWILIO_DEFAULT_COUNTRY_CODE || '+91';
    if (sid && token && from) {
      const client = twilio(sid, token);
      const toDigits = (phone || '').replace(/[^\d+]/g, '');
      const toE164 = toDigits.startsWith('+') ? toDigits : (defaultCc + toDigits);
      await client.messages.create({
        from,
        to: `whatsapp:${toE164}`,
        body: `Hello ${name}, thank you for contacting Prashant Sir! He will reach out to you soon.`
      });
      waOk = true;
    }
  } catch (err) {
    console.error('WhatsApp error:', err?.message || err);
  }

  if (!mailOk && !waOk) {
    return res.status(200).json({ ok: true, note: 'Saved. Email/WhatsApp not configured.' });
  }
  res.json({ ok: true });
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Function to find and use an available port
function startServer(port) {
  const server = app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`Port ${port} is already in use. Trying port ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('Server error:', err);
      process.exit(1);
    }
  });
}

startServer(PORT);
