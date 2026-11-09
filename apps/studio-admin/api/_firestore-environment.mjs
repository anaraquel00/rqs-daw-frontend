export const ADMIN_ENVIRONMENT_CONTRACTS = Object.freeze({
  staging: Object.freeze({
    vercelEnvironment: 'preview',
    adminDatabaseId: 'rqs-studio-admin-staging',
    referralDatabaseId: 'rqs-referral-staging',
    gcpProjectId: 'raquel-synths-platform',
    gcpProjectNumber: '913434953773',
    gcpPoolId: 'rqs-vercel-preview',
    gcpProviderId: 'rqs-studio-admin-preview',
    gcpServiceAccountEmail:
      'rqs-studio-admin-preview@raquel-synths-platform.iam.gserviceaccount.com',
  }),
  production: Object.freeze({
    vercelEnvironment: 'production',
    adminDatabaseId: 'rqs-studio-admin-prod',
    referralDatabaseId: 'rqs-referral-preview',
    gcpProjectId: 'raquel-synths-platform',
    gcpProjectNumber: '913434953773',
    gcpPoolId: 'rqs-vercel-production',
    gcpProviderId: 'rqs-studio-admin-production',
    gcpServiceAccountEmail:
      'rqs-studio-admin-prod@raquel-synths-platform.iam.gserviceaccount.com',
  }),
});

export function adminEnvironmentConfiguration() {
  const vercelEnvironment = requiredEnvironment('VERCEL_ENV').toLowerCase();
  const dataEnvironment = requiredEnvironment('RQS_ADMIN_DATA_ENVIRONMENT').toLowerCase();
  const expected = ADMIN_ENVIRONMENT_CONTRACTS[dataEnvironment];

  if (!expected) {
    throw new Error('Unknown Studio Admin data environment');
  }

  if (vercelEnvironment !== expected.vercelEnvironment) {
    throw new Error(
      `Studio Admin Vercel environment does not match ${dataEnvironment} data environment`,
    );
  }

  return Object.freeze({
    vercelEnvironment,
    dataEnvironment,
    ...expected,
  });
}

// Compatibility alias for callers/tests that still import the old function name.
// It now enforces the complete two-environment contract rather than Preview only.
export function requireAdminPreviewEnvironment() {
  return adminEnvironmentConfiguration();
}

export function requiredEnvironment(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`Missing server environment: ${name}`);
  return value;
}
