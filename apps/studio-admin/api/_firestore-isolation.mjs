import { adminFirestoreConfiguration } from './_firestore-admin.mjs';
import { referralFirestoreConfiguration } from './_firestore-referral.mjs';

export function assertFirestoreDataIsolation() {
  const admin = adminFirestoreConfiguration();
  const referral = referralFirestoreConfiguration();

  if (admin.databaseId === referral.databaseId) {
    throw new Error('Admin datastore and Referral source must be distinct');
  }

  return { admin, referral };
}
