// Safe, bounded retrieval of an official public company website. This is used
// only as a grounding fallback when Vertex Google Search returns no sources.
import dns from 'node:dns/promises';
import net from 'node:net';
import { JSDOM } from 'jsdom';

const MAX_BYTES = 5_000_000;
const MAX_TEXT = 35_000;
const MAX_COMBINED_TEXT = 60_000;
const MAX_REDIRECTS = 3;

export function isPrivateAddress(address) {
  const value = String(address || '').toLowerCase();
  if (net.isIPv4(value)) {
    const [a, b] = value.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19));
  }
  if (net.isIPv6(value)) {
    return value === '::' || value === '::1' || value.startsWith('fc') ||
      value.startsWith('fd') || value.startsWith('fe8') || value.startsWith('fe9') ||
      value.startsWith('fea') || value.startsWith('feb') || value.startsWith('::ffff:127.') ||
      value.startsWith('::ffff:10.') || value.startsWith('::ffff:169.254.') ||
      value.startsWith('::ffff:192.168.');
  }
  return true;
}

export function officialWebsiteUrl(domain) {
  const host = String(domain || '').toLowerCase().replace(/^https?:\/\//, '').split('/')[0].replace(/^www\./, '');
  if (!host || net.isIP(host) || host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return null;
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(host)) return null;
  return new URL(`https://${host}/`);
}

async function assertPublicHost(hostname) {
  const rows = await dns.lookup(hostname, { all: true, verbatim: true });
  if (!rows.length || rows.some((row) => isPrivateAddress(row.address))) {
    throw new Error('Website does not resolve to a public address');
  }
}

async function fetchPage(url, redirectCount = 0) {
  if (!(url instanceof URL) || url.protocol !== 'https:') throw new Error('Only HTTPS websites are allowed');
  await assertPublicHost(url.hostname);
  const response = await fetch(url, {
    redirect: 'manual',
    signal: AbortSignal.timeout(12_000),
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'User-Agent': 'AI-for-Business-Leaders-Research/1.0',
    },
  });
  if (response.status >= 300 && response.status < 400) {
    if (redirectCount >= MAX_REDIRECTS) throw new Error('Too many website redirects');
    const location = response.headers.get('location');
    if (!location) throw new Error('Website redirect had no destination');
    const next = new URL(location, url);
    return fetchPage(next, redirectCount + 1);
  }
  if (!response.ok) throw new Error(`Official website returned HTTP ${response.status}`);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('text/html')) throw new Error('Official website did not return HTML');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_BYTES) throw new Error('Official website response was empty or too large');
  return { url: url.href, html: new TextDecoder().decode(bytes) };
}

export function extractWebsiteText(html) {
  const dom = new JSDOM(String(html || ''));
  const document = dom.window.document;
  document.querySelectorAll('script,style,noscript,svg,template').forEach((node) => node.remove());
  const title = (document.title || '').trim();
  const description = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
  const visible = (document.body?.textContent || '').replace(/\s+/g, ' ').trim();
  dom.window.close();
  return [title, description, visible].filter(Boolean).join('\n').slice(0, MAX_TEXT);
}

export function candidateWebsiteUrls(html, baseUrl) {
  const base = new URL(baseUrl);
  const hostKey = base.hostname.replace(/^www\./, '');
  const dom = new JSDOM(String(html || ''));
  const seen = new Set();
  const rows = [];
  for (const anchor of dom.window.document.querySelectorAll('a[href]')) {
    try {
      const url = new URL(anchor.getAttribute('href'), base);
      if (url.protocol !== 'https:' || url.hostname.replace(/^www\./, '') !== hostKey) continue;
      url.hash = ''; url.search = '';
      if (url.pathname === '/' || seen.has(url.href)) continue;
      const haystack = `${url.pathname} ${anchor.textContent || ''}`.toLowerCase();
      let score = 0;
      if (/about|company|who-we-are/.test(haystack)) score += 12;
      if (/hirer|employer|business/.test(haystack)) score += 11;
      if (/product|service|solution|platform/.test(haystack)) score += 8;
      if (!score || /login|sign-in|privacy|terms|blog|career|job\//.test(haystack)) continue;
      seen.add(url.href);
      rows.push({ url: url.href, score });
    } catch (error) { /* ignore malformed links */ }
  }
  dom.window.close();
  return rows.sort((a, b) => b.score - a.score).slice(0, 2).map((row) => row.url);
}

export async function fetchOfficialWebsite(domain) {
  const url = officialWebsiteUrl(domain);
  if (!url) throw new Error('A valid public company domain is required');
  const home = await fetchPage(url);
  const pages = [home];
  const candidates = candidateWebsiteUrls(home.html, home.url);
  const extras = await Promise.all(candidates.map(async (candidate) => {
    try { return await fetchPage(new URL(candidate)); } catch (error) { return null; }
  }));
  pages.push(...extras.filter(Boolean));
  const text = pages.map((page) => `PAGE: ${page.url}\n${extractWebsiteText(page.html)}`).join('\n\n').slice(0, MAX_COMBINED_TEXT);
  if (text.length < 200) throw new Error('Official website did not expose enough readable content');
  return { url: home.url, pages: pages.map((page) => page.url), text };
}
