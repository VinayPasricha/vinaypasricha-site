#!/usr/bin/env node
// Builds the six static book landing pages at books/<slug>.html.
// Content is grounded in assets/data/books.json, the /paths essays,
// the manuscripts under library/, and the public Amazon listings
// for the ASINs named in the task. No reviews, ratings, or ranks.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://vinaypasricha.com';
const LANGS = ['en', 'hi', 'bn', 'ta', 'te', 'kn', 'es', 'fr', 'pt', 'ja', 'zh', 'ko', 'ru'];

const BOOKS = [
  {
    slug: 'ai-for-business-leaders',
    volume: 'I',
    title: 'AI for Business Leaders',
    h1: 'AI for Business Leaders',
    subtitle: 'A clear-headed guide to leading with AI without losing the plot.',
    cover: '/assets/images/ai-for-business-leaders-cover-front.jpg',
    alt: 'Cover of AI for Business Leaders by Vinay Pasricha, a guide to leading with AI without losing the plot',
    asin: 'B0GFXXPGP7',
    isbn: '978-0-9978459-1-4',
    pages: 271,
    hardcoverPages: 232,
    hardcoverIsbn: '978-9360769628',
    published: '10 January 2026',
    datePublished: '2026-01-10',
    paperback: 'https://www.amazon.in/dp/9360769622',
    kicker: 'Volume I · Kindle edition',
    description: 'AI for Business Leaders by Vinay Pasricha. AI scales clarity or chaos. Design the company brain before the tools. Kindle print length 271.',
    synopsis: 'AI does not fix chaos. It scales it. <em>AI for Business Leaders</em> is Vinay Pasricha’s guide for founders and operators who must move now and still want to move clearly — design the organisation as a brain, with memory, reasoning, action, and feedback, before any tool is allowed to amplify what is already there.',
    audienceTitle: 'For leaders who must move, <em>and still think.</em>',
    audience: 'Founders, CEOs, CXOs, operators, and business heads. The book assumes you know how to run a company and asks where AI fits inside that craft. It is not a technical manual: no code, no jargon, and no futurism. The site’s own line for it is the short one — <em>questions before answers.</em>',
    ideas: [
      ['01', 'Scale', 'If the organisation is unclear, fragmented, or dependent on heroic individuals, AI amplifies those weaknesses. If it is well designed, AI becomes a force multiplier.'],
      ['02', 'Brain', 'Every company already runs on memory, reasoning, action, and feedback. Very few have designed those four functions on purpose. The book starts there, not with a vendor list.'],
      ['03', 'Fit', 'The leadership skill is knowing where AI belongs and where it does not — fluency before tools, and a written line around what stays human.'],
    ],
    excerptOpener: 'The leaders who get AI right will not be the ones who moved first. They will be the ones who thought clearest.',
    excerpt: [
      'Every executive being told two contradictory things — move fast or be left behind, and be careful or you will destroy something you cannot rebuild — is holding two truths that are useless without a way to hold them together.',
      'AI for Business Leaders is the framework shared with those operators. It is the first book in the series for a reason: the later questions about decisions, execution, and hiring make sense once your AI question, not the AI question, has been answered.',
    ],
    excerptNote: 'Adapted from the preface, as already published on the AI for Business Leaders path.',
    paths: [
      ['/paths/ai-for-business', 'The AI path'],
      ['/paths/ai-for-business-companion', 'Talk to the book'],
      ['/paths/course', 'The AI Leadership Course'],
    ],
    faqs: [
      ['What is AI for Business Leaders by Vinay Pasricha?', 'A leadership guide to using AI without scaling the chaos you already have. It treats the company as a brain — memory, reasoning, action, and feedback — and asks leaders to design that brain before they deploy tools.'],
      ['Who is AI for Business Leaders for?', 'Founders, CEOs, CXOs, operators, and business heads who want AI to work for the organisation. It does not require a technical background.'],
      ['How long is AI for Business Leaders, and when did it come out?', 'The Kindle edition (ASIN B0GFXXPGP7) lists a print length of 271 pages. Amazon lists the publication date as 10 January 2026. The Amazon.in hardcover is 232 pages, ISBN-13 978-9360769628.'],
      ['How does this book sit with the others?', 'It is Volume I. The later books — The SIV Method, The Execution Doctrine, Organizational Frequency — take up decisions, execution, and hiring once the AI question has a frame. The AI Leadership Course on this site is the six-week cohort built around the same framework.'],
    ],
  },
  {
    slug: 'siv-method',
    volume: 'II',
    title: 'The SIV Method',
    h1: 'The SIV Method',
    subtitle: 'A brutal framework for understanding reality before execution.',
    cover: '/assets/images/siv-method-cover-front.jpg',
    alt: 'Cover of The SIV Method by Vinay Pasricha, a framework for understanding reality before execution',
    asin: 'B0GX27LGJX',
    isbn: '978-0-9978459-2-1',
    pages: 46,
    published: '13 April 2026',
    datePublished: '2026-04-13',
    kicker: 'Volume II · Kindle edition',
    description: 'The SIV Method by Vinay Pasricha. Most failure begins in misunderstanding, not in the move. See reality before you act. Kindle print length 46.',
    synopsis: 'Most failure does not begin in action. It begins in misunderstanding. <em>The SIV Method</em> — Socratic, Iterative, Vinay — is Vinay Pasricha’s framework for closing the gap between interpretation and reality before power is applied. Lenses are generated from the issue itself, then held under Socratic pressure until the understanding is strong enough to support a move.',
    audienceTitle: 'For people who decide, <em>and are tired of the cost.</em>',
    audience: 'People who work — who decide, lead, build, treat, and shape — in health, relationships, careers, organisations, and policy. It is not a philosophy and not a productivity system. It is a method for anyone tired of paying for shallow interpretation. You can try the same sequence on a live decision, on this site, before you buy the book.',
    ideas: [
      ['01', 'Before', 'Most decisions fail before they begin, in the moment a person decides they understand something before the work of understanding is done.'],
      ['02', 'Lenses', 'The lenses are generated from the issue, not picked from a checklist. Each one shapes the next. The inquiry does not rush.'],
      ['03', 'Pressure', 'Coherence is not evidence. Emotion is not argument. Certainty is not truth. Confidence and certainty are kept apart on purpose.'],
    ],
    excerptOpener: 'The mind wants relief. Reality demands more.',
    excerpt: [
      'Most failure does not begin in action. It begins earlier, quieter, deeper inside the frame — in the moment we decide we understand something before we actually do. That feeling of clarity arriving before the work of clarity has been completed.',
      'SIV exists for people who are tired of paying that cost. It is not the last word. It is the opening move.',
    ],
    excerptNote: 'Adapted from the preface to The SIV Method, as already published on the decisions path.',
    paths: [
      ['/paths/decisions', 'Try the method'],
      ['/paths/decisions#begin', 'Begin a SIV session'],
      ['/paths/course', 'The AI Leadership Course'],
    ],
    faqs: [
      ['What is The SIV Method by Vinay Pasricha?', 'A framework for understanding reality before execution. SIV stands for Socratic, Iterative, Vinay. It moves a person from premature conviction toward an understanding strong enough to support action.'],
      ['Who is The SIV Method for?', 'People who make decisions and are tired of paying the cost of shallow interpretation — in health, relationships, careers, organisations, and policy. It is a method for people who work, not a self-help programme.'],
      ['How long is The SIV Method?', 'The Kindle edition (ASIN B0GX27LGJX) lists a print length of 46 pages. Amazon lists the publication date as 13 April 2026, first edition.'],
      ['Can I try the method without the book?', 'Yes. The decisions path on this site walks a real decision through SIV and produces a one-page thinking artefact. No account. The book is the full instrument; the session is the opening move.'],
    ],
  },
  {
    slug: 'execution-doctrine',
    volume: 'III',
    title: 'The Execution Doctrine',
    h1: 'The Execution Doctrine',
    subtitle: 'From understanding to applied force in the world.',
    cover: '/assets/images/execution-doctrine-cover-front.jpg',
    alt: 'Cover of The Execution Doctrine by Vinay Pasricha, a field manual for finding and strengthening the constraint that limits output',
    asin: 'B0GXVLX2G9',
    isbn: '978-0-9978459-3-8',
    pages: 83,
    published: '29 April 2026',
    datePublished: '2026-04-29',
    kicker: 'Volume III · Kindle edition · 18 chapters',
    description: 'The Execution Doctrine by Vinay Pasricha. Find the constraint that limits output, then strengthen it. Kindle print length 83.',
    synopsis: 'SIV produces understanding. <em>The Execution Doctrine</em> applies it. Vinay Pasricha’s field manual treats execution as a craft: see the work as a sequence, find the current limiting factor, and strengthen that point cycle after cycle until the capacity of the whole rises. It is not a productivity book and not a list of habits.',
    audienceTitle: 'For operators who want to be <em>apt, not merely fast.</em>',
    audience: 'Builders, operators, and founders — and the teams, companies, and missions they run. The doctrine is written for people who already execute and want a sharper grammar for it. The domain can change. The underlying logic does not.',
    ideas: [
      ['01', 'Sequence', 'See the work as a sequence, not a mood. The doctrine sits on the ordinary Plan–Do–Check–Act loop and gives that loop a governing logic.'],
      ['02', 'Constraint', 'Every process has a current limiting factor. Output is shaped by the point where weakness still governs the flow, not by the parts that are already strong.'],
      ['03', 'Cycle', 'One constraint governs each cycle. Identify it. Strengthen it. Ignore what does not matter. Repeat until capacity rises without heroic effort.'],
    ],
    excerptOpener: 'Execution is the bridge between intention and reality.',
    excerpt: [
      'Execution is among the most consequential force multipliers in professional and personal life. It is the bridge between intention and reality, between strategic vision and tangible result, between possibility and built form. Ideas matter. Strategy matters. Talent matters. But ultimately, the world is shaped by what is actually executed.',
      'The highest form of execution is mastery. It is not loud. It emerges from seeing the work clearly, structuring it properly, diagnosing what truly constrains it, and strengthening that point with precision.',
    ],
    excerptNote: 'From the preface, “The Spirit of the Doctrine,” in the manuscript held on this site.',
    paths: [
      ['/paths/execute', 'The execution path'],
      ['/runtime/', 'The execution runtime'],
      ['/paths/course', 'The AI Leadership Course'],
    ],
    faqs: [
      ['What is The Execution Doctrine by Vinay Pasricha?', 'A universal system for finding the single point where weakness most limits output, and strengthening it cycle after cycle. It is a doctrine for building stronger pathways from intention to outcome, not a productivity method.'],
      ['Who is The Execution Doctrine for?', 'Builders, operators, and founders who already do the work and want to be apt rather than merely fast. It scales from an individual to a team, a company, or a long-horizon mission.'],
      ['How long is The Execution Doctrine?', 'The Kindle edition (ASIN B0GXVLX2G9) lists a print length of 83 pages, in 18 chapters. Amazon lists the publication date as 29 April 2026.'],
      ['How does it relate to The SIV Method?', 'SIV asks whether the situation has actually been understood. The Doctrine asks whether the right force is being applied, in the right sequence, on the constraint that matters. Understanding without execution is unfinished. Execution without understanding is the other failure.'],
    ],
  },
  {
    slug: 'organizational-frequency',
    volume: 'IV',
    title: 'Organizational Frequency',
    h1: 'Organizational Frequency',
    subtitle: 'A new doctrine for hiring in the age of intelligent discovery.',
    cover: '/assets/images/organizational-frequency-cover-front.jpg',
    alt: 'Cover of Organizational Frequency by Vinay Pasricha, a doctrine for hiring by resonance rather than resumes',
    asin: 'B0H2NTL3XS',
    isbn: '978-1-7385942-0-3',
    pages: 218,
    published: '23 May 2026',
    datePublished: '2026-05-23',
    kicker: 'Volume IV · Doctrine for the Future of Work · 01',
    description: 'Organizational Frequency by Vinay Pasricha. Hiring is discovery, not persuasion. A doctrine for founders and hiring leaders. Kindle print length 218.',
    synopsis: 'Hiring is not convincing people to fit somewhere. It is discovering where they already belong. <em>Organizational Frequency</em> is Vinay Pasricha’s doctrine for talent: every company carries a frequency, every person carries their own, and great performance happens when the two resonate. Most bad hires are not bad people. They are mismatched frequencies.',
    audienceTitle: 'For people who hire, <em>and people who have been hired wrong.</em>',
    audience: 'Founders, hiring leaders, and HR partners — and anyone who has made a bad hire, or been the wrong hire. It is Doctrine 01 in a series on the future of work: short, dense, and aimed at the moment a person who looked right on paper turned out wrong in the room. The practical platform built from the doctrine is <a href="https://www.goodspace.ai" target="_blank" rel="noopener">GoodSpace AI</a>. This page is the book.',
    ideas: [
      ['01', 'Past', 'A resume tells you what someone has done. It cannot tell you where they belong. Frequency is the claim about the future, not the record of the past.'],
      ['02', 'Four', 'Understand, discover, validate, grow. Four stages, each a posture the organisation adopts before any individual hire is made. Not a funnel.'],
      ['03', 'Match', 'A talented person in the wrong environment looks mediocre. A mismatched hire is a frequency error, not a character verdict. Discovery replaces persuasion.'],
    ],
    excerptOpener: 'Most hiring failures are not failures of judgement. They are failures of doctrine.',
    excerpt: [
      'A hundred years of hiring practice has produced an industry that treats human beings as resumes — flat records of where they have been. The interview, in its modern form, is structured to test fluency, not fit. The result is a system everyone knows is broken, and almost no one has the doctrine to fix.',
      'Organizational Frequency does not solve hiring. It re-names it. It treats hiring not as a transaction or a funnel, but as an act of discovery.',
    ],
    excerptNote: 'Adapted from the preface to Organizational Frequency, as already published on the hiring path.',
    paths: [
      ['/paths/hire', 'The hiring path'],
      ['/paths/find-work', 'Find your frequency'],
      ['/paths/course', 'The AI Leadership Course'],
    ],
    faqs: [
      ['What is Organizational Frequency by Vinay Pasricha?', 'A doctrine for hiring in the age of intelligent discovery. Companies and people each carry a frequency. Performance happens when they resonate. The book replaces convincing someone to fit with discovering whether they already do.'],
      ['Who is Organizational Frequency for?', 'Founders, hiring leaders, HR partners, and anyone who has made a bad hire or been the wrong hire. It is the first volume of a doctrine on the future of work.'],
      ['How long is Organizational Frequency?', 'The Kindle edition (ASIN B0H2NTL3XS) lists a print length of 218 pages. Amazon lists the publication date as 23 May 2026. The ISBN carried on this site is 978-1-7385942-0-3.'],
      ['Is this the GoodSpace hiring page?', 'No. This page is the book. GoodSpace AI is the platform built from the same doctrine. The hiring path on this site is the longer essay. The bookshelf card used to send readers to that path; it now comes here.'],
    ],
  },
  {
    slug: 'the-signal',
    volume: 'V',
    title: 'The Signal',
    h1: 'The Signal',
    subtitle: 'A practice for clearer reception.',
    cover: '/assets/images/the-signal-cover-front.jpg',
    alt: 'Cover of The Signal by Vinay Pasricha, a practice for clearer reception beneath the noise',
    asin: 'B0H3WJJH3S',
    isbn: null,
    pages: 86,
    published: '3 June 2026',
    datePublished: '2026-06-03',
    kicker: 'Volume V · Out now',
    description: 'The Signal by Vinay Pasricha. A practice for clearer reception beneath the noise. Out now. Kindle print length 86.',
    synopsis: 'There is something happening inside the modern mind that has not yet been adequately named. Not depression, not anxiety, not burnout — a persistent sense that something has gone slightly wrong with the way we think. <em>The Signal</em>, by Vinay Pasricha, calls it a failure of reception: the faculty intelligence depends on, and that almost no one has trained. The book is out now.',
    audienceTitle: 'For anyone who can feel the noise, <em>and cannot yet name it.</em>',
    audience: 'For anyone who has noticed that something is wrong with the way they have been thinking, and has not had words for it yet. Decisions that take too long. The same conversation, every year. Books read and forgotten by morning. The earlier books are about how to act. This one is about what to pay attention to in the first place.',
    ideas: [
      ['01', 'Distortion', 'What degrades reception: emotional turbulence, compulsive narrative, fragmented attention, identity protection. Most of what we call thinking is generation — the mind closing the door early.'],
      ['02', 'Signal', 'What becomes available once the interference drops and the ordinary is finally heard. A practice for clearer reception, not another framework to acquire and forget.'],
      ['03', 'After', 'The Second Book: an adaptive runtime that continues after the last page, at the moments perception collapses and distortion reforms. The field is open on this site.'],
    ],
    excerptOpener: 'The world has never been louder. The discipline of finding the signal has never been more important.',
    excerpt: [
      'The previous books — AI for Business Leaders, The SIV Method, The Execution Doctrine, Organizational Frequency — are about how to act well inside a changing world. The Signal is about what to pay attention to in the first place. Without that clarity, the other disciplines float free of any ground.',
      'It is the most personal of them — closer to a notebook than a manual — and that is deliberate. A book about signal cannot itself be noisy.',
    ],
    excerptNote: 'TODO-VINAY: replace this with a short passage from the published June 2026 edition. The text above is the working preface of May 2026, already on the Signal path. The manuscript is not in the library yet.',
    paths: [
      ['/paths/evolve', 'The Signal path'],
      ['/signal/', 'Enter the field'],
      ['/paths/course', 'The AI Leadership Course'],
    ],
    faqs: [
      ['What is The Signal by Vinay Pasricha?', 'A practice for clearer reception. It argues that for a century we have built horsepower while neglecting detection — the capacity to perceive a situation accurately before the mind rushes to interpret it. It is the latest of the six books, and it is out now.'],
      ['Who is The Signal for?', 'Anyone who has noticed that something is wrong with the way they have been thinking, and has not had words for it yet. It is the most personal of the books, closer to a notebook than a manual.'],
      ['How long is The Signal, and is it published?', 'Yes. The Kindle edition (ASIN B0H3WJJH3S) lists a print length of 86 pages. Amazon lists the publication date as 3 June 2026. It is also available in print.'],
      ['What are the three parts?', 'Distortion maps what degrades reception. Signal describes what becomes available once the interference drops. The Second Book is an adaptive runtime that continues the work after the final page. You can enter that field on this site.'],
    ],
  },
  {
    slug: 'civilization',
    volume: 'VI',
    title: 'Civilization',
    h1: 'Civilization',
    subtitle: 'A framework for evaluating the direction of intelligent civilizations.',
    cover: '/assets/images/civilization-cover-front.jpg',
    alt: 'Cover of Civilization by Vinay Pasricha, a compass of eight directions for intelligent civilizations',
    asin: 'B0H4GWZND6',
    isbn: null,
    pages: 284,
    published: '8 June 2026',
    datePublished: '2026-06-08',
    publisher: 'The Meridian Press',
    kicker: 'Volume VI · The Meridian Press',
    description: 'Civilization by Vinay Pasricha. Eight directions for where an intelligent civilization is heading. A compass, not a map. Kindle print length 284.',
    synopsis: 'Intelligence does not evolve at random. <em>Civilization</em>, by Vinay Pasricha, offers a compass rather than a map: eight directions every enduring civilization is pulled along. Four Foundations — Continuity, Truth, Capability, Cooperation — hold it together. Four Frontiers — Expansion, Creation, Recursion, Purpose — carry it forward. The book does not predict the future. It tries to identify the currents that create one.',
    audienceTitle: 'For readers who need a compass, <em>not another map.</em>',
    audience: 'Anyone trying to tell progress from mere motion — in a society, an institution, a technology, or a serious vision of the future. The book is a civilizational framework, not a manifesto and not a work of science fiction. Volume I turns the same eight directions on Rome, China, modernity, and artificial intelligence.',
    ideas: [
      ['01', 'Eight', 'Four Foundations and four Frontiers. The directions are not political, cultural, or religious, and not uniquely human. They are the claim about wherever intelligence emerges.'],
      ['02', 'Compass', 'Maps of the future go obsolete. A compass locates direction. A civilization can move quickly and still move the wrong way. Success and progress are not the same thing.'],
      ['03', 'Cases', 'The instrument is then used: Rome, which changed shape more than it fell; China, which survived itself; modernity, inhabited by the reader; and AI, the first non-biological case.'],
    ],
    excerptOpener: 'The future is not arbitrary. The details may be uncertain. The direction is not.',
    excerpt: [
      'The central claim of this book is that intelligence evolves along identifiable directions. These directions are not political. They are not cultural. They are not religious. They are not uniquely human. They emerge wherever intelligence emerges.',
      'This book does not attempt to predict the future. It attempts to identify the deeper currents that create it. A civilization can move rapidly and still move in the wrong direction. Success and progress are not always the same thing.',
    ],
    excerptNote: 'From the opening of Part One, “A Conscious Universe,” in the manuscript held on this site.',
    paths: [
      ['/paths/civilization', 'Read Civilization on this site'],
      ['/paths/civilization#ask', 'Ask the book'],
      ['/paths/course', 'The AI Leadership Course'],
    ],
    faqs: [
      ['What is Civilization by Vinay Pasricha?', 'A framework for evaluating the direction of intelligent civilizations. Eight directions — four Foundations and four Frontiers — form a compass for telling progress from mere motion. It is published by The Meridian Press.'],
      ['Who is Civilization for?', 'Readers who want a reference frame for a serious vision of the future: a society, an institution, a technology, or an era. It is a framework that states, in advance, what would prove it wrong.'],
      ['How long is Civilization?', 'The Kindle edition (ASIN B0H4GWZND6) lists a print length of 284 pages. Amazon lists the publication date as 8 June 2026. The manuscript on this site is organised as nineteen chapters across three parts and an epilogue.'],
      ['What are the eight directions?', 'Foundations: Continuity, Truth, Capability, Cooperation. Frontiers: Expansion, Creation, Recursion, Purpose. Part Three reads Rome, China, modernity, and artificial intelligence through that frame.'],
    ],
  },
];

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function hreflang(urlPath) {
  const base = ORIGIN + urlPath;
  const lines = [
    `<link rel="alternate" hreflang="x-default" href="${base}">`,
    ...LANGS.map((code) => {
      const href = code === 'en' ? base : `${base}?lang=${code}`;
      return `<link rel="alternate" hreflang="${code}" href="${href}">`;
    }),
  ];
  return lines.map((line) => '  ' + line).join('\n');
}

