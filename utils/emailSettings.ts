import { supabase } from '../services/supabase';

export const EMAIL_SETTINGS_KEY = 'dc_email_settings';

const APP_SETTINGS_SINGLETON_ID = 1;

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

const normalizeEmailSettingsRow = (row: any, fallback = getDefaultEmailSettings()): EmailSettings => ({
  enabled: row?.email_delivery_enabled ?? fallback.enabled,
  senderName: row?.email_sender_name ?? fallback.senderName,
  senderEmail: row?.email_sender_email ?? fallback.senderEmail,
  messageNotificationsEnabled: row?.email_message_notifications_enabled ?? fallback.messageNotificationsEnabled,
  updatedAt: row?.email_settings_updated_at || row?.updated_at || fallback.updatedAt
});

export const loadEmailSettingsAsync = async (): Promise<EmailSettings> => {
  const fallback = loadEmailSettings();

  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('email_delivery_enabled, email_sender_name, email_sender_email, email_message_notifications_enabled, email_settings_updated_at, updated_at')
      .eq('id', APP_SETTINGS_SINGLETON_ID)
      .maybeSingle();

    if (error || !data) {
      return fallback;
    }

    const settings = normalizeEmailSettingsRow(data, fallback);
    saveEmailSettings(settings);
    return settings;
  } catch (error) {
    return fallback;
  }
};

export const saveEmailSettingsAsync = async (settings: EmailSettings): Promise<EmailSettings> => {
  const nextSettings: EmailSettings = {
    ...settings,
    senderName: settings.senderName?.trim() || 'DentalCloud',
    senderEmail: settings.senderEmail?.trim() || '',
    updatedAt: settings.updatedAt || new Date().toISOString()
  };

  const payload = {
    id: APP_SETTINGS_SINGLETON_ID,
    email_delivery_enabled: nextSettings.enabled,
    email_sender_name: nextSettings.senderName || null,
    email_sender_email: nextSettings.senderEmail || null,
    email_message_notifications_enabled: nextSettings.messageNotificationsEnabled,
    email_settings_updated_at: nextSettings.updatedAt,
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase
    .from('app_settings')
    .upsert(payload);

  if (error) {
    throw new Error(error.message);
  }

  saveEmailSettings(nextSettings);
  return nextSettings;
};
