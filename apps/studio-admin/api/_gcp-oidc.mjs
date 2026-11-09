import { getVercelOidcToken } from '@vercel/oidc';
import { ExternalAccountClient } from 'google-auth-library';

let authClient;

export function gcpOidcConfiguration() {
  const projectNumber = requiredEnvironment('GCP_PROJECT_NUMBER');
  const poolId = requiredEnvironment('GCP_WORKLOAD_IDENTITY_POOL_ID');
  const providerId = requiredEnvironment('GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID');
  const providerResource = `//iam.googleapis.com/projects/${projectNumber}/locations/global/workloadIdentityPools/${poolId}/providers/${providerId}`;

  return {
    projectId: requiredEnvironment('GCP_PROJECT_ID'),
    serviceAccountEmail: requiredEnvironment('GCP_SERVICE_ACCOUNT_EMAIL'),
    providerResource,
    oidcAudience: `https:${providerResource}`,
  };
}

export async function gcpOidcAccessToken(configuration = gcpOidcConfiguration()) {
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
