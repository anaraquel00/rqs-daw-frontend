import { authorizeStudioAdmin } from '../_admin-auth.mjs';
import { applyCors } from '../_referral-http.mjs';

export default async function handler(req, res) {
  if (!applyCors(req, res, 'GET, OPTIONS')) {
    return res.status(403).json({ success: false, error: 'Origin not allowed' });
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed' });

  try {
    const admin = await authorizeStudioAdmin(req);
    if (!admin) return res.status(403).json({ success: false, admin: false, error: 'Admin authorization required' });
    return res.status(200).json({ success: true, admin: true, role: admin.role });
  } catch (error) {
    console.error('[RQS ADMIN SESSION]', error instanceof Error ? error.message : error);
    return res.status(500).json({ success: false, admin: false, error: 'Unable to validate admin session' });
  }
}
