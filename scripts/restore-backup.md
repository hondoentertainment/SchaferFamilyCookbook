# Firestore Backup Restore Runbook

## Where backups are stored

Backups are written to Google Cloud Storage by the `weeklyFirestoreBackup` Cloud Function every Sunday at 2:00 AM UTC.

GCS path pattern: `gs://PROJECT_ID.firebasestorage.app/backups/YYYY-MM-DD/`

## List available backups

```bash
gcloud storage ls gs://PROJECT_ID.firebasestorage.app/backups/
```

## Restore a full backup

```bash
gcloud firestore import gs://PROJECT_ID.firebasestorage.app/backups/YYYY-MM-DD
```

## Restore specific collections only

```bash
gcloud firestore import gs://PROJECT_ID.firebasestorage.app/backups/YYYY-MM-DD \
  --collection-ids=recipes,gallery,trivia
```

## WARNING

Restoring a backup **overwrites existing Firestore data** for the imported collections.
Any writes made after the backup date will be lost. Coordinate with the team before
running a restore in production.
