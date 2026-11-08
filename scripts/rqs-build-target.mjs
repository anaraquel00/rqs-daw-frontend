const allowedTargets = new Set(['production', 'staging']);

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function invalidTarget(target) {
  return new Error(
    `Invalid RQS_BUILD_TARGET: ${target}\nAllowed values: production, staging`,
  );
}

export function resolveBuildTarget(env = process.env) {
  const vercelEnvironment = normalize(env.VERCEL_ENV);
  const explicitTarget = normalize(env.RQS_BUILD_TARGET);

  if (vercelEnvironment === 'preview') {
    if (!explicitTarget) {
      return 'staging';
    }

    if (explicitTarget === 'production') {
      throw new Error(
        'RQS BUILD CONTAINMENT ERROR:\n' +
          'Vercel Preview cannot use production build target.\n' +
          'VERCEL_ENV=preview\n' +
          'RQS_BUILD_TARGET=production',
      );
    }

    if (explicitTarget !== 'staging') {
      throw invalidTarget(explicitTarget);
    }

    return 'staging';
  }

  if (vercelEnvironment === 'production') {
    if (!explicitTarget || explicitTarget === 'production') {
      return 'production';
    }

    throw new Error(
      'RQS BUILD CONTAINMENT ERROR:\n' +
        'Vercel Production cannot use a non-production build target.\n' +
        'VERCEL_ENV=production\n' +
        `RQS_BUILD_TARGET=${explicitTarget}`,
    );
  }

  const target = explicitTarget || 'production';
  if (!allowedTargets.has(target)) {
    throw invalidTarget(target);
  }

  return target;
}
