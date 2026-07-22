import mammoth from 'mammoth';
import pdf from 'pdf-parse/lib/pdf-parse.js';

const MAX_ASSET_BYTES = 6 * 1024 * 1024;
const MAX_CONTEXT_CHARS = 300_000;
const SUPPORTED_EXTENSIONS = [
  'txt', 'md', 'csv', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png',
];
const EXTRACTABLE_EXTENSIONS = ['txt', 'md', 'csv', 'pdf', 'docx'];

function extension(name) {
  return String(name || '').toLowerCase().split('.').pop();
}

function cleanText(value) {
  return String(value || '')
    .replace(/\u0000/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

export function supportedParticipantAsset(name) {
  return SUPPORTED_EXTENSIONS.includes(extension(name));
}

export function extractableParticipantAsset(name) {
  return EXTRACTABLE_EXTENSIONS.includes(extension(name));
}

export function decodeParticipantAsset(value) {
  const source = String(value || '').replace(/^data:[^;]+;base64,/, '');
  if (!source || !/^[A-Za-z0-9+/=\s]+$/.test(source)) throw new Error('The uploaded file could not be read.');
  const buffer = Buffer.from(source, 'base64');
  if (!buffer.length || buffer.length > MAX_ASSET_BYTES) throw new Error('Participant files must be smaller than 6 MB.');
  return buffer;
}

export async function extractParticipantAssetText(name, buffer) {
  const ext = extension(name);
  if (!EXTRACTABLE_EXTENSIONS.includes(ext)) return { text: '', extractable: false, truncated: false };
  try {
    let text = '';
    if (ext === 'docx') {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else if (ext === 'pdf') {
      const result = await pdf(buffer);
      text = result.text;
    } else {
      text = buffer.toString('utf8');
    }
    text = cleanText(text);
    return { text: text.slice(0, MAX_CONTEXT_CHARS), extractable: true, truncated: text.length > MAX_CONTEXT_CHARS };
  } catch (error) {
    return { text: '', extractable: true, truncated: false, extraction_error: 'Text could not be extracted from this file.' };
  }
}

export function participantAssetMime(name) {
  const types = {
    csv: 'text/csv', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    jpg: 'image/jpeg', jpeg: 'image/jpeg', md: 'text/markdown', pdf: 'application/pdf', png: 'image/png',
    ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    txt: 'text/plain', xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
  return types[extension(name)] || 'application/octet-stream';
}

export const participantAssetLimits = { maxFileBytes: MAX_ASSET_BYTES, maxContextChars: MAX_CONTEXT_CHARS };