function jsonLd(book) {
  const url = `${ORIGIN}/books/${book.slug}`;
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Person',
        '@id': `${ORIGIN}/#vinay`,
        name: 'Vinay Pasricha',
        url: ORIGIN,
        image: `${ORIGIN}/assets/images/vinay-avatar.png`,
        jobTitle: 'Founder, author, explorer of emergence',
        description: 'Founder of GoodSpace AI and WLC College India. Author of six books on AI, decision-making, execution, signal, and civilization.',
        worksFor: { '@type': 'Organization', name: 'GoodSpace AI', url: 'https://www.goodspace.ai' },
        sameAs: [
          'https://www.linkedin.com/in/vinay-pasricha-a264186/',
          'https://www.goodspace.ai',
          'https://www.amazon.in/stores/Vinay-Pasricha/author/B0GX6CVZ51',
          'https://www.amazon.com/stores/Vinay-Pasricha/author/B0GX6CVZ51',
        ],
      },
      {
        '@type': 'Book',
        '@id': `${url}#book`,
        name: book.title,
        alternateName: book.subtitle.replace(/\.$/, ''),
        author: { '@id': `${ORIGIN}/#vinay` },
        url,
        image: ORIGIN + book.cover,
        inLanguage: 'en',
        bookFormat: 'https://schema.org/EBook',
        datePublished: book.datePublished,
        numberOfPages: book.pages,
        description: book.description,
        ...(book.isbn ? { isbn: book.isbn } : {}),
        ...(book.publisher ? { publisher: { '@type': 'Organization', name: book.publisher } } : {}),
        workExample: {
          '@type': 'Book',
          bookFormat: 'https://schema.org/EBook',
          isbn: book.asin,
          url: `https://www.amazon.in/dp/${book.asin}`,
        },
        offers: {
          '@type': 'Offer',
          url: `https://www.amazon.in/dp/${book.asin}`,
          availability: 'https://schema.org/InStock',
          seller: { '@type': 'Organization', name: 'Amazon' },
        },
      },
      {
        '@type': 'FAQPage',
        '@id': `${url}#faq`,
        url,
        mainEntity: book.faqs.map(([q, a]) => ({
          '@type': 'Question',
          name: q,
          acceptedAnswer: { '@type': 'Answer', text: a },
        })),
      },
    ],
  };
  // Kindle ASIN is not an ISBN. Don't put it in isbn.
  delete graph['@graph'][1].workExample.isbn;
  graph['@graph'][1].workExample.identifier = {
    '@type': 'PropertyValue',
    propertyID: 'ASIN',
    value: book.asin,
  };
  return JSON.stringify(graph).replace(/</g, '\\u003c');
}

