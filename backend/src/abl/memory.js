import * as repo from './store.js';

export const MEMORY_FIELDS = [
  'goals', 'priorities', 'ai_exposure', 'challenges',
  'desired_output', 'execution_sequence', 'ved_constraint', 'ved_correction', 'ved_measurement',
  'candidate_projects', 'company_brain', 'selected_project', 'baseline', 'target',
  'owner', 'value_case', 'guardrails', 'next_actions',
];

export const STAGES = {
  participant: ['context', 'goals', 'ai_exposure', 'challenges', 'meeting_agenda', 'complete'],
  ved: ['output', 'sequence', 'constraint', 'correction', 'measurement', 'complete'],
  siv: ['candidates', 'comparison', 'company_brain', 'economics', 'decision', 'blueprint', 'complete'],
  continuing: ['check_in', 'evidence', 'adjustment', 'next_cycle'],
};

function cleanValue(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 8);
  if (typeof value === 'string') return value.trim().slice(0, 2000);
  return '';
}

export function sanitiseMemoryFields(input) {
  const out = {};
  if (!input || typeof input !== 'object') return out;
  for (const key of MEMORY_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(input, key)) continue;
    const value = cleanValue(input[key]);
    if ((Array.isArray(value) && value.length) || (!Array.isArray(value) && value)) out[key] = value;
  }
  return out;
}

export function validStage(mode, value) {
  return (STAGES[mode] || []).includes(value) ? value : null;
}

export function advanceStage(mode, current, proposed) {
  const stages = STAGES[mode] || [];
  const next = validStage(mode, proposed);
  if (!next) return validStage(mode, current);
  const currentIndex = stages.indexOf(current);
  return currentIndex > stages.indexOf(next) ? current : next;
}

function stageRows(mode, session, complete) {
  const labels = {
    participant: ['Company context', 'Course goals', 'Current AI exposure', 'Business challenges', 'Meeting agenda', 'Preparation complete'],
    ved: ['Desired output', 'Real execution sequence', 'Governing constraint', 'One correction', 'Measurement', 'Constraint report'],
    siv: ['Candidate projects', 'Projects compared', 'Company Brain lens', 'Baseline, target and value', 'First project selected', '90-day direction', 'Decision report'],
    continuing: ['Progress check-in', 'Evidence reviewed', 'Direction adjusted', 'Next cycle agreed'],
  };
  const stages = STAGES[mode] || [];
  const current = session && session.current_stage;
  const currentIndex = current ? stages.indexOf(current) : -1;
  return (labels[mode] || []).map((label, index) => ({
    id: stages[index] || `step-${index + 1}`,
    label,
    complete: !!complete || currentIndex > index || current === 'complete' || (currentIndex === index && index === stages.length - 1),
    current: !complete && currentIndex === index,
  }));
}

function compactNotes(notes, includePrivate) {
  return (notes || [])
    .filter((note) => includePrivate || note.visibility === 'course_memory')
    .map((note) => ({
      id: note.id, title: note.title, content: note.content,
      source_name: note.source_name || '', visibility: note.visibility,
      occurred_at: note.occurred_at, created_at: note.created_at,
    }));
}

export async function buildCourseMemory(participant, { includePrivate = false } = {}) {
  const [research, memory, outputs, notes, journey, ved, siv, continuing] = await Promise.all([
    repo.getResearch(participant.id), repo.getMemory(participant.id), repo.getOutputs(participant.id),
    repo.listNotes(participant.id), repo.getSession(participant.id, 'participant'),
    repo.getSession(participant.id, 'ved'), repo.getSession(participant.id, 'siv'),
    repo.getSession(participant.id, 'continuing'),
  ]);
  const output = (type) => outputs.find((item) => item.output_type === type) || null;
  const sharedNotes = compactNotes(notes, includePrivate);
  return {
    identity: {
      name: participant.name || '', company_name: participant.company_name || '',
      role_title: participant.role_title || '', company_website: participant.company_website || '',
    },
    business: (research && research.structured_context) || {},
    fields: (memory && memory.fields) || {},
    participant_note: (memory && memory.participant_note) || '',
    meeting_notes: sharedNotes,
    meeting_notes_count: sharedNotes.length,
    milestones: {
      participant: stageRows('participant', journey, !!(output('share_summary') && output('share_summary').participant_approved)),
      ved: stageRows('ved', ved, !!output('ved_report')),
      siv: stageRows('siv', siv, !!output('siv_report')),
      continuing: stageRows('continuing', continuing, false),
    },
    outputs: {
      preparation: output('course_preparation_brief') || output('use_case_map') || output('strategy_note'),
      ved: output('ved_report'),
      siv: output('siv_report'),
      blueprint: output('leadership_blueprint'),
      facilitator: includePrivate ? output('vinay_meeting_brief') : null,
    },
    updated_at: (memory && memory.updated_at) || participant.updated_at,
  };
}

export function memoryPromptBlock(memory, { includeMeetingNotes = true } = {}) {
  if (!memory) return '';
  const lines = [];
  const fields = memory.fields || {};
  for (const key of MEMORY_FIELDS) {
    const value = fields[key];
    if (!value || (Array.isArray(value) && !value.length)) continue;
    lines.push(`- ${key.replace(/_/g, ' ')}: ${Array.isArray(value) ? value.join('; ') : value}`);
  }
  if (memory.participant_note) lines.push(`- participant correction / added context: ${memory.participant_note}`);
  if (includeMeetingNotes) {
    for (const note of (memory.meeting_notes || []).slice(0, 6)) {
      lines.push(`- ${note.title || 'Meeting summary'} (${String(note.occurred_at || '').slice(0, 10)}): ${String(note.content || '').slice(0, 4000)}`);
    }
  }
  return lines.length ? `## Shared Course Memory — authoritative confirmed context\n${lines.join('\n')}` : '';
}
