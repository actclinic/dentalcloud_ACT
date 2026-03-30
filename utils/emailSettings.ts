export const EMAIL_SETTINGS_KEY = 'dc_email_settings';

export interface EmailSettings {
  enabled: boolean;
  senderName?: string;
  senderEmail?: string;
  messageNotificationsEnabled: boolean;
  updatedAt: string;
}

export const getDefaultEmailSettings = (): EmailSettings => ({
  enabled: false,
  senderName: 'DentalCloud',
  senderEmail: '',
  messageNotificationsEnabled: true,
  updatedAt: new Date().toISOString()
});

export const loadEmailSettings = (): EmailSettings => {
  const fallback = getDefaultEmailSettings();

  try {
    const stored = localStorage.getItem(EMAIL_SETTINGS_KEY);
    if (!stored) return fallback;

    const parsed = JSON.parse(stored);
    return {
      enabled: parsed?.enabled ?? fallback.enabled,
      senderName: parsed?.senderName ?? fallback.senderName,
      senderEmail: parsed?.senderEmail ?? fallback.senderEmail,
      messageNotificationsEnabled: parsed?.messageNotificationsEnabled ?? fallback.messageNotificationsEnabled,
      updatedAt: parsed?.updatedAt || fallback.updatedAt
    };
  } catch (error) {
    return fallback;
  }
};

export const saveEmailSettings = (settings: EmailSettings) => {
  localStorage.setItem(EMAIL_SETTINGS_KEY, JSON.stringify(settings));
};