function others(book) {
  return BOOKS.filter((item) => item.slug !== book.slug).map((item) => `
      <a class="cont-card" href="/books/${item.slug}">
        <div class="cont-num">${esc(item.volume.toLowerCase())}.</div>
        <div class="cont-title">${titleEm(item.title)}</div>
        <div class="cont-desc">${esc(item.subtitle)}</div>
        <div class="cont-arrow">→</div>
      </a>`).join('');
}

function titleEm(title) {
  // Italicise the distinctive word the way the rest of the site does.
  if (title.startsWith('The ')) return 'The <em>' + esc(title.slice(4)) + '</em>';
  if (title.startsWith('AI ')) return 'AI for <em>Business Leaders</em>';
  return '<em>' + esc(title) + '</em>';
}

function page(book) {
  const url = `${ORIGIN}/books/${book.slug}`;
  const title = `${book.title} by Vinay Pasricha`;
  if (title.length > 60) throw new Error(`Title too long (${title.length}): ${title}`);
  if (book.description.length > 160) throw new Error(`Description too long (${book.description.length}): ${book.description}`);
  const metaBits = [
    'Vinay Pasricha',
    book.published,
    `Kindle print length · ${book.pages}`,
    book.hardcoverPages ? `Hardcover · ${book.hardcoverPages} pages` : null,
    book.hardcoverIsbn ? `ISBN-13 ${book.hardcoverIsbn}` : null,
    book.isbn ? `ISBN ${book.isbn}` : null,
  ].filter(Boolean);

  const ideaHtml = book.ideas.map(([num, name, desc]) => `
    <div class="pillar">
      <div class="letter">${esc(num)}</div>
      <div class="name">${esc(name)}</div>
      <div class="desc">${esc(desc)}</div>
    </div>`).join('');

  const faqHtml = book.faqs.map(([q, a]) => `
    <div class="faq-item">
      <h3>${esc(q)}</h3>
      <p>${esc(a)}</p>
    </div>`).join('');

  const pathLinks = book.paths.map(([href, label]) => `<a href="${esc(href)}">${esc(label)}</a>`).join('\n      ');
  const paperback = book.paperback
    ? `\n        <a class="ghost" href="${esc(book.paperback)}" target="_blank" rel="noopener">Hardcover on Amazon.in <span class="arrow">↗</span></a>`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(book.description)}">
  <meta name="author" content="Vinay Pasricha">
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
  <meta name="publisher" content="Vinay Pasricha">

  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(book.description)}">
  <meta property="og:type" content="book">
  <meta property="og:url" content="${url}">
  <meta property="og:site_name" content="vinaypasricha.com">
  <meta property="og:locale" content="en_US">
  <meta property="og:image" content="${ORIGIN}/assets/images/brand/og-image.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(book.description)}">
  <meta name="twitter:image" content="${ORIGIN}/assets/images/brand/og-image.png">

  <link rel="canonical" href="${url}">
