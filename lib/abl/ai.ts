// Server-side LLM wrapper — Google Vertex AI (Gemini).
//
// No API key: authenticates with Application Default Credentials — the Cloud Run
// service account in production, `gcloud auth application-default login` locally.
// This is the SAME Vertex setup the main vinaypasricha.com backend uses.
//
// One interface — generateText({ system, messages, maxTokens, temperature }) —
// so callers (service.ts) are untouched. The Anthropic {role:'assistant'} shape
// is mapped to Gemini's {role:'model'} here; `system` is sent as a separate
// systemInstruction. Non-streaming for V1 reliability.
import "server-only";
import { VertexAI } from "@google-cloud/vertexai";
import { config } from "./config";

export type AiMsg = { role: "user" | "assistant"; content: string };

let _vertex: VertexAI | null = null;
const _models = new Map<string, ReturnType<VertexAI["getGenerativeModel"]>>();

function vertex(): VertexAI {
  if (!_vertex) {
    _vertex = new VertexAI({ project: config.ai.gcpProject || undefined, location: config.ai.gcpRegion });
  }
  return _vertex;
}
function model(name: string) {
  let m = _models.get(name);
  if (!m) {
    m = vertex().getGenerativeModel({ model: name });
    _models.set(name, m);
  }
  return m;
}

// Gemini roles are 'user' | 'model'; anything not the assistant becomes 'user'.
function toContents(messages: AiMsg[]) {
  return messages
    .filter((m) => m && typeof m.content === "string" && m.content.trim())
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: String(m.content) }],
    }));
}

export async function generateText(opts: {
  system: string;
  messages: AiMsg[];
  maxTokens?: number;
  temperature?: number;
  modelName?: string;
}): Promise<string> {
  const contents = toContents(opts.messages);
  if (!contents.length) throw new Error("messages are required");

  const request = {
    contents,
    generationConfig: {
      maxOutputTokens: opts.maxTokens ?? 1024,
      temperature: opts.temperature ?? 0.6,
    },
    ...(opts.system && opts.system.trim()
      ? { systemInstruction: { role: "system", parts: [{ text: opts.system }] } }
      : {}),
  };

  const result = await model(opts.modelName || config.ai.model).generateContent(request);
  const candidate = result?.response?.candidates?.[0];
  const text = (candidate?.content?.parts || [])
    .map((p) => (p as { text?: string }).text)
    .filter(Boolean)
    .join("")
    .trim();
  return text;
}
