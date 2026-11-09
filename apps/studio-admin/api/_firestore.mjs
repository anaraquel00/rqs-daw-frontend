import { getVercelOidcToken } from '@vercel/oidc';
import { ExternalAccountClient } from 'google-auth-library';

const ALLOWED_COLLECTIONS = new Set(['pro_waitlist', 'founding_referral_participants']);
let authClient;

async function defaultCountProvider(collection, field, value) {
  if (!ALLOWED_COLLECTIONS.has(collection)) throw new Error('Firestore collection is not allowed');
  const configuration = firestoreConfiguration();
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

  const accessToken = await firestoreAccessToken(configuration);
  const endpoint = `https://firestore.googleapis.com/v1/projects/${configuration.projectId}/databases/${configuration.databaseId}/documents:runAggregationQuery`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredAggregationQuery: {
        structuredQuery,
        aggregations: [{ alias: 'count', count: {} }],
      },
    }),
  });
  if (!response.ok) throw new Error(`Firestore aggregation failed (${response.status})`);
  const rows = await response.json();
  const encoded = rows.find(row => row.result?.aggregateFields?.count)?.result?.aggregateFields?.count;
  return Number(encoded?.integerValue ?? encoded?.doubleValue ?? 0);
}

let countProvider = defaultCountProvider;

export function countDocuments(collection, field, value) {
  return countProvider(collection, field, value);
}

export function setCountProviderForTests(provider) {
  if (!process.env.NODE_TEST_CONTEXT) throw new Error('Test-only Firestore override');
  countProvider = provider ?? defaultCountProvider;
}

function firestoreConfiguration() {
  const environment = requiredEnvironment('RQS_ADMIN_DATA_ENVIRONMENT');
  const vercelEnvironment = String(process.env.VERCEL_ENV || '').trim().toLowerCase();
  if (!['production', 'staging'].includes(environment)) throw new Error('Unknown admin data environment');
  if (vercelEnvironment === 'production' && environment !== 'production') {
    throw new Error('Production deployment must use production admin data environment');
  }
  if (vercelEnvironment === 'preview' && environment !== 'staging') {
    throw new Error('Preview deployment must use staging admin data environment');
  }

  const databaseId = requiredEnvironment('GCP_FIRESTORE_DATABASE_ID');
  const expectedDatabase = environment === 'production' ? 'rqs-referral-preview' : 'rqs-referral-staging';
  if (databaseId !== expectedDatabase) {
    throw new Error('Configured Firestore database does not match admin data environment');
  }

  const projectNumber = requiredEnvironment('GCP_PROJECT_NUMBER');
  const poolId = requiredEnvironment('GCP_WORKLOAD_IDENTITY_POOL_ID');
  const providerId = requiredEnvironment('GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID');
  const providerResource = `//iam.googleapis.com/projects/${projectNumber}/locations/global/workloadIdentityPools/${poolId}/providers/${providerId}`;
  return {
    projectId: requiredEnvironment('GCP_PROJECT_ID'),
    databaseId,
    serviceAccountEmail: requiredEnvironment('GCP_SERVICE_ACCOUNT_EMAIL'),
    providerResource,
    oidcAudience: `https:${providerResource}`,
  };
}

async function firestoreAccessToken(configuration) {
  authClient ??= ExternalAccountClient.fromJSON({
    type: 'external_account',
    audience: configuration.providerResource,
    subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
    token_url: 'https://sts.googleapis.com/v1/token',
    service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${configuration.serviceAccountEmail}:generateAccessToken`,
    subject_token_supplier: {
      getSubjectToken: () => getVercelOidcToken({ audience: configuration.oidcAudience }),
    },
  });
  if (!authClient) throw new Error('Google external account client unavailable');
  const credentials = await authClient.getAccessToken();
  if (!credentials.token) throw new Error('Google access token unavailable');
  return credentials.token;
}

function requiredEnvironment(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`Missing server environment: ${name}`);
  return value;
}
