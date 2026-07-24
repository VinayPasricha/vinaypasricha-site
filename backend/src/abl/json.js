// Tolerant JSON extraction for model responses. Gemini occasionally returns a
// correct JSON object with literal newlines inside quoted strings, which strict
// JSON.parse rejects even though the intended structure is unambiguous.
function escapeStringControls(source) {
  let out = '';
  let inString = false;
  let escaped = false;
  for (const char of String(source || '')) {
    if (!inString) {
      if (char === '"') inString = true;
      out += char;
      continue;
    }
    if (escaped) {
      escaped = false;
      out += char;
    } else if (char === '\\') {
      escaped = true;
      out += char;
    } else if (char === '"') {
      inString = false;
      out += char;
    } else if (char === '\n') {
      out += '\\n';
    } else if (char === '\r') {
      out += '\\r';
    } else if (char === '\t') {
      out += '\\t';
    } else {
      out += char;
    }
  }
  return out;
}

function parseCandidate(candidate) {
  try { return JSON.parse(candidate); } catch (error) { /* try repaired form */ }
  try { return JSON.parse(escapeStringControls(candidate)); } catch (error) { return null; }
}

export function extractJson(text) {
  if (!text) return null;
  const source = String(text).trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const direct = parseCandidate(source);
  if (direct) return direct;
  const start = source.indexOf('{');
  const end = source.lastIndexOf('}');
  return start >= 0 && end > start ? parseCandidate(source.slice(start, end + 1)) : null;
}
