// AI completion via Google Vertex AI (Gemini).
//
// No API key: on Cloud Run this authenticates with the service account (same
// secure method Firestore uses). Locally, `gcloud auth application-default
// login` provides credentials.
//
// Exposes complete({ system, messages }) -> string, matching the contract the
// whole front-end already expects: window.claude.complete({system, messages}).
import { VertexAI } from '@google-cloud/vertexai';

const PROJECT =
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.GCLOUD_PROJECT ||
  process.env.GCP_PROJECT ||
  // Cloud Run does not guarantee that a project-id environment variable is
  // present, even though its service account credentials are available. This
  // is the non-secret GCP project that owns the deployed Vertex AI endpoint.
  'project-65b6724f-5ba8-4e67-bf3';
const LOCATION = process.env.VERTEX_LOCATION || 'us-central1';
const MODEL = process.env.VERTEX_MODEL || 'gemini-2.5-flash';
// The heavy, grounded company research uses a stronger model (Pro) for deeper
// synthesis; the quick extraction / Tier-0 steps stay on the fast model.
const RESEARCH_MODEL = process.env.VERTEX_RESEARCH_MODEL || 'gemini-2.5-pro';

let _model = null, _researchModel = null;
function model() {
  if (!_model) {
    const vertex = new VertexAI({ project: PROJECT, location: LOCATION });
    _model = vertex.getGenerativeModel({ model: MODEL });
  }
  return _model;
}
function researchModel() {
  if (!_researchModel) {
    const vertex = new VertexAI({ project: PROJECT, location: LOCATION });
    _researchModel = vertex.getGenerativeModel({ model: RESEARCH_MODEL });
  }
  return _researchModel;
}

// Map the front-end's {role, content} messages to Vertex's content format.
// Vertex roles are 'user' and 'model'; anything that isn't the assistant is
// treated as 'user'. (The `system` prompt is sent separately.)
function toContents(messages) {
  return (Array.isArray(messages) ? messages : [])
    .filter((m) => m && typeof m.content === 'string' && m.content.trim())
    .map((m) => ({
      role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
      parts: [{ text: String(m.content) }],
    }));
}

export async function complete({ system, messages } = {}) {
  const contents = toContents(messages);
  if (!contents.length) throw new Error('messages are required');

  const request = { contents };
  if (system && String(system).trim()) {
    request.systemInstruction = { role: 'system', parts: [{ text: String(system) }] };
  }

  const result = await model().generateContent(request);
  const candidate = result?.response?.candidates?.[0];
  const text = (candidate?.content?.parts || [])
    .map((p) => p.text)
    .filter(Boolean)
    .join('');
  return text || '';
}

// Like complete(), but with LIVE Google Search grounding switched on: the model
// genuinely searches the web and grounds its answer in real sources. Uses the
// same Vertex auth — no API key. Returns { text, queries, sources } where
// `sources` are the pages it actually grounded on. Falls back to a plain
// (ungrounded) completion if the search tool is unavailable on the project.
export async function completeGrounded({ system, messages } = {}) {
  const contents = toContents(messages);
  if (!contents.length) throw new Error('messages are required');

  const request = { contents, tools: [{ googleSearch: {} }] };
  if (system && String(system).trim()) {
    request.systemInstruction = { role: 'system', parts: [{ text: String(system) }] };
  }

  let candidate;
  try {
    const result = await researchModel().generateContent(request);
    candidate = result?.response?.candidates?.[0];
  } catch (err) {
    // Project without the search tool enabled → degrade to ungrounded.
    const text = await complete({ system, messages });
    return { text, queries: [], sources: [], grounded: false };
  }

  const text = (candidate?.content?.parts || [])
    .map((p) => p.text)
    .filter(Boolean)
    .join('');

  const gm = candidate?.groundingMetadata || {};
  const queries = gm.webSearchQueries || gm.retrievalQueries || [];
  const sources = (gm.groundingChunks || gm.groundingAttributions || [])
    .map((c) => ({ title: c?.web?.title || '', uri: c?.web?.uri || '' }))
    .filter((s) => s.title || s.uri);

  return { text: text || '', queries, sources, grounded: true };
}

// Like complete(), but lets the caller choose the model and generation config
// (used by ABL: the fast model for chat, the Pro model for long documents).
// Model instances are cached per name.
const _models = new Map();
function namedModel(name) {
  const key = name || MODEL;
  if (!_models.has(key)) {
    const vertex = new VertexAI({ project: PROJECT, location: LOCATION });
    _models.set(key, vertex.getGenerativeModel({ model: key }));
  }
  return _models.get(key);
}
export async function completeModel({ system, messages, model: modelName, generationConfig } = {}) {
  const contents = toContents(messages);
  if (!contents.length) throw new Error('messages are required');
  const request = { contents };
  if (generationConfig) request.generationConfig = generationConfig;
  if (system && String(system).trim()) {
    request.systemInstruction = { role: 'system', parts: [{ text: String(system) }] };
  }
  const result = await namedModel(modelName).generateContent(request);
  const candidate = result?.response?.candidates?.[0];
  const text = (candidate?.content?.parts || []).map((p) => p.text).filter(Boolean).join('') || '';
  // A truncated or filtered response also arrives as empty text. Without the
  // reason attached, every caller can only report "it did not work", so say
  // which it was: MAX_TOKENS means the budget ran out (on a thinking model the
  // reasoning is drawn from the same budget), SAFETY/RECITATION means blocked.
  if (!text) {
    const reason = candidate?.finishReason || result?.response?.promptFeedback?.blockReason || 'no candidate';
    const err = new Error(`The model returned nothing (${reason}).`);
    err.finishReason = reason;
    throw err;
  }
  if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
    console.warn(`[ai] ${modelName || MODEL} finished as ${candidate.finishReason} — output may be incomplete.`);
  }
  return text;
}

export const aiInfo = { project: PROJECT, location: LOCATION, model: MODEL, researchModel: RESEARCH_MODEL };
