import {
  adminEnvironmentConfiguration,
  requiredEnvironment,
} from './_firestore-environment.mjs';

export const ADMIN_STAGING_DATABASE_ID = 'rqs-studio-admin-staging';
export const ADMIN_PRODUCTION_DATABASE_ID = 'rqs-studio-admin-prod';

export function adminFirestoreConfiguration() {
  const environment = adminEnvironmentConfiguration();
  const databaseId = requiredEnvironment('GCP_ADMIN_FIRESTORE_DATABASE_ID');

  if (databaseId !== environment.adminDatabaseId) {
    throw new Error(
      `Configured Admin Firestore database does not match ${environment.dataEnvironment} environment`,
    );
  }

  return {
    databaseId,
    dataEnvironment: environment.dataEnvironment,
  };
}
