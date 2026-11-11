import { getVercelOidcToken } from '@vercel/oidc';
import { IdentityPoolClient } from 'google-auth-library';
import {
  adminEnvironmentConfiguration,
  requiredEnvironment,
} from './_firestore-environment.mjs';

let authClient;
let authClientSignature = '';

export function gcpOidcConfiguration() {
  const environment = adminEnvironmentConfiguration();

  const projectId = requiredEnvironment('GCP_PROJECT_ID');
  const projectNumber = requiredEnvironment('GCP_PROJECT_NUMBER');
  const poolId = requiredEnvironment('GCP_WORKLOAD_IDENTITY_POOL_ID');
  const providerId = requiredEnvironment('GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID');
  const serviceAccountEmail = requiredEnvironment('GCP_SERVICE_ACCOUNT_EMAIL');

  if (projectId !== environment.gcpProjectId) {
    throw new Error(
      `Configured GCP project does not match ${environment.dataEnvironment} environment`,
    );
  }

  if (projectNumber !== environment.gcpProjectNumber) {
    throw new Error(
      `Configured GCP project number does not match ${environment.dataEnvironment} environment`,
    );
  }

  if (poolId !== environment.gcpPoolId) {
    throw new Error(
      `Configured GCP workload identity pool does not match ${environment.dataEnvironment} environment`,
    );
  }

  if (providerId !== environment.gcpProviderId) {
    throw new Error(
      `Configured GCP workload identity provider does not match ${environment.dataEnvironment} environment`,
    );
  }

  if (serviceAccountEmail !== environment.gcpServiceAccountEmail) {
    throw new Error(
      `Configured GCP service account does not match ${environment.dataEnvironment} environment`,
    );
  }

  const providerResource =
    `//iam.googleapis.com/projects/${projectNumber}` +
    `/locations/global/workloadIdentityPools/${poolId}` +
    `/providers/${providerId}`;

  return Object.freeze({
    dataEnvironment: environment.dataEnvironment,
    projectId,
    projectNumber,
    poolId,
    providerId,
    serviceAccountEmail,
    providerResource,
    oidcAudience: `https:${providerResource}`,
  });
}

export async function gcpOidcAccessToken(
  configuration = gcpOidcConfiguration(),
) {
  const signature = [
    configuration.dataEnvironment,
    configuration.providerResource,
    configuration.serviceAccountEmail,
  ].join('|');

  if (!authClient || authClientSignature !== signature) {
    authClient = new IdentityPoolClient({
      audience: configuration.providerResource,
      subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
      token_url: 'https://sts.googleapis.com/v1/token',
      service_account_impersonation_url:
        `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/` +
        `${configuration.serviceAccountEmail}:generateAccessToken`,
      subject_token_supplier: {
        getSubjectToken: () =>
          getVercelOidcToken({ audience: configuration.oidcAudience }),
      },
    });

    authClientSignature = signature;
  }

  if (!authClient) {
    throw new Error('Google external account client unavailable');
  }

  const credentials = await authClient.getAccessToken();

  if (!credentials.token) {
    throw new Error('Google access token unavailable');
  }

  return credentials.token;
}
