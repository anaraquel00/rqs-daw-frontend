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

  // Preflight do navegador
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Somente POST
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
  // 3. HONEYPOT ANTI-BOT
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

  if (
    !emailRegex.test(
      normalizedEmail
    )
  ) {
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
  // 6. FIRESTORE
  // =================================================

  const projectId =
    'raquel-synths-platform';

  /*
   * Gera um ID determinístico a partir do e-mail.
   *
   * Resultado:
   * mesmo e-mail = mesmo documento.
   *
   * SHA-256 também evita deixar o e-mail
   * diretamente visível no ID do documento.
   */
  const waitlistId =
    createHash('sha256')
      .update(normalizedEmail)
      .digest('hex');


  /*
   * POST com documentId.
   *
   * Diferente de PATCH:
   * se o documento já existir,
   * o Firestore retorna conflito.
   *
   * Assim preservamos createdAt original.
   */
  const firestoreUrl =
    `https://firestore.googleapis.com/v1/projects/` +
    `${projectId}/databases/(default)/documents/` +
    `pro_waitlist?documentId=${waitlistId}`;


  try {

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


    // =================================================
    // 7. JÁ ESTÁ NA LISTA
    // =================================================

    /*
     * Mesmo e-mail tenta cadastrar novamente.
     *
     * Não tratamos isso como erro para o usuário.
     */
    if (
      firestoreResponse.status === 409
    ) {
      return res.status(200).json({
        success: true,
        waitlisted: true,
        alreadyJoined: true
      });
    }

    const BREVO_KEY =
      process.env.BREVO_API_KEY;

    const BREVO_WAITLIST_LIST_ID =
      Number(
        process.env.BREVO_WAITLIST_LIST_ID
      );
    // =================================================
    // 8. ERRO FIRESTORE
    // =================================================

    if (
      !firestoreResponse.ok
    ) {

      const firestoreError =
        await firestoreResponse.text();

      console.error(
        '[RQS PRO WAITLIST] Firestore error:',
        firestoreError
      );

      return res.status(500).json({
        success: false,
        error:
          'Unable to join waitlist'
      });
    }


    // =================================================
    // 9. SUCESSO
    // =================================================

    return res.status(200).json({
      success: true,
      waitlisted: true,
      alreadyJoined: false
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

