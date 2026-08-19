const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const ALLOWED_CATEGORIES = new Set([
  'support',
  'account',
  'privacy',
  'business',
  'other'
]);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  const {
    name,
    email,
    category,
    message,
    language,
    website
  } = req.body || {};

  // Honeypot: bots commonly fill hidden website fields.
  if (website) {
    return res.status(200).json({ success: true });
  }

  const normalizedName = String(name || '').trim();
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedCategory = String(category || '').trim().toLowerCase();
  const normalizedMessage = String(message || '').trim();
  const normalizedLanguage = ['pt', 'en', 'pl'].includes(language)
    ? language
    : 'en';

  if (
    !normalizedName ||
    !normalizedEmail ||
    !normalizedCategory ||
    !normalizedMessage
  ) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields'
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(normalizedEmail)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid email'
    });
  }

  if (!ALLOWED_CATEGORIES.has(normalizedCategory)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid category'
    });
  }

  if (
    normalizedName.length > 120 ||
    normalizedEmail.length > 254 ||
    normalizedMessage.length > 5000
  ) {
    return res.status(400).json({
      success: false,
      error: 'Input too long'
    });
  }

  const BREVO_KEY = process.env.BREVO_API_KEY;
  const CONTACT_EMAIL = process.env.RQS_CONTACT_EMAIL;
  const SENDER_EMAIL = process.env.RQS_SENDER_EMAIL;

  if (!BREVO_KEY || !CONTACT_EMAIL || !SENDER_EMAIL) {
    console.error('[RQS STUDIO CONTACT] Missing environment configuration');

    return res.status(500).json({
      success: false,
      error: 'Server configuration error'
    });
  }

  const categoryLabels = {
    support: 'Technical Support',
    account: 'Account',
    privacy: 'Privacy / Legal',
    business: 'Business / Partnership',
    other: 'Other'
  };

  const categoryLabel = categoryLabels[normalizedCategory];
  const now = new Date().toISOString();

  try {
    // Reuse the existing RaQuel Synths Firestore contact infrastructure.
    // The source/category fields distinguish Studio messages from portal messages.
    const projectId = 'raquel-synths-platform';
    const firestoreUrl =
      `https://firestore.googleapis.com/v1/projects/${projectId}` +
      `/databases/(default)/documents/mensagens`;

    const firestoreResponse = await fetch(firestoreUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fields: {
          name: { stringValue: normalizedName },
          email: { stringValue: normalizedEmail },
          subject: { stringValue: categoryLabel },
          category: { stringValue: normalizedCategory },
          message: { stringValue: normalizedMessage },
          source: { stringValue: 'studio.raquelsynths.com/contact' },
          language: { stringValue: normalizedLanguage },
          dataEnvio: { timestampValue: now },
          lida: { booleanValue: false }
        }
      })
    });

    if (!firestoreResponse.ok) {
      const firestoreError = await firestoreResponse.text();

      console.error(
        '[RQS STUDIO CONTACT] Firestore error:',
        firestoreError
      );

      return res.status(500).json({
        success: false,
        error: 'Unable to save message'
      });
    }

    const safeName = escapeHtml(normalizedName);
    const safeEmail = escapeHtml(normalizedEmail);
    const safeCategory = escapeHtml(categoryLabel);
    const safeMessage = escapeHtml(normalizedMessage).replace(/\n/g, '<br>');

    const formattedDate =
      new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'America/Recife',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).format(new Date(now)) + ' BRT (UTC-03:00)';

    const htmlContent = `
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RQS Studio Contact</title>
</head>
<body style="margin:0;padding:0;background:#080a0d;font-family:Arial,Helvetica,sans-serif;color:#e9edf2;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"
    style="width:100%;background:#080a0d;padding:32px 12px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"
          style="width:100%;max-width:660px;background:#0d1014;border:1px solid #25303a;border-radius:14px;overflow:hidden;">
          <tr>
            <td style="padding:26px 28px;border-bottom:1px solid #222a32;">
              <div style="color:#35d8e7;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px;">
                RQS STUDIO // CONTACT
              </div>
              <h1 style="margin:0;color:#ffffff;font-size:24px;line-height:1.3;font-weight:700;">
                New Studio message
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px;">
              <div style="margin-bottom:18px;">
                <div style="color:#74808c;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Name</div>
                <div style="color:#ffffff;font-size:16px;margin-top:5px;">${safeName}</div>
              </div>
              <div style="margin-bottom:18px;">
                <div style="color:#74808c;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Email</div>
                <div style="margin-top:5px;">
                  <a href="mailto:${safeEmail}" style="color:#35d8e7;text-decoration:none;">${safeEmail}</a>
                </div>
              </div>
              <div style="margin-bottom:18px;">
                <div style="color:#74808c;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Category</div>
                <div style="color:#ffffff;font-size:16px;margin-top:5px;">${safeCategory}</div>
              </div>
              <div style="margin-bottom:18px;">
                <div style="color:#74808c;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Date</div>
                <div style="color:#aab4bf;font-size:14px;margin-top:5px;">${escapeHtml(formattedDate)}</div>
              </div>
              <div>
                <div style="color:#74808c;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">Message</div>
                <div style="padding:18px;background:#080a0d;border:1px solid #202832;border-left:3px solid #35d8e7;color:#d9dfe6;font-size:15px;line-height:1.7;">
                  ${safeMessage}
                </div>
              </div>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 28px 28px;">
              <a href="mailto:${safeEmail}"
                style="display:inline-block;padding:12px 22px;border:1px solid #35d8e7;color:#35d8e7;text-decoration:none;font-size:13px;font-weight:700;">
                Reply to sender
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px;background:#0a0c10;border-top:1px solid #202832;color:#68737f;font-size:11px;line-height:1.6;">
              Stored through the RQS contact workflow. Source: studio.raquelsynths.com/contact
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const textContent =
`RQS STUDIO // CONTACT

New Studio message

Name: ${normalizedName}
Email: ${normalizedEmail}
Category: ${categoryLabel}
Date: ${formattedDate}

Message:
${normalizedMessage}

Source: studio.raquelsynths.com/contact`;

    const brevoResponse = await fetch(
      'https://api.brevo.com/v3/smtp/email',
      {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'Content-Type': 'application/json',
          'api-key': BREVO_KEY
        },
        body: JSON.stringify({
          sender: {
            name: 'RQS Studio',
            email: SENDER_EMAIL
          },
          to: [
            {
              email: CONTACT_EMAIL,
              name: 'RQS Studio'
            }
          ],
          replyTo: {
            email: normalizedEmail,
            name: normalizedName
          },
          subject: `[RQS Studio] ${categoryLabel}`,
          htmlContent,
          textContent,
          tags: ['rqs-studio-contact']
        })
      }
    );

    if (!brevoResponse.ok) {
      const brevoError = await brevoResponse.text();

      console.error(
        '[RQS STUDIO CONTACT] Brevo error:',
        brevoError
      );

      // Firestore is already the durable source for the message.
      return res.status(200).json({
        success: true,
        notificationSent: false
      });
    }

    const brevoData = await brevoResponse.json();

    return res.status(200).json({
      success: true,
      notificationSent: true,
      messageId: brevoData.messageId || null
    });
  } catch (error) {
    console.error(
      '[RQS STUDIO CONTACT] Unexpected error:',
      error
    );

    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}
