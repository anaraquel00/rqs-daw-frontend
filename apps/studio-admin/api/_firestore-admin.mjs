import { requireAdminPreviewEnvironment, requiredEnvironment } from './_firestore-environment.mjs';

export const ADMIN_STAGING_DATABASE_ID = 'rqs-studio-admin-staging';

export function adminFirestoreConfiguration() {
  requireAdminPreviewEnvironment();
  const databaseId = requiredEnvironment('GCP_ADMIN_FIRESTORE_DATABASE_ID');

  if (databaseId !== ADMIN_STAGING_DATABASE_ID) {
    throw new Error('Studio Admin Preview must use the dedicated Admin staging database');
  }

  return { databaseId };
}
