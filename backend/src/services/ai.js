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
  process.env.GCP_PROJECT;
const LOCATION = process.env.VERTEX_LOCATION || 'us-central1';
const MODEL = process.env.VERTEX_MODEL || 'gemini-2.5-flash';

let _model = null;
function model() {
  if (!_model) {
    const vertex = new VertexAI({ project: PROJECT, location: LOCATION });
    _model = vertex.getGenerativeModel({ model: MODEL });
  }
  return _model;
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

export const aiInfo = { project: PROJECT, location: LOCATION, model: MODEL };
