// Ordered video ids for book and path pages.
// Source: the book-embeds list (best first, long-form preferred).
// The Signal lists one video and asks for a Related label.

export const BOOK_EMBEDS = {
  'ai-for-business-leaders': {
    ids: ['hPfffrKtHWw', 'Clp0lARA_Xw', 'bsiwM796fxQ', 'YJIukVVO924', 'x7XqEwYObmY'],
  },
  'siv-method': {
    ids: ['V4JFNB1dJS8', 'PlLJtfwrqGQ', 'LKzxs7hjLmg', 'CuZposKXu0Y', 'FWknG4jZDUE'],
  },
  'execution-doctrine': {
    ids: ['46sXjH5HCRE', 'S593sqZRLY0', 'Saie_7FYnaw', 'zjfjYZDR2qk', '9p9KzBxCKD4'],
  },
  'organizational-frequency': {
    ids: ['ifyw6MQz-MQ', 'q5h5b2SI04Q', 'sBK5P2EU8Mk', '8OXPQ1KqK9M', 'jz2H9oeeYgs'],
  },
  'the-signal': {
    ids: ['1IUcqi97ueA'],
    related: true,
  },
  civilization: {
    ids: ['llpY884VapU', 'h2C9IUrHLzI', '1IUcqi97ueA'],
  },
};

export const PATH_EMBEDS = {
  'ai-for-business': {
    ids: ['hPfffrKtHWw', 'YJIukVVO924', 'Clp0lARA_Xw', 'x7XqEwYObmY', 'k3u2SIMtXiE'],
  },
  course: {
    ids: ['hPfffrKtHWw', 'Clp0lARA_Xw', 'bsiwM796fxQ', 'YJIukVVO924'],
  },
  decisions: {
    ids: ['V4JFNB1dJS8', 'CuZposKXu0Y', 'PlLJtfwrqGQ', 'LKzxs7hjLmg', 'FWknG4jZDUE'],
  },
  execute: {
    ids: ['46sXjH5HCRE', 'S593sqZRLY0', 'Saie_7FYnaw', '9p9KzBxCKD4', 'zjfjYZDR2qk'],
  },
  hire: {
    ids: ['ifyw6MQz-MQ', '8OXPQ1KqK9M', 'sBK5P2EU8Mk', 'jz2H9oeeYgs', 'YJIukVVO924'],
  },
  career: {
    ids: ['q5h5b2SI04Q', '-9MpB9-dJH0', 'VGUhmOzQz_w'],
  },
  'find-work': {
    ids: ['q5h5b2SI04Q', 'VGUhmOzQz_w', '-9MpB9-dJH0', '8OXPQ1KqK9M'],
    captions: {
      '8OXPQ1KqK9M': 'The best roles find people who aren’t looking.',
    },
  },
  civilization: {
    ids: ['llpY884VapU', 'h2C9IUrHLzI', '1IUcqi97ueA'],
  },
};

export const TOPIC_ORDER = [
  'AI for Business',
  'Decisions & the SIV Method',
  'Execution',
  'Hiring & Organizational Frequency',
  'Career & Finding Work',
  'Civilization & the Future',
  'Learning & Thinking',
  'India & Systems',
];
