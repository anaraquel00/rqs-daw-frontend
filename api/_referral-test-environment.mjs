const PROJECT_ID = 'raquel-synths-platform';
const PROJECT_NUMBER = '913434953773';
const POOL_ID = 'rqs-vercel-referral-tests';

const TEST_ENVIRONMENTS = Object.freeze({
  production: Object.freeze({
    databaseId: 'rqs-referral-preview',
    providerId: 'rqs-referral-preview',
    serviceAccountEmail: 'rqs-referral-preview@raquel-synths-platform.iam.gserviceaccount.com',
    vercelEnvironment: 'production',
    vercelTarget: 'production',
  }),
  staging: Object.freeze({
    databaseId: 'rqs-referral-staging',
    providerId: 'rqs-referral-staging',
    serviceAccountEmail: 'rqs-referral-staging@raquel-synths-platform.iam.gserviceaccount.com',
    vercelEnvironment: 'preview',
    vercelTarget: 'staging',
  }),
});

export function configureReferralTestEnvironment(environment = 'production') {
  const configuration = TEST_ENVIRONMENTS[environment];
  if (!configuration) throw new Error(`Unknown test environment: ${environment}`);
  const providerResource = `//iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/providers/${configuration.providerId}`;
  Object.assign(process.env, {
    RQS_DATA_ENVIRONMENT: environment,
    VERCEL_ENV: configuration.vercelEnvironment,
    VERCEL_TARGET_ENV: configuration.vercelTarget,
    GCP_PROJECT_ID: PROJECT_ID,
    GCP_PROJECT_NUMBER: PROJECT_NUMBER,
    GCP_WORKLOAD_IDENTITY_POOL_ID: POOL_ID,
    GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID: configuration.providerId,
    GCP_SERVICE_ACCOUNT_EMAIL: configuration.serviceAccountEmail,
    GCP_FIRESTORE_DATABASE_ID: configuration.databaseId,
    GCP_AUDIENCE: `https:${providerResource}`,
  });
}
