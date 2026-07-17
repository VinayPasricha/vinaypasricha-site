// Participant-facing copy. No secrets — safe to import in client components.

export const OPENING_COPY = `Welcome to your AI for Business Leaders preparation session.

This conversation is designed to help personalise your course experience and prepare Vinay for your one-on-one meeting.

I have some preliminary research about your company, but please correct me wherever I am wrong.

At the end, I will show you the summary that will be shared with Vinay. You can edit or remove anything sensitive before it is saved for Vinay.

You do not need to finish this in one sitting. Your session will be saved. You can leave and come back later using the same link.`;

export const PRIVACY_NOTICE = `This is a private preparation session for Vinay Pasricha's course, AI for Business Leaders. Your conversation is stored securely and used only to help personalise the course and prepare for your one-on-one with Vinay. Before anything is shared with Vinay, you will see the summary and can edit or remove anything sensitive. Please share only what you are comfortable sharing.`;

// Captured first regardless of the depth the participant chooses.
export const MEETING_PREP_ESSENTIALS = [
  "Company context",
  "Participant role",
  "Course goals",
  "Current AI exposure",
  "Top 3 business challenges",
  "What they want from the one-on-one with Vinay",
];

// Visible progress steps in the participant UI.
export const PROGRESS_STEPS = [
  { key: "personalisation", label: "Course Personalisation" },
  { key: "use_case", label: "Use-Case Discovery" },
  { key: "strategy", label: "Strategy Session" },
  { key: "reward", label: "Reward Ready" },
  { key: "summary_review", label: "Summary Review" },
];
