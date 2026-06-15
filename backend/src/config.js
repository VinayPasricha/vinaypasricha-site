// Central config, read once from the environment.
// Firestore needs no connection string or secret — on Cloud Run the project and
// credentials are detected automatically. So there is very little to configure.
import 'dotenv/config';

function optional(name, fallback) {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : fallback;
}

export const config = {
  // Cloud Run sets PORT (usually 8080). Default 8080 for local parity.
  port: parseInt(optional('PORT', '8080'), 10),

  // Comma-separated website origins allowed to call this API. Same-origin
  // (the deployed site) needs no entry; this is for local/dev cross-origin.
  allowedOrigins: optional('ALLOWED_ORIGINS', '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  // How long a conversation is kept. A Firestore TTL policy on `expiresAt`
  // does the actual deleting (configured once on the database).
  conversationTtlDays: parseInt(optional('CONVERSATION_TTL_DAYS', '30'), 10),
};
