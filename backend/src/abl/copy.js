// Shared ABL copy + config used by the prompts and (mirrored) by the frontend.

export const OPENING_COPY = `Welcome to your AI for Business Leaders preparation session.

This conversation is designed to help personalise your course experience and prepare Vinay for your one-on-one meeting.

I have some preliminary research about your company, but please correct me wherever I am wrong.

At the end, I will show you the summary that will be shared with Vinay. You can edit or remove anything sensitive before it is saved for Vinay.

You do not need to finish this in one sitting. Your session will be saved. You can leave and come back later using the same link.`;

export const PRIVACY_NOTICE = `This is a private preparation session for Vinay Pasricha's course, AI for Business Leaders. Your conversation is stored securely and used only to help personalise the course and prepare for your one-on-one with Vinay. Before anything is shared with Vinay, you will see the summary and can edit or remove anything sensitive. Please share only what you are comfortable sharing.`;

// Captured first regardless of the depth the participant chooses.
export const MEETING_PREP_ESSENTIALS = [
  'Company context',
  'Participant role',
  'Course goals',
  'Current AI exposure',
  'Top 3 business challenges',
  'What they want from the one-on-one with Vinay',
];

export const PROGRESS_STEPS = [
  { key: 'personalisation', label: 'Course Personalisation' },
  { key: 'use_case', label: 'Use-Case Discovery' },
  { key: 'strategy', label: 'Strategy Session' },
  { key: 'reward', label: 'Reward Ready' },
  { key: 'summary_review', label: 'Summary Review' },
];

export const DEPTHS = [
  { id: '15', minutes: '15 minutes', title: 'Course Personalisation Interview',
    blurb: 'Best if you want to quickly help Vinay understand your company, role, current AI exposure, learning goals, and what you want from the course.',
    reward: 'Course Preparation Brief' },
  { id: '30', minutes: '30 minutes', title: 'AI Use-Case Discovery',
    blurb: 'Best if you want to explore where AI may or may not be relevant in your company.',
    reward: 'AI Opportunity & Use-Case Map' },
  { id: '45', minutes: '45 minutes', title: 'AI Strategy Session',
    blurb: 'Best if you want a deeper first draft of possible AI priorities, risks, readiness gaps, and a sensible 90-day direction.',
    reward: 'Personalised AI Strategy Note + 90-Day Direction' },
];

export const QA_ITEMS = [
  { key: 'name_correct', label: 'Participant name is correct' },
  { key: 'company_correct', label: 'Company name is correct' },
  { key: 'role_correct', label: 'Role / context is correct' },
  { key: 'research_fields', label: 'Research fields are loaded' },
  { key: 'research_dossier', label: 'Research dossier is loaded' },
  { key: 'greets', label: 'Agent greets correctly' },
  { key: 'offers_journeys', label: 'Agent offers 15 / 30 / 45 minute journey' },
  { key: 'no_readiness_assumption', label: 'Agent does not assume AI implementation readiness' },
  { key: 'intelligent_questions', label: 'Agent asks intelligent questions' },
  { key: 'uses_framework', label: 'Agent uses the course / book framework appropriately' },
  { key: 'humble_research', label: 'Agent is humble about research and asks participant to correct it' },
  { key: 'privacy_notice', label: 'Privacy / sharing notice appears' },
  { key: 'reward_works', label: 'Reward generation works' },
  { key: 'vinay_brief_works', label: 'Vinay brief generation works' },
];

export const REWARD_TITLES = {
  course_preparation_brief: 'Course Preparation Brief',
  use_case_map: 'AI Opportunity & Use-Case Map',
  strategy_note: 'Personalised AI Strategy Note + 90-Day Direction',
};

export const MAX_MESSAGES_DEFAULT = 200;
export const SOFT_WARN_AT = 180;