${hreflang('/books/' + book.slug)}

  <link rel="icon" type="image/png" sizes="32x32" href="/assets/images/brand/favicon-32.png">
  <link rel="icon" type="image/png" sizes="16x16" href="/assets/images/brand/favicon-16.png">
  <link rel="apple-touch-icon" sizes="180x180" href="/assets/images/brand/apple-touch-icon.png">
  <link rel="manifest" href="/site.webmanifest">

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300;0,6..72,400;0,6..72,500;1,6..72,400&family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&family=Noto+Serif:ital,wght@0,400;0,500;1,400&family=Noto+Sans:wght@400;500;600&family=Noto+Sans+Devanagari:wght@400;500&family=Noto+Sans+Bengali:wght@400;500&family=Noto+Sans+Tamil:wght@400;500&family=Noto+Sans+Telugu:wght@400;500&family=Noto+Sans+Kannada:wght@400;500&family=Noto+Sans+SC:wght@400;500&family=Noto+Sans+KR:wght@400;500&display=swap" rel="stylesheet">

  <link rel="stylesheet" href="/css/site.css">
  <link rel="stylesheet" href="/css/i18n.css">
  <link rel="stylesheet" href="/css/book-page.css">

  <script type="application/ld+json">${jsonLd(book)}</script>
</head>
<body>

