import { createHash } from 'node:crypto';

export default async function handler(req, res) {

  // =================================================
  // 1. CORS
  // =================================================

  const allowedOrigins = [
    'https://studio.raquelsynths.com',
    'https://raquelsynths.com',
    'https://www.raquelsynths.com'
  ];

  const origin = req.headers.origin;

  if (
    origin &&
    allowedOrigins.includes(origin)
  ) {
    res.setHeader(
      'Access-Control-Allow-Origin',
      origin
    );

    res.setHeader(
      'Vary',
      'Origin'
    );
  }

  res.setHeader(
    'Access-Control-Allow-Methods',
    'POST, OPTIONS'
  );

  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type'
  );

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  // =================================================
  // 2. BODY
  // =================================================

  const {
    email,
    source,
    language,
    website
  } = req.body || {};

  // =================================================
  // 3. HONEYPOT
  // =================================================

  if (website) {
    return res.status(200).json({
      success: true
    });
  }

  // =================================================
  // 4. VALIDAÇÃO
  // =================================================

  if (!email) {
    return res.status(400).json({
      success: false,
      error: 'Email is required'
    });
  }

  const normalizedEmail =
    String(email)
      .trim()
      .toLowerCase();

  const emailRegex =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(normalizedEmail)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid email'
    });
  }

  // =================================================
  // 5. NORMALIZAÇÃO
  // =================================================

  const normalizedSource =
    source
      ? String(source).trim()
      : 'studio.raquelsynths.com';

  const normalizedLanguage =
    language === 'en'
      ? 'en'
      : 'pt';

  const now =
    new Date().toISOString();

  // =================================================
  // 6. CONFIGURAÇÃO
  // =================================================

  const projectId =
    'raquel-synths-platform';

  const BREVO_KEY =
    process.env.BREVO_API_KEY;

  const BREVO_WAITLIST_LIST_ID =
    Number(
      process.env.BREVO_WAITLIST_LIST_ID
    );

  if (
    !BREVO_KEY ||
    !Number.isInteger(BREVO_WAITLIST_LIST_ID) ||
    BREVO_WAITLIST_LIST_ID <= 0
  ) {
    console.error(
      '[RQS PRO WAITLIST] Missing Brevo configuration'
    );

    return res.status(500).json({
      success: false,
      error: 'Server configuration error'
    });
  }

  // =================================================
  // 7. ID DETERMINÍSTICO
  // =================================================

  const waitlistId =
    createHash('sha256')
      .update(normalizedEmail)
      .digest('hex');

  const firestoreUrl =
    `https://firestore.googleapis.com/v1/projects/` +
    `${projectId}/databases/(default)/documents/` +
    `pro_waitlist?documentId=${waitlistId}`;

  try {

    // =================================================
    // 8. FIRESTORE
    // =================================================

    const firestoreResponse =
      await fetch(
        firestoreUrl,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json'
          },

          body: JSON.stringify({
            fields: {

              email: {
                stringValue:
                  normalizedEmail
              },

              source: {
                stringValue:
                  normalizedSource
              },

              language: {
                stringValue:
                  normalizedLanguage
              },

              status: {
                stringValue:
                  'waiting'
              },

              createdAt: {
                timestampValue:
                  now
              }
            }
          })
        }
      );

    const alreadyJoined =
      firestoreResponse.status === 409;

    if (
      !firestoreResponse.ok &&
      !alreadyJoined
    ) {

      const firestoreError =
        await firestoreResponse.text();

      console.error(
        '[RQS PRO WAITLIST] Firestore error:',
        firestoreError
      );

      return res.status(500).json({
        success: false,
        error: 'Unable to join waitlist'
      });
    }

    // =================================================
    // 9. BREVO
    // =================================================

    const brevoResponse =
      await fetch(
        'https://api.brevo.com/v3/contacts',
        {
          method: 'POST',

          headers: {
            accept:
              'application/json',

            'Content-Type':
              'application/json',

            'api-key':
              BREVO_KEY
          },

          body: JSON.stringify({
          email: normalizedEmail,

          attributes: {
            RQS_LANGUAGE: normalizedLanguage
          },

          listIds: [
            BREVO_WAITLIST_LIST_ID
          ],

          updateEnabled: true
        })
        }
      );

    if (!brevoResponse.ok) {

      const brevoError =
        await brevoResponse.text();

      console.error(
        '[RQS PRO WAITLIST] Brevo error:',
        brevoError
      );

      return res.status(500).json({
        success: false,
        error:
          'Unable to subscribe to launch notifications'
      });
    }

    // =================================================
    // 10. SUCESSO
    // =================================================

    return res.status(200).json({
      success: true,
      waitlisted: true,
      alreadyJoined
    });

  } catch (error) {

    console.error(
      '[RQS PRO WAITLIST] Unexpected error:',
      error
    );

    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}
