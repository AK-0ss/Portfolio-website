require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB;
  if (!uri) {
    console.error('ERR: MONGODB_URI is not set');
    process.exit(2);
  }
  try {
    const conn = await mongoose.connect(uri, { dbName });
    // Run a ping command to confirm connectivity
    await conn.connection.db.admin().ping();
    console.log(`OK: Connected to MongoDB at ${uri} db=${dbName || '(default)'}`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (e) {
    console.error('ERR:', e && e.message ? e.message : e);
    try { await mongoose.disconnect(); } catch {}
    process.exit(1);
  }
})();