<header class="topbar">
  <a href="/" class="brand">
    <span class="name">Vinay <em>Pasricha</em></span>
    <span class="subtitle">Explorer of Emergence</span>
  </a>
  <div class="now-line">
    <span class="key">Now</span>
    <span class="now-rotator">
      <span class="item">Publishing <em style="font-family:var(--serif);font-style:italic;text-transform:none;letter-spacing:0;font-size:13px;margin-left:4px">across languages</em></span>
      <span class="item">Building <em style="font-family:var(--serif);font-style:italic;text-transform:none;letter-spacing:0;font-size:13px;margin-left:4px">GoodSpace AI</em></span>
      <span class="item">Running <em style="font-family:var(--serif);font-style:italic;text-transform:none;letter-spacing:0;font-size:13px;margin-left:4px">a live cohort</em></span>
    </span>
  </div>
  <div class="right">
    <button class="index-btn" aria-label="Open index">
      <span class="lines"><span></span><span></span></span>
      <span>Index</span>
    </button>
    <div class="lang-switch">
      <button class="lang-btn" aria-haspopup="listbox" aria-expanded="false">
        <span class="label">EN</span>
        <span class="caret">▾</span>
      </button>
      <div class="lang-menu" role="listbox">
        <div class="heading">Choose a language</div>
        <a href="#" class="current"><span class="code">EN</span><span class="native">English</span></a>
        <a href="#"><span class="code">HI</span><span class="native">हिंदी</span></a>
        <a href="#"><span class="code">BN</span><span class="native">বাংলা</span></a>
        <a href="#"><span class="code">TA</span><span class="native">தமிழ்</span></a>
        <a href="#"><span class="code">TE</span><span class="native">తెలుగు</span></a>
        <a href="#"><span class="code">KN</span><span class="native">ಕನ್ನಡ</span></a>
        <a href="#"><span class="code">ES</span><span class="native">Español</span></a>
        <a href="#"><span class="code">FR</span><span class="native">Français</span></a>
        <a href="#"><span class="code">PT</span><span class="native">Português</span></a>
        <a href="#"><span class="code">JA</span><span class="native">日本語</span></a>
        <a href="#"><span class="code">ZH</span><span class="native">中文</span></a>
        <a href="#"><span class="code">KO</span><span class="native">한국어</span></a>
        <a href="#"><span class="code">RU</span><span class="native">Русский</span></a>
      </div>
    </div>
  </div>
