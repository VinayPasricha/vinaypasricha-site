// Business logic for the SIV runtime's conversation storage.
// Both the HTTP routes and the test simulation call these functions, so the
// simulation exercises the exact same code path real users hit.
import { SivConversation } from '../models/SivConversation.js';

function cleanMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((m) => m && typeof m.content === 'string' && m.content.trim())
    .map((m) => ({
      role: ['user', 'assistant', 'system'].includes(m.role) ? m.role : 'user',
      content: String(m.content),
      at: m.at ? new Date(m.at) : new Date(),
    }));
}

// Save (create or replace) the full message list for one conversation.
// Idempotent: calling it again with more messages just updates the document.
export async function saveSivConversation({ userId, email, sessionId, messages, artefact, status }) {
  if (!userId) throw new Error('userId is required');
  if (!sessionId) throw new Error('sessionId is required');

  const doc =
    (await SivConversation.findOne({ userId, sessionId })) ||
    new SivConversation({ userId, sessionId, runtime: 'siv', createdAt: new Date() });

  doc.email = email || doc.email;
  doc.messages = cleanMessages(messages);
  if (artefact !== undefined) doc.artefact = artefact;
  if (status) doc.status = status;
  doc.updatedAt = new Date();
  doc.bumpExpiry(); // 30 days from now

  await doc.save();
  return doc;
}

// List a user's SIV conversations, newest first.
export async function listSivConversations(userId, limit = 50) {
  return SivConversation.find({ userId })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean();
}

// Fetch one conversation a user owns.
export async function getSivConversation(userId, sessionId) {
  return SivConversation.findOne({ userId, sessionId }).lean();
}
