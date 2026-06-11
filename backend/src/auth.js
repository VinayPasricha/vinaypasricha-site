// Google Sign-In token verification + an Express middleware that protects routes.
import { OAuth2Client } from 'google-auth-library';
import { config } from './config.js';
import { upsertUser } from './services/users.js';

const client = new OAuth2Client(config.googleClientId);

// Verify the ID token the browser received from Google, and return a profile.
// Throws if the token is missing, expired, or not issued for our app.
export async function verifyGoogleIdToken(idToken) {
  if (!idToken) throw new Error('No Google credential provided');
  const ticket = await client.verifyIdToken({
    idToken,
    audience: config.googleClientId,
  });
  const payload = ticket.getPayload();
  if (!payload || !payload.sub) throw new Error('Invalid Google token');
  return {
    googleId: payload.sub,
    email: payload.email || '',
    name: payload.name || '',
    picture: payload.picture || '',
    emailVerified: !!payload.email_verified,
  };
}

// Express middleware: requires a valid "Authorization: Bearer <id_token>" header.
// On success, sets req.user = { googleId, email, name, ... }.
export async function requireAuth(req, res, next) {
  try {
    const header = req.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const profile = await verifyGoogleIdToken(token);
    // Keep the user record fresh on every authenticated request.
    await upsertUser(profile);
    req.user = profile;
    next();
  } catch (err) {
    res.status(401).json({ error: 'unauthorized', detail: 'Sign in with Google to continue.' });
  }
}