</header>

<section class="page-hero">
  <div class="breadcrumb">
    <a href="/">Index</a>
    <span class="sep">/</span>
    <a href="/books">Books</a>
    <span class="sep">/</span>
    <span>${esc(book.title)}</span>
  </div>
  <div class="book-kicker"><span class="dot"></span><span>${esc(book.kicker)}</span></div>
  <h1 class="brutal">${esc(book.h1)}<em class="accent-word">.</em></h1>
  <p class="subtitle">by Vinay Pasricha · ${esc(book.subtitle)}</p>
  <p class="canonical">${book.synopsis}</p>
</section>

<section class="book-card" id="buy">
  <div class="book-card-inner">
    <div class="book-card-cover">
      <img src="${esc(book.cover)}" alt="${esc(book.alt)}" width="800" height="1200">
    </div>
    <div class="book-card-info">
      <div class="label">— The book</div>
      <h2>${titleEm(book.title)}.</h2>
      <p class="book-sub">${esc(book.subtitle)}</p>
      <div class="book-meta">
        ${metaBits.map((bit) => `<span>${esc(bit)}</span>`).join('\n        <span class="dot">·</span>\n        ')}
      </div>
      <div class="book-actions">
        <a class="primary" href="https://www.amazon.in/dp/${book.asin}" target="_blank" rel="noopener">Buy on Amazon <span class="arrow">↗</span></a>
        <a class="ghost" href="https://www.amazon.com/dp/${book.asin}" target="_blank" rel="noopener">Amazon.com <span class="arrow">↗</span></a>${paperback}
      </div>
    </div>
  </div>
