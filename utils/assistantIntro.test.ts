import { describe, expect, it } from 'vitest';

import {
  LOLI_WELCOME_MESSAGE,
  LOLI_WELCOME_MESSAGE_ID,
  LOLI_INTRO_EXIT_MS,
  LOLI_INTRO_VISIBLE_MS,
  isWelcomeMessage,
  isWelcomeOnlyConversation
} from './assistantIntro';

const welcome = {
  id: LOLI_WELCOME_MESSAGE_ID,
  role: 'assistant' as const,
  content: LOLI_WELCOME_MESSAGE
};

describe('assistant intro presentation', () => {
  it('keeps the card readable before a short exit transition', () => {
    expect(LOLI_INTRO_VISIBLE_MS).toBe(4500);
    expect(LOLI_INTRO_EXIT_MS).toBe(450);
    expect(LOLI_INTRO_VISIBLE_MS).toBeGreaterThan(LOLI_INTRO_EXIT_MS);
  });

  it('recognizes the current welcome-only conversation', () => {
    expect(isWelcomeOnlyConversation([welcome])).toBe(true);
    expect(isWelcomeMessage(welcome)).toBe(true);
  });

  it('supports the previous saved welcome message', () => {
    expect(isWelcomeOnlyConversation([{
      id: '1',
      role: 'assistant',
      content: "👋 Hello! I'm Loli, your AI Clinical Assistant. I can help you with patient care."
    }])).toBe(true);
  });

  it('does not replay the intro after a user starts the conversation', () => {
    expect(isWelcomeOnlyConversation([
      welcome,
      { id: 'user-1', role: 'user', content: 'Show me today’s appointments.' }
    ])).toBe(false);
  });

  it('does not style ordinary assistant replies as welcome messages', () => {
    expect(isWelcomeMessage({
      id: 'assistant-2',
      role: 'assistant',
      content: 'Here are today’s appointments.'
    })).toBe(false);
  });
});