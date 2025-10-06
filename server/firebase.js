const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

function loadServiceAccount() {
  const inline = process.env.FIREBASE_CREDENTIALS;
  const pathEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_CREDENTIALS;

  if (inline && inline.trim().startsWith('{')) {
    // FIREBASE_CREDENTIALS contains JSON text directly (convenient for serverless envs)
    try {
      return JSON.parse(inline);
    } catch (err) {
      throw new Error('FIREBASE_CREDENTIALS contains invalid JSON: ' + err.message);
    }
  }

  if (!pathEnv) {
    throw new Error('Missing GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_CREDENTIALS env variable for Firebase admin SDK.');
  }

  const resolved = path.isAbsolute(pathEnv) ? pathEnv : path.join(__dirname, '..', pathEnv);
  const serviceAccountRaw = fs.readFileSync(resolved, 'utf8');
  return JSON.parse(serviceAccountRaw);
}

if (!admin.apps.length) {
  try {
    const serviceAccount = loadServiceAccount();
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (err) {
    // If credentials missing or unreadable, log and export nulls. In production the
    // server will fail fast during startup (see server/index.js).
    console.warn('Firebase admin SDK not initialized:', err.message);
    module.exports = { admin: null, db: null };
    return;
  }
}

const db = admin.firestore();

module.exports = {
  admin,
  db
};
