import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';

admin.initializeApp();

// Runs every Sunday at 2:00 AM UTC
export const weeklyFirestoreBackup = onSchedule('every sunday 02:00', async () => {
  const client = new (require('@google-cloud/firestore').v1.FirestoreAdminClient)();
  const projectId = process.env.GCLOUD_PROJECT ?? admin.app().options.projectId!;
  const databaseName = client.databasePath(projectId, '(default)');

  const collections = ['recipes', 'gallery', 'trivia', 'contributors', 'history', 'config', 'userPrefs', 'triviaScores', 'recipe_versions', 'fcm_tokens', 'analytics_events'];
  const outputUri = `gs://${projectId}.firebasestorage.app/backups/${new Date().toISOString().slice(0, 10)}`;

  await client.exportDocuments({
    name: databaseName,
    outputUriPrefix: outputUri,
    collectionIds: collections,
  });

  console.log(`Backup completed to ${outputUri}`);
});
