export function requireAdminPreviewEnvironment() {
  const vercelEnvironment = requiredEnvironment('VERCEL_ENV').toLowerCase();
  const dataEnvironment = requiredEnvironment('RQS_ADMIN_DATA_ENVIRONMENT').toLowerCase();

  if (vercelEnvironment !== 'preview') {
    throw new Error('Studio Admin Phase 1 data access is restricted to Vercel Preview');
  }
  if (dataEnvironment !== 'staging') {
    throw new Error('Studio Admin Preview must use the staging data environment');
  }

  return { vercelEnvironment, dataEnvironment };
}

export function requiredEnvironment(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`Missing server environment: ${name}`);
  return value;
}
