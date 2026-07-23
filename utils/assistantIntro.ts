export const LOLI_WELCOME_MESSAGE_ID = 'loli-welcome-v2';
export const LOLI_INTRO_VISIBLE_MS = 4500;
export const LOLI_INTRO_EXIT_MS = 450;

export const LOLI_WELCOME_MESSAGE = `Hi, I'm Loli — your AI clinical assistant.

I can help you review patient cases, think through treatment options, interpret medical history, and prepare clear clinical notes.

What would you like to work on?`;

interface IntroMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const isLoliWelcomeMessage = (message: IntroMessage): boolean => (
  message.role === 'assistant' && (
    message.id === LOLI_WELCOME_MESSAGE_ID ||
    message.content.includes("I'm Loli, your AI Clinical Assistant") ||
    message.content.includes("I'm Loli — your AI clinical assistant")
  )
);

export const isWelcomeOnlyConversation = (messages: IntroMessage[]): boolean => (
  messages.length === 1 && isLoliWelcomeMessage(messages[0])
);

export const isWelcomeMessage = (message: IntroMessage): boolean => isLoliWelcomeMessage(message);