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

export interface MemoryClassifierContext {
  lastUserMessage?: string | null;
  lastAssistantResponse?: string | null;
  pendingConfirmation?: boolean;
  currentWorkflow?: string | null;
  hasPendingTask?: boolean;
}

export type MemoryCommand =
  | { type: 'remember'; content: string }
  | { type: 'prefer'; content: string }
  | { type: 'forget'; content: string }
  | { type: 'clear' }
  | { type: 'none' };

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
    const raw = localStorage.getItem(MEMORY_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as AssistantMemoryProfile;
        return {
          updatedAt: parsed.updatedAt || nowIso(),
          preferences: Array.isArray(parsed.preferences) ? parsed.preferences : [],
          frequentRequests: Array.isArray(parsed.frequentRequests) ? parsed.frequentRequests : [],
          savedFacts: Array.isArray(parsed.savedFacts) ? parsed.savedFacts : []
        };
      } catch (error) {
        console.error('Failed to parse local assistant memory:', error);
      }
    }
  }
  return createEmptyMemoryProfile();
};

export const saveAssistantMemory = (profile: AssistantMemoryProfile): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(MEMORY_KEY, JSON.stringify(profile));
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

/**
 * Enhanced memory command parser that uses conversation context
 * to determine if a statement is a memory command or task continuation.
 */
export const parseMemoryCommand = (message: string, context?: MemoryClassifierContext): MemoryCommand => {
  const trimmed = message.trim();
  const lower = trimmed.toLowerCase();

  if (!trimmed) return { type: 'none' };

  // Explicit clear commands
  if (lower === 'clear memory' || lower === 'forget everything') {
    return { type: 'clear' };
  }

  // Explicit "forget" command
  if (lower.startsWith('forget ')) {
    return { type: 'forget', content: trimmed.slice('forget '.length).trim() };
  }

  // --- Context-aware memory detection ---
  const wasUserAskedQuestion = context?.lastAssistantResponse
    ? /[\?\uFF1F]/.test(context.lastAssistantResponse)
    : false;

  const isProvidingLookupInfo =
    /(his|her|my|the|their)\s+(number|phone|email|id|name|address)\s+(is|:|was)/i.test(trimmed) ||
    /(number|phone|email|id)\s*(is|:|=)\s*[0-9a-z@\.]/i.test(trimmed) ||
    /^0?\d{8,12}$/.test(trimmed.replace(/[\s\-\(\)]/g, '')) ||
    /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmed);

  if (wasUserAskedQuestion && isProvidingLookupInfo) {
    return { type: 'none' };
  }

  const wasAskingForPatientInfo = context?.lastAssistantResponse
    ? /(full name|patient name|provide|tell me|what is|what's|please provide)\s.*(name|phone|number|email|id|identifier)/i.test(context.lastAssistantResponse)
    : false;

  if (wasAskingForPatientInfo) {
    return { type: 'none' };
  }

  if (context?.hasPendingTask && isProvidingLookupInfo) {
    return { type: 'none' };
  }

  // Only treat as "remember" if the user explicitly says so
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

  return { type: 'none' };
};

/**
 * Silently record a fact into memory without generating a response message.
 */
export const silentlyRememberFact = (
  profile: AssistantMemoryProfile,
  fact: string
): AssistantMemoryProfile => {
  return rememberFact(profile, fact);
};

/**
 * Check if a user message contains useful information that should be remembered
 * for later, even if not explicitly a memory command.
 */
export const extractMemoizableContent = (
  profile: AssistantMemoryProfile,
  message: string,
  context?: MemoryClassifierContext
): string | null => {
  const trimmed = message.trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();

  // Skip explicit memory commands (handled elsewhere)
  if (lower.startsWith('remember') || lower.startsWith('forget') || lower.startsWith('clear')) {
    return null;
  }

  // Skip greetings and simple acknowledgments
  if (/^(hi|hello|hey|ok|okay|thanks|thank you|yes|no|sure|great|good|bye)$/i.test(trimmed)) {
    return null;
  }

  // If user is responding to a question, don't extract memory
  const wasAskedQuestion = context?.lastAssistantResponse
    ? /[\?\uFF1F]/.test(context.lastAssistantResponse)
    : false;
  if (wasAskedQuestion) return null;

  // Extract phone-number facts
  const phoneMatch = trimmed.match(/(\d[\d\s\-\(\)]{6,}\d)/);
  if (phoneMatch) {
    const phone = phoneMatch[1].trim();
    const normalizeForCompare = (s: string) => s.toLowerCase().replace(/[\s\-\(\)]/g, '');
    const isAlreadyKnown = profile.savedFacts.some(f =>
      normalizeForCompare(f.fact).includes(normalizeForCompare(phone))
    );
    if (!isAlreadyKnown) {
      return `Phone number: ${phone}`;
    }
  }

  return null;
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

