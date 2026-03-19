export interface FrequentRequest {
  text: string;
  count: number;
  lastAsked: string;
}

export interface SavedFact {
  fact: string;
  addedAt: string;
}

export interface AssistantMemoryProfile {
  updatedAt: string;
  preferences: string[];
  frequentRequests: FrequentRequest[];
  savedFacts: SavedFact[];
}

const MEMORY_KEY = 'loli_memory_profile_v1';

const nowIso = () => new Date().toISOString();

export const createEmptyMemoryProfile = (): AssistantMemoryProfile => ({
  updatedAt: nowIso(),
  preferences: [],
  frequentRequests: [],
  savedFacts: []
});

export const loadAssistantMemory = (): AssistantMemoryProfile => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(MEMORY_KEY);
  }
  return createEmptyMemoryProfile();
};

export const saveAssistantMemory = (profile: AssistantMemoryProfile): void => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(MEMORY_KEY);
  }
};

export const buildMemoryMarkdown = (profile: AssistantMemoryProfile): string => {
  const lines: string[] = [];

  lines.push('# Loli Assistant Memory');
  lines.push('');
  lines.push(`_Last Updated: ${profile.updatedAt}_`);
  lines.push('');

  lines.push('## Preferences');
  if (!profile.preferences.length) {
    lines.push('- (none)');
  } else {
    profile.preferences.forEach(pref => lines.push(`- ${pref}`));
  }
  lines.push('');

  lines.push('## Frequently Asked Requests');
  if (!profile.frequentRequests.length) {
    lines.push('- (none)');
  } else {
    [...profile.frequentRequests]
      .sort((a, b) => b.count - a.count)
      .slice(0, 15)
      .forEach(req => {
        lines.push(`- ${req.text} (count: ${req.count}, last: ${req.lastAsked})`);
      });
  }
  lines.push('');

  lines.push('## Saved Facts');
  if (!profile.savedFacts.length) {
    lines.push('- (none)');
  } else {
    profile.savedFacts.forEach(fact => {
      lines.push(`- ${fact.fact} (saved: ${fact.addedAt})`);
    });
  }

  return lines.join('\n');
};

export const buildMemoryPromptSummary = (profile: AssistantMemoryProfile): string => {
  const topRequests = [...profile.frequentRequests]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map(req => `${req.text} (${req.count}x)`);

  const preferences = profile.preferences.slice(0, 5);
  const facts = profile.savedFacts.slice(-5).map(f => f.fact);

  const sections: string[] = ['User Memory Profile:'];
  sections.push(`- Preferences: ${preferences.length ? preferences.join('; ') : 'none recorded'}`);
  sections.push(`- Frequent requests: ${topRequests.length ? topRequests.join('; ') : 'none recorded'}`);
  sections.push(`- Saved facts: ${facts.length ? facts.join('; ') : 'none recorded'}`);

  return sections.join('\n');
};

const normalize = (text: string) =>
  text.toLowerCase().replace(/\s+/g, ' ').trim();

export const updateMemoryFromUserMessage = (
  profile: AssistantMemoryProfile,
  message: string
): AssistantMemoryProfile => {
  const cleanMessage = message.trim();
  if (!cleanMessage) return profile;

  const normalized = normalize(cleanMessage);
  const existing = profile.frequentRequests.find(req => normalize(req.text) === normalized);

  const frequentRequests = existing
    ? profile.frequentRequests.map(req =>
        normalize(req.text) === normalized
          ? { ...req, count: req.count + 1, lastAsked: nowIso() }
          : req
      )
    : [
        ...profile.frequentRequests,
        { text: cleanMessage, count: 1, lastAsked: nowIso() }
      ].slice(-50);

  return {
    ...profile,
    frequentRequests,
    updatedAt: nowIso()
  };
};

export type MemoryCommand =
  | { type: 'remember'; content: string }
  | { type: 'prefer'; content: string }
  | { type: 'forget'; content: string }
  | { type: 'clear' }
  | { type: 'none' };

export const parseMemoryCommand = (message: string): MemoryCommand => {
  const trimmed = message.trim();
  const lower = trimmed.toLowerCase();

  if (!trimmed) return { type: 'none' };

  if (lower === 'clear memory' || lower === 'forget everything') {
    return { type: 'clear' };
  }

  if (lower.startsWith('remember that ')) {
    return { type: 'remember', content: trimmed.slice('remember that '.length).trim() };
  }

  if (lower.startsWith('remember ')) {
    return { type: 'remember', content: trimmed.slice('remember '.length).trim() };
  }

  if (lower.startsWith('i prefer ')) {
    return { type: 'prefer', content: trimmed.slice('i prefer '.length).trim() };
  }

  if (lower.startsWith('my preference is ')) {
    return { type: 'prefer', content: trimmed.slice('my preference is '.length).trim() };
  }

  if (lower.startsWith('forget ')) {
    return { type: 'forget', content: trimmed.slice('forget '.length).trim() };
  }

  return { type: 'none' };
};

export const rememberFact = (
  profile: AssistantMemoryProfile,
  fact: string
): AssistantMemoryProfile => {
  const value = fact.trim();
  if (!value) return profile;
  const exists = profile.savedFacts.some(f => normalize(f.fact) === normalize(value));
  if (exists) return profile;

  return {
    ...profile,
    savedFacts: [...profile.savedFacts, { fact: value, addedAt: nowIso() }].slice(-100),
    updatedAt: nowIso()
  };
};

export const rememberPreference = (
  profile: AssistantMemoryProfile,
  preference: string
): AssistantMemoryProfile => {
  const value = preference.trim();
  if (!value) return profile;
  const exists = profile.preferences.some(p => normalize(p) === normalize(value));
  if (exists) return profile;

  return {
    ...profile,
    preferences: [...profile.preferences, value].slice(-30),
    updatedAt: nowIso()
  };
};

export const forgetMemoryItem = (
  profile: AssistantMemoryProfile,
  target: string
): AssistantMemoryProfile => {
  const normalized = normalize(target);
  if (!normalized) return profile;

  return {
    ...profile,
    preferences: profile.preferences.filter(p => !normalize(p).includes(normalized)),
    savedFacts: profile.savedFacts.filter(f => !normalize(f.fact).includes(normalized)),
    frequentRequests: profile.frequentRequests.filter(r => !normalize(r.text).includes(normalized)),
    updatedAt: nowIso()
  };
};

export const clearAssistantMemory = (): AssistantMemoryProfile => createEmptyMemoryProfile();
