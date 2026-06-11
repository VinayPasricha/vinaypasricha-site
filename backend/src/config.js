// Central place that reads environment variables once and validates them.
import 'dotenv/config';

function required(name) {
  const v = process.env[name];
  if (!v || !v.trim()) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
      `Copy backend/.env.example to backend/.env and fill it in.`
    );
  }
  return v.trim();
}

function optional(name, fallback) {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : fallback;
}

export const config = {
  // We don't call required() at import time so the test simulation can run
  // with an in-memory database when MONGODB_URI is absent.
  mongoUri: optional('MONGODB_URI', ''),
  mongoDb: optional('MONGODB_DB', 'vinay'),
  googleClientId: optional('GOOGLE_CLIENT_ID', ''),
  port: parseInt(optional('PORT', '4000'), 10),
  allowedOrigins: optional('ALLOWED_ORIGINS', 'http://localhost:4000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  conversationTtlDays: parseInt(optional('CONVERSATION_TTL_DAYS', '30'), 10),
};

// Helper used by the live server (not the test) to fail loudly if real
// credentials are missing.
export function assertProductionConfig() {
  if (!config.mongoUri) required('MONGODB_URI');
  if (!config.googleClientId) required('GOOGLE_CLIENT_ID');
}
