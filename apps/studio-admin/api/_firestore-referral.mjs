import {
  adminEnvironmentConfiguration,
  requiredEnvironment,
} from './_firestore-environment.mjs';
import { gcpOidcAccessToken, gcpOidcConfiguration } from './_gcp-oidc.mjs';

const REFERRAL_COLLECTIONS = new Set([
  'pro_waitlist',
  'founding_referral_participants',
]);

export const REFERRAL_STAGING_DATABASE_ID = 'rqs-referral-staging';
export const REFERRAL_PRODUCTION_DATABASE_ID = 'rqs-referral-preview';

export function referralFirestoreConfiguration() {
  const environment = adminEnvironmentConfiguration();
  const databaseId = requiredEnvironment('GCP_REFERRAL_FIRESTORE_DATABASE_ID');

  if (databaseId !== environment.referralDatabaseId) {
    throw new Error(
      `Configured Referral Firestore database does not match ${environment.dataEnvironment} environment`,
    );
  }

  return {
    databaseId,
    dataEnvironment: environment.dataEnvironment,
  };
}

async function defaultReferralCountProvider(collection, field, value) {
  const { databaseId } = referralFirestoreConfiguration();
  const oidc = gcpOidcConfiguration();
  const structuredQuery = { from: [{ collectionId: collection }] };

  if (field !== undefined) {
    structuredQuery.where = {
      fieldFilter: {
        field: { fieldPath: field },
        op: 'EQUAL',
        value: { stringValue: String(value) },
      },
    };
  }

  const accessToken = await gcpOidcAccessToken(oidc);

  const endpoint =
    `https://firestore.googleapis.com/v1/projects/${oidc.projectId}` +
    `/databases/${databaseId}/documents:runAggregationQuery`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      structuredAggregationQuery: {
        structuredQuery,
        aggregations: [{ alias: 'count', count: {} }],
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Referral Firestore aggregation failed (${response.status})`);
  }

  const rows = await response.json();
  const encoded = rows.find(
    row => row.result?.aggregateFields?.count,
  )?.result?.aggregateFields?.count;

  return Number(encoded?.integerValue ?? encoded?.doubleValue ?? 0);
}

let referralCountProvider = defaultReferralCountProvider;

export function countReferralDocuments(collection, field, value) {
  if (!REFERRAL_COLLECTIONS.has(collection)) {
    throw new Error('Referral collection is not allowed');
  }

  return referralCountProvider(collection, field, value);
}

export function setReferralCountProviderForTests(provider) {
  if (!process.env.NODE_TEST_CONTEXT) {
    throw new Error('Test-only Referral Firestore override');
  }

  referralCountProvider = provider ?? defaultReferralCountProvider;
}
