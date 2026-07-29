// Shared correction and company-context recovery rules for every ABL agent.

const DOMAIN_RE = /\b(?:https?:\/\/)?(?:www\.)?((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24})\b/i;
const WEBSITE_REQUEST_RE = /\b(?:read|check|review|visit|open|look at)\b.{0,60}\b(?:website|site|domain)\b|\b(?:website|site|domain)\b.{0,60}\b(?:read|check|review|visit|open|look at)\b/i;
const REJECTED_CONTEXT_RE = /\b(?:that(?:'s| is)|this is|your information is|the information is)\s+not\s+(?:correct|right|accurate|what (?:(?:we|i) do|(?:our|my) company does))\b|\b(?:company|role|context|research)\b.{0,30}\b(?:wrong|incorrect|inaccurate)\b|\b(?:wrong|incorrect|inaccurate)\b.{0,30}\b(?:company|role|context|research)\b/i;

export function domainFromText(value) {
  const match = String(value || '').toLowerCase().match(DOMAIN_RE);
  return match ? match[1].replace(/^www\./, '').replace(/\.+$/, '') : '';
}

export function roleFromText(value) {
  const text = String(value || '');
  const match = text.match(/\b(?:i am|i'm)\s+(?:the\s+)?((?:co[- ]?)?founder(?:\s*(?:and|&)\s*(?:ceo|chief executive officer))?|ceo|chief executive officer|owner|managing director|director|president|partner)\s+(?:of|at)\b/i);
  if (!match) return '';
  return match[1]
    .replace(/\bceo\b/gi, 'CEO')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace(/Ceo/g, 'CEO');
}

function recentUserText(messages) {
  return (Array.isArray(messages) ? messages : [])
    .filter((message) => message && message.role !== 'assistant' && typeof message.content === 'string')
    .slice(-5)
    .map((message) => message.content);
}

export function detectCompanyRecovery(userMessage, recentMessages = []) {
  const current = String(userMessage || '').trim();
  const earlier = recentUserText(recentMessages).filter((text) => text !== current);
  const context = [current, ...earlier.slice().reverse()];
  const domain = context.map(domainFromText).find(Boolean) || '';
  const roleTitle = context.map(roleFromText).find(Boolean) || '';
  const identityCorrection = !!roleFromText(current) && !!domainFromText(current);
  const websiteRequest = WEBSITE_REQUEST_RE.test(current);
  const rejectedContext = REJECTED_CONTEXT_RE.test(current);
  const domainCompletesCorrection = !!domainFromText(current) && earlier.slice(-3).some((text) => REJECTED_CONTEXT_RE.test(text) || WEBSITE_REQUEST_RE.test(text));
  const triggered = identityCorrection || websiteRequest || rejectedContext || domainCompletesCorrection;
  return {
    triggered,
    shouldResearch: triggered && !!domain,
    domain,
    roleTitle,
    reason: identityCorrection ? 'identity_correction' : websiteRequest ? 'website_request' : rejectedContext ? 'context_rejected' : domainCompletesCorrection ? 'domain_supplied' : '',
  };
}

export function companyNameFromDomain(domain) {
  const first = String(domain || '').split('.')[0].replace(/[-_]+/g, ' ').trim();
  return first ? first.replace(/\b\w/g, (letter) => letter.toUpperCase()) : '';
}

export const CONTEXT_RECOVERY_POLICY = `## Corrections, uncertainty and website claims
- The participant's explicit correction immediately overrides conflicting preliminary research. Never repeat a fact they have rejected.
- When context is corrected, pause the normal course flow. Acknowledge the correction once, restate the corrected understanding briefly, and ask for confirmation before continuing.
- Never invent a company description, role, industry, metric or clickable answer merely to sound specific. Specificity must come from participant-confirmed information or a verified research block.
- Say you reviewed, searched, checked or visited a website ONLY when an authoritative LIVE WEB RESEARCH block in this prompt explicitly says the search succeeded. A domain name in the conversation and your general model knowledge do not count as browsing.
- If live research is unavailable or unverified, say so plainly. Ask for the official domain or one short correction; do not pretend the action succeeded.
- Ask exactly ONE primary question per reply. Do not bundle or number several questions.`;

export function buildRecoveryDirective(result) {
  if (!result || !result.triggered) return '';
  if (result.grounded) {
    return `## LIVE WEB RESEARCH — SUCCEEDED (authoritative for this recovery turn)
The participant explicitly corrected the preliminary profile. A live grounded search succeeded for https://${result.domain}, and the corrected company context below has been saved. Briefly acknowledge the correction, summarise the corrected company understanding in one or two sentences, and ask exactly one confirmation question. You may truthfully say that you checked the official website. Do not resume the normal diagnostic until the participant confirms.`;
  }
  if (result.attempted) {
    return `## LIVE WEB RESEARCH — NOT VERIFIED
The participant rejected the preliminary profile, but live research for https://${result.domain} did not return verified sources. Treat the rejected profile as invalid. State that you could not verify the website right now, do not describe the company from general knowledge, and ask exactly one question: whether the participant wants to retry or provide a one-sentence correction.`;
  }
  return `## CONTEXT CORRECTION — NEEDS AN OFFICIAL DOMAIN
The participant has rejected part of the preliminary profile. Treat the rejected information as invalid and do not repeat it. Do not guess replacement facts. Ask exactly one neutral question requesting the correct company name and official website/domain.`;
}