</section>

<section class="book-for">
  <div class="label">— Who it is for</div>
  <h2>${book.audienceTitle}</h2>
  <p>${book.audience}</p>
</section>

<section class="pillars">
  <div class="pillars-intro">— Three key ideas</div>
  <div class="pillars-grid">
    ${ideaHtml}
  </div>
</section>

<section class="defense">
  <div class="label">— From the book</div>
  <p class="opener">${esc(book.excerptOpener)}</p>
  ${book.excerpt.map((para) => `<p>${esc(para)}</p>`).join('\n  ')}
  <p class="attribution">— <em>${esc(book.excerptNote)}</em></p>
</section>

<section class="book-faq" id="faq">
  <div class="label">— Reader questions</div>
  <h2>Before you <em>buy.</em></h2>
  ${faqHtml}
</section>

<section class="continuations">
  <div class="continuations-inner">
    <div class="label">— The other five</div>
    <div class="continuations-grid">${others(book)}
    </div>
    <nav class="book-paths" aria-label="Related pages">
      <a href="/books">All six books</a>
      ${pathLinks}
    </nav>
  </div>
</section>

<footer class="site-foot">
  <div class="foot-left">
    <div class="foot-brand">Vinay <em>Pasricha</em></div>
    <div class="foot-tag">"Before power is applied, reality must be examined hard enough to deserve action."</div>
  </div>
  <div class="foot-right">
    © 2026 · <a href="/">Index</a><a href="/books">Books</a><a href="/paths/watch">Watch</a><a href="/paths/connect">Connect</a>
  </div>
</footer>

<script src="/js/site.js"></script>
<script src="/js/i18n.js"></script>
<script src="/js/claude-bridge.js"></script>
</body>
</html>
`;
}

const outDir = path.join(root, 'books');
fs.mkdirSync(outDir, { recursive: true });
for (const book of BOOKS) {
  const html = page(book);
  const h1s = html.match(/<h1\b/g) || [];
  if (h1s.length !== 1) throw new Error(`${book.slug} has ${h1s.length} h1 tags`);
  fs.writeFileSync(path.join(outDir, book.slug + '.html'), html);
  console.log(`${book.slug}  title ${(`${book.title} by Vinay Pasricha`).length}  desc ${book.description.length}`);
}
