#!/usr/bin/env node
/*
  Usage:
    node scripts/archive-converted.js --dry-run
    node scripts/archive-converted.js     # runs for real (be careful)

  What it does:
  - Finds teams where status === 'converted'
  - For each team, fetches its participants, writes a document into 'archived_teams' with the team data and participants
  - Deletes original team doc and leaves participants in place (or moves them? this script will include participants array in the archive but not delete participants)

  This is safer than immediate deletion. The script supports --dry-run to show what would happen.
*/

const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config();

const DRY = process.argv.includes('--dry-run');

async function main() {
  // initialize firebase using existing project credentials (same as server/firebase.js)
  const credsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credsPath) {
    console.error('GOOGLE_APPLICATION_CREDENTIALS not set. Aborting.');
    process.exit(2);
  }

  admin.initializeApp({
    credential: admin.credential.cert(require(path.resolve(credsPath)))
  });

  const db = admin.firestore();

  console.log(`Connected to Firestore. Dry run: ${DRY}`);

  const teamsRef = db.collection('teams');
  const participantsRef = db.collection('participants');
  const archiveRef = db.collection('archived_teams');

  const snapshot = await teamsRef.where('status', '==', 'converted').get();
  console.log(`Found ${snapshot.size} converted teams.`);

  if (snapshot.empty) {
    console.log('Nothing to archive.');
    return;
  }

  for (const doc of snapshot.docs) {
    const teamData = doc.data();
    const teamId = doc.id;

    const participantsSnap = await participantsRef.where('teamId', '==', teamId).get();
    const participants = participantsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const archiveDoc = {
      originalTeamId: teamId,
      team: teamData,
      participants,
      archivedAt: new Date().toISOString(),
      archivedBy: process.env.ARCHIVE_USER || 'script'
    };

    console.log(`Archiving team ${teamId} (${teamData.name || ''}) with ${participants.length} participants.`);

    if (DRY) continue;

    const writeRes = await archiveRef.add(archiveDoc);
    console.log(`Wrote archive document ${writeRes.id}`);

    // safe deletion: delete the team doc but keep participants in case you want to re-link
    await teamsRef.doc(teamId).delete();
    console.log(`Deleted original team ${teamId}`);
  }

  console.log('Archive pass complete.');
}

main().catch((err) => {
  console.error('Migration error:', err);
  process.exit(10);
});
