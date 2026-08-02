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

  // Secret guarding the admin read endpoints (listing/reading stored
  // conversations, which contain visitor PII). Sent as the `x-admin-token`
  // header or `?token=`. If empty, those endpoints are CLOSED (fail-safe),
  // never open. Set ADMIN_TOKEN on Cloud Run.
  adminToken: optional('ADMIN_TOKEN', ''),

  // Passwordless participant access. In production set ABL_AUTH_SECRET to a
  // long random value and provide a Resend key/from-address for delivery.
  // ADMIN_TOKEN is retained as a backwards-compatible signing fallback so an
  // existing Cloud Run service can enable the feature without a migration.
  ablAuthSecret: optional('ABL_AUTH_SECRET', optional('ADMIN_TOKEN', '')),
  resendApiKey: optional('RESEND_API_KEY', ''),
  ablFromEmail: optional('ABL_FROM_EMAIL', 'AI for Business Leaders <course@vinaypasricha.com>'),

  // Book Growth Command Centre. Search Console uses the Cloud Run service
  // account, which must be added as a user of the configured property.
  growthSearchConsoleSite: optional('GROWTH_SEARCH_CONSOLE_SITE', ''),
  growthVinayEmail: optional('GROWTH_VINAY_EMAIL', 'vinay@goodspace.ai'),
  growthVaishnavEmail: optional('GROWTH_VAISHNAV_EMAIL', 'vaishnav@goodspace.ai'),
  growthFromEmail: optional('GROWTH_FROM_EMAIL', optional('ABL_FROM_EMAIL', 'Vinay Pasricha Growth <growth@vinaypasricha.com>')),

  // Preferred Slack delivery is a private DM through a Slack app/bot token.
  // A single incoming webhook remains available as a simpler channel fallback.
  growthSlackBotToken: optional('GROWTH_SLACK_BOT_TOKEN', ''),
  growthVinaySlackUserId: optional('GROWTH_VINAY_SLACK_USER_ID', 'U0AN6TZ2H6Y'),
  growthVaishnavSlackUserId: optional('GROWTH_VAISHNAV_SLACK_USER_ID', 'U093Z2F5ETH'),
  growthSlackWebhookUrl: optional('GROWTH_SLACK_WEBHOOK_URL', ''),

  growthCronSecret: optional('GROWTH_CRON_SECRET', ''),
  growthTimezone: optional('GROWTH_TIMEZONE', 'Asia/Kolkata'),
};
