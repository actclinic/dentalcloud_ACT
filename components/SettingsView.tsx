import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, DollarSign, MapPin, Award, Plus, Trash2, RotateCcw } from 'lucide-react';
import { Location, LoyaltyRule, S3Settings } from '../types';
import { Modal, Input } from './Shared';
import { api } from '../services/api';
import { EMAIL_SETTINGS_KEY, EmailSettings, loadEmailSettings, saveEmailSettings as persistEmailSettings } from '../utils/emailSettings';

interface SettingsViewProps {
  currency: 'USD' | 'MMK';
  onCurrencyChange: (currency: 'USD' | 'MMK') => void;
  locations: Location[];
  currentLocationId: string;
  onLocationChange: (locationId: string) => void;
  onAddLocation: (loc: Partial<Location>) => void;
  loyaltyRules: LoyaltyRule[];
  onUpdateLoyaltyRule: (id: string, data: Partial<LoyaltyRule>) => void;
  onCreateLoyaltyRule: (data: Partial<LoyaltyRule>) => void;
  onDeleteLoyaltyRule?: (id: string) => void;
  onResetAllLoyaltyPoints?: () => void;
  loyaltyEnabled: boolean;
  onToggleLoyalty: (enabled: boolean) => void;
  messagingEnabled: boolean;
  onToggleMessaging: (enabled: boolean) => void;
  onRemoveAllMessages: () => void;
  isAdmin: boolean;
}

interface ManagerContact {
  id: string;
  email: string;
  name?: string;
  role?: string;
  isPrimary?: boolean;
  createdAt: string;
  updatedAt: string;
}

const SettingsView: React.FC<SettingsViewProps> = ({ 
  currency, 
  onCurrencyChange, 
  locations, 
  currentLocationId,
  onLocationChange,
  onAddLocation, 
  loyaltyRules,
  onUpdateLoyaltyRule,
  onCreateLoyaltyRule,
  onDeleteLoyaltyRule,
  onResetAllLoyaltyPoints,
  loyaltyEnabled,
  onToggleLoyalty,
  messagingEnabled,
  onToggleMessaging,
  onRemoveAllMessages,
  isAdmin 
}) => {
  const MANAGER_EMAILS_KEY = 'loli_manager_emails';

  const normalizeEmail = (email: string) => email.trim().toLowerCase();
  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const loadManagerContacts = (): ManagerContact[] => {
    try {
      const stored = localStorage.getItem(MANAGER_EMAILS_KEY);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  };

  const [showLocModal, setShowLocModal] = useState(false);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [newLoc, setNewLoc] = useState<Partial<Location>>({ name: '', address: '', phone: '' });
  const [newRule, setNewRule] = useState<Partial<LoyaltyRule>>({ 
    name: '', 
    event_type: 'TREATMENT', 
    points_per_unit: 0.001, 
    active: true 
  });
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [emailSettings, setEmailSettings] = useState<EmailSettings>(() => loadEmailSettings());
  const [managerContacts, setManagerContacts] = useState<ManagerContact[]>(() => loadManagerContacts());
  const [managerForm, setManagerForm] = useState<{ email: string; name: string; role: string; primary: boolean }>({
    email: '',
    name: '',
    role: '',
    primary: false
  });
  const [managerError, setManagerError] = useState<string>('');
  const [testEmail, setTestEmail] = useState<string>('');
  const [testStatus, setTestStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState<string>('');
  const [emailSettingsMessage, setEmailSettingsMessage] = useState<string>('');
  const [s3Settings, setS3Settings] = useState<S3Settings>({
    url: '',
    accessKey: '',
    secretKey: '',
    region: ''
  });
  const [s3SettingsMessage, setS3SettingsMessage] = useState<string>('');

  const updateEmailSettings = (updates: Partial<EmailSettings>) => {
    setEmailSettingsMessage('');
    setEmailSettings(prev => ({
      ...prev,
      ...updates
    }));
  };

  const handleSaveEmailSettings = () => {
    const nextSettings: EmailSettings = {
      ...emailSettings,
      updatedAt: new Date().toISOString()
    };
    persistEmailSettings(nextSettings);
    setEmailSettings(nextSettings);
    setEmailSettingsMessage('Email settings saved. Refreshing...');
    window.location.reload();
  };

  const updateS3Settings = (updates: Partial<S3Settings>) => {
    setS3SettingsMessage('');
    setS3Settings(prev => ({
      ...prev,
      ...updates
    }));
  };

  const handleSaveS3Settings = async () => {
    try {
      const nextSettings: S3Settings = {
        ...s3Settings,
        url: s3Settings.url.trim(),
        accessKey: s3Settings.accessKey.trim(),
        secretKey: s3Settings.secretKey.trim(),
        region: s3Settings.region.trim()
      };
      await api.appSettings.saveS3Settings(nextSettings);
      setS3Settings(nextSettings);
      setS3SettingsMessage('S3 settings saved. Uploads will use the new bucket immediately.');
    } catch (error: any) {
      console.error('Failed to save S3 settings:', error);
      setS3SettingsMessage(error?.message || 'Failed to save S3 settings.');
    }
  };

  const saveManagerContacts = (contacts: ManagerContact[]) => {
    localStorage.setItem(MANAGER_EMAILS_KEY, JSON.stringify(contacts));
  };

  const handleAddManager = (e: React.FormEvent) => {
    e.preventDefault();
    setManagerError('');
    const email = normalizeEmail(managerForm.email);
    if (!email || !isValidEmail(email)) {
      setManagerError('Please enter a valid email address.');
      return;
    }
    const now = new Date().toISOString();
    const existingIndex = managerContacts.findIndex(c => c.email === email);
    let next = [...managerContacts];
    const updatedContact: ManagerContact = {
      id: existingIndex >= 0 ? next[existingIndex].id : `mgr_${Date.now()}`,
      email,
      name: managerForm.name.trim() || undefined,
      role: managerForm.role.trim() || undefined,
      isPrimary: managerForm.primary || next.length === 0,
      createdAt: existingIndex >= 0 ? next[existingIndex].createdAt : now,
      updatedAt: now
    };

    if (existingIndex >= 0) {
      next[existingIndex] = updatedContact;
    } else {
      next.push(updatedContact);
    }

    if (updatedContact.isPrimary) {
      next = next.map(c => c.email === updatedContact.email ? updatedContact : { ...c, isPrimary: false });
    }

    saveManagerContacts(next);
    setManagerContacts(next);
    setManagerForm({ email: '', name: '', role: '', primary: false });
  };

  const handleRemoveManager = (email: string) => {
    let next = managerContacts.filter(c => c.email !== email);
    if (next.length > 0 && !next.some(c => c.isPrimary)) {
      next[0] = { ...next[0], isPrimary: true, updatedAt: new Date().toISOString() };
    }
    saveManagerContacts(next);
    setManagerContacts(next);
  };

  const handleSetPrimaryManager = (email: string) => {
    const next = managerContacts.map(c => ({
      ...c,
      isPrimary: c.email === email
    }));
    saveManagerContacts(next);
    setManagerContacts(next);
  };

  useEffect(() => {
    // Clean up legacy mock outbox data
    localStorage.removeItem('dc_email_outbox');

    // Migrate legacy settings shape if present
    const stored = localStorage.getItem(EMAIL_SETTINGS_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed?.mode !== undefined) {
          const migrated: EmailSettings = {
            enabled: parsed.mode === 'provider',
            senderName: parsed.senderName || 'DentalCloud',
            senderEmail: parsed.senderEmail || '',
            messageNotificationsEnabled: true,
            updatedAt: new Date().toISOString()
          };
          persistEmailSettings(migrated);
          setEmailSettings(migrated);
        }
      } catch (error) {
        // Ignore malformed legacy settings
      }
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    api.appSettings.getS3Settings()
      .then((settings) => {
        if (isMounted) {
          setS3Settings(settings);
        }
      })
      .catch((error) => {
        console.warn('Failed to load S3 settings:', error);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!testEmail && managerContacts.length > 0) {
      const primary = managerContacts.find(c => c.isPrimary);
      setTestEmail(primary?.email || managerContacts[0]?.email || '');
    }
  }, [managerContacts, testEmail]);

  const handleSendTestEmail = async () => {
    setTestMessage('');
    if (!emailSettings.enabled) {
      setTestStatus('error');
      setTestMessage('Email delivery is disabled. Enable it first.');
      return;
    }
    if (!emailSettings.senderEmail?.trim()) {
      setTestStatus('error');
      setTestMessage('Please set a sender email in Settings.');
      return;
    }
    const recipient = normalizeEmail(testEmail);
    if (!recipient || !isValidEmail(recipient)) {
      setTestStatus('error');
      setTestMessage('Please enter a valid recipient email.');
      return;
    }

    try {
      setTestStatus('sending');
      await api.email.sendManagerEmail({
        to: recipient,
        subject: 'DentalCloud Test Email',
        body: 'This is a test email from DentalCloud. Your Resend + Supabase Edge setup is working.',
        fromName: emailSettings.senderName || undefined,
        fromEmail: emailSettings.senderEmail.trim()
      });
      setTestStatus('sent');
      setTestMessage('Test email sent successfully.');
    } catch (error: any) {
      console.error('Test email failed:', error);
      setTestStatus('error');
      setTestMessage(error?.message || 'Failed to send test email.');
    }
  };

  const handleAddLoc = (e: React.FormEvent) => {
    e.preventDefault();
    onAddLocation(newLoc);
    setShowLocModal(false);
    setNewLoc({ name: '', address: '', phone: '' });
  };

  const handleRuleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRuleId) {
      onUpdateLoyaltyRule(editingRuleId, newRule);
    } else {
      onCreateLoyaltyRule(newRule);
    }
    setShowRuleModal(false);
    setEditingRuleId(null);
    setNewRule({ name: '', event_type: 'TREATMENT', points_per_unit: 0.001, active: true });
  };
  const currencySymbols = {
    USD: '$',
    MMK: 'Ks'
  };

  const currencyNames = {
    USD: 'US Dollar',
    MMK: 'Myanmar Kyat'
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden animate-fade-in">
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center gap-3 mb-2">
          <div className="bg-indigo-100 p-2 rounded-lg">
            <SettingsIcon className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">System Settings</h2>
            <p className="text-sm text-gray-500">Customize your clinic management system</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <div className="border border-emerald-100 rounded-xl p-6 bg-gradient-to-r from-emerald-50 to-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-700 mb-2">Connected Database</p>
              <h3 className="text-lg font-semibold text-gray-900">High Performance</h3>
              <p className="text-sm text-gray-600 mt-1">Your clinic system is connected and running with the primary database service.</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Online
            </div>
          </div>
        </div>

        {/* Currency Settings */}
        <div className="border border-gray-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <DollarSign className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-semibold text-gray-800">Currency Settings</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Select the currency to display throughout the system for all financial transactions and reports.
          </p>
          
          <div className="space-y-3">
            <label className="flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all hover:bg-gray-50"
              style={{ borderColor: currency === 'USD' ? '#4F46E5' : '#E5E7EB' }}>
              <input
                type="radio"
                name="currency"
                value="USD"
                checked={currency === 'USD'}
                onChange={() => onCurrencyChange('USD')}
                className="w-5 h-5 text-indigo-600 focus:ring-indigo-500"
              />
              <div className="flex-1">
                <div className="font-semibold text-gray-900">{currencyNames.USD}</div>
                <div className="text-sm text-gray-500">Symbol: {currencySymbols.USD}</div>
              </div>
              {currency === 'USD' && (
                <div className="w-2 h-2 rounded-full bg-indigo-600"></div>
              )}
            </label>

            <label className="flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all hover:bg-gray-50"
              style={{ borderColor: currency === 'MMK' ? '#4F46E5' : '#E5E7EB' }}>
              <input
                type="radio"
                name="currency"
                value="MMK"
                checked={currency === 'MMK'}
                onChange={() => onCurrencyChange('MMK')}
                className="w-5 h-5 text-indigo-600 focus:ring-indigo-500"
              />
              <div className="flex-1">
                <div className="font-semibold text-gray-900">{currencyNames.MMK}</div>
                <div className="text-sm text-gray-500">Symbol: {currencySymbols.MMK}</div>
              </div>
              {currency === 'MMK' && (
                <div className="w-2 h-2 rounded-full bg-indigo-600"></div>
              )}
            </label>
          </div>

          <div className="mt-4 p-3 bg-indigo-50 rounded-lg border border-indigo-100">
            <p className="text-xs text-indigo-700">
              <strong>Note:</strong> Currency changes will be applied immediately across all views including receipts, invoices, and financial reports.
            </p>
          </div>
        </div>

        {/* Location Management */}
        {isAdmin && (
          <div className="border border-gray-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <MapPin className="w-5 h-5 text-indigo-600" />
                <h3 className="text-lg font-semibold text-gray-800">Clinic Locations</h3>
              </div>
              <button 
                onClick={() => setShowLocModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Plus size={14} /> Add Location
              </button>
            </div>
            
            {/* Location Switcher */}
            <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                <MapPin size={10} /> Active Location
              </p>
              <select
                value={currentLocationId || ''}
                onChange={(e) => {
                  const locId = e.target.value;
                  if (locId) {
                    onLocationChange(locId);
                  }
                }}
                className="w-full bg-white text-gray-800 text-sm border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">Select a location</option>
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} {currentLocationId === loc.id ? '(Current)' : ''}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {locations.map(loc => (
                <div key={loc.id} className="p-4 border border-gray-100 rounded-xl bg-gray-50 flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-gray-900">{loc.name}</h4>
                    <p className="text-xs text-gray-500 mt-1">{loc.address}</p>
                    <p className="text-xs text-gray-500">{loc.phone}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Loyalty Program Settings */}
        <div className="border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Award className="w-5 h-5 text-indigo-600" />
              <h3 className="text-lg font-semibold text-gray-800">Loyalty Rewards Program</h3>
            </div>
            <div className="flex items-center gap-4">
              {isAdmin && (
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={loyaltyEnabled}
                    onChange={(e) => onToggleLoyalty(e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  <span className="ml-3 text-sm font-medium text-gray-700">{loyaltyEnabled ? 'System Enabled' : 'System Disabled'}</span>
                </label>
              )}
              {isAdmin && loyaltyEnabled && (
                <button 
                  onClick={() => {
                    setEditingRuleId(null);
                    setNewRule({ name: '', event_type: 'TREATMENT', points_per_unit: 0.001, active: true });
                    setShowRuleModal(true);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <Plus size={14} /> Add Rule
                </button>
              )}
            </div>
          </div>
          
          {!loyaltyEnabled ? (
            <div className="bg-gray-50 border border-gray-200 p-8 rounded-xl text-center">
              <Award className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">Loyalty points system is currently disabled for this practice.</p>
              <p className="text-xs text-gray-400 mt-1">Enable it to start rewarding patients for their visits and treatments.</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-6">
                Configure how patients earn points for treatments and purchases.
              </p>
              
              <div className="space-y-4">
            {loyaltyRules.length === 0 ? (
              <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl">
                <div className="flex items-center gap-2 text-amber-800 font-bold text-sm mb-2">
                  <Award size={16} /> No Custom Rules Defined
                </div>
                <p className="text-xs text-amber-700">
                  The system is using the default rate: 1 Point per 1,000 MMK spent.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {loyaltyRules.map(rule => (
                  <div key={rule.id} className={`p-4 border rounded-xl flex justify-between items-start ${rule.active ? 'bg-amber-50 border-amber-100' : 'bg-gray-50 border-gray-200 opacity-60'}`}>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-gray-900">{rule.name}</h4>
                        {!rule.active && <span className="text-[10px] bg-gray-200 px-1.5 py-0.5 rounded uppercase font-bold text-gray-500">Inactive</span>}
                      </div>
                      <p className="text-xs text-gray-600 mt-1">Event: <span className="font-semibold">{rule.event_type}</span></p>
                      <p className="text-xs text-amber-700 font-bold mt-1">
                        {rule.event_type === 'REDEEM' 
                          ? `Rate: 1 Point = ${rule.points_per_unit} units discount (Min ${rule.min_amount || 0} points)`
                          : `Rate: ${rule.points_per_unit * 1000} Points / 1000 units`
                        }
                      </p>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            setEditingRuleId(rule.id);
                            setNewRule(rule);
                            setShowRuleModal(true);
                          }}
                          className="p-1.5 hover:bg-amber-100 rounded-lg text-amber-700 transition-colors"
                        >
                          <SettingsIcon size={14} />
                        </button>
                        {onDeleteLoyaltyRule && (
                          <button 
                            onClick={() => onDeleteLoyaltyRule(rule.id)}
                            className="p-1.5 hover:bg-red-100 rounded-lg text-red-600 transition-colors"
                            title="Delete Rule"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          </>
          )}
        </div>

        {/* Messaging Settings */}
        {isAdmin && (
          <div className="border border-gray-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <h3 className="text-lg font-semibold text-gray-800">Messaging System</h3>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={messagingEnabled}
                  onChange={(e) => onToggleMessaging(e.target.checked)}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                <span className="ml-3 text-sm font-medium text-gray-700">{messagingEnabled ? 'System Enabled' : 'System Disabled'}</span>
              </label>
            </div>
            
            <p className="text-sm text-gray-600 mb-4">
              {messagingEnabled 
                ? 'Messaging system is currently enabled for patients and administrators.'
                : 'Messaging system is currently disabled. Patients will not be able to send messages.'}
            </p>
            
            <div className="flex gap-3">
              <button 
                onClick={onRemoveAllMessages}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-700 transition-colors"
              >
                <Trash2 size={16} /> Remove All Messages
              </button>
            </div>
            
            <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-100">
              <p className="text-xs text-amber-700">
                <strong>Warning:</strong> Removing all messages will permanently delete all conversations and cannot be undone.
              </p>
            </div>
          </div>
        )}

        {/* Email Delivery Settings */}
        {isAdmin && (
          <div className="border border-gray-200 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <h3 className="text-lg font-semibold text-gray-800">Email Delivery</h3>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Email delivery uses Supabase Edge Functions with Resend. Configure the sender and enable delivery here.
            </p>

            <div className="flex items-center justify-between mb-4">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={emailSettings.enabled}
                  onChange={(e) => updateEmailSettings({ enabled: e.target.checked })}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                <span className="ml-3 text-sm font-medium text-gray-700">{emailSettings.enabled ? 'Delivery Enabled' : 'Delivery Disabled'}</span>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Sender Name"
                value={emailSettings.senderName || ''}
                onChange={(e: any) => updateEmailSettings({ senderName: e.target.value })}
                placeholder="DentalCloud"
              />
              <Input
                label="Sender Email"
                type="email"
                value={emailSettings.senderEmail || ''}
                onChange={(e: any) => updateEmailSettings({ senderEmail: e.target.value })}
                placeholder="no-reply@yourdomain.com"
              />
            </div>

            <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <button
                type="button"
                onClick={handleSaveEmailSettings}
                className="w-full md:w-auto rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700"
              >
                Save Email Settings
              </button>
              {emailSettingsMessage && (
                <p className="text-xs text-emerald-600">{emailSettingsMessage}</p>
              )}
            </div>

            <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h4 className="text-sm font-semibold text-gray-800">Patient Message Reply Alerts</h4>
                  <p className="mt-1 text-xs text-gray-500">
                    Send one email when staff posts the first unread reply in a conversation. More replies wait until the patient opens the chat again.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={emailSettings.messageNotificationsEnabled}
                    onChange={(e) => updateEmailSettings({ messageNotificationsEnabled: e.target.checked })}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>
            </div>

            <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-100">
              <p className="text-xs text-amber-700">
                <strong>Resend note:</strong> The sender email must be from a verified domain in Resend. If you don’t have a domain yet, use a verified sender provided by Resend (for example, `onboarding@resend.dev` for testing).
              </p>
            </div>

            <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
              <h4 className="text-sm font-semibold text-gray-800 mb-3">Send Test Email</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                <div className="md:col-span-2">
                  <Input
                    label="Recipient Email"
                    type="email"
                    value={testEmail}
                    onChange={(e: any) => setTestEmail(e.target.value)}
                    placeholder="manager@example.com"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSendTestEmail}
                  disabled={testStatus === 'sending'}
                  className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-indigo-600/20 disabled:opacity-60"
                >
                  {testStatus === 'sending' ? 'Sending...' : 'Send Test'}
                </button>
              </div>
              {testMessage && (
                <p className={`text-xs mt-2 ${testStatus === 'error' ? 'text-red-600' : 'text-green-600'}`}>
                  {testMessage}
                </p>
              )}
            </div>

            <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-gray-800">Manager Emails</h4>
                <button
                  type="button"
                  onClick={() => setManagerForm(prev => ({ ...prev, primary: !prev.primary }))}
                  className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full border ${managerForm.primary ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300'}`}
                >
                  {managerForm.primary ? 'Primary' : 'Set Primary'}
                </button>
              </div>

              <form onSubmit={handleAddManager} className="space-y-3">
                <Input
                  label="Email"
                  type="email"
                  value={managerForm.email}
                  onChange={(e: any) => setManagerForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="boss@example.com"
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input
                    label="Name (Optional)"
                    value={managerForm.name}
                    onChange={(e: any) => setManagerForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Dr. Boss"
                  />
                  <Input
                    label="Role (Optional)"
                    value={managerForm.role}
                    onChange={(e: any) => setManagerForm(prev => ({ ...prev, role: e.target.value }))}
                    placeholder="manager"
                  />
                </div>
                {managerError && (
                  <p className="text-xs text-red-600">{managerError}</p>
                )}
                <button
                  type="submit"
                  className="w-full bg-indigo-600 text-white py-2 rounded-xl font-bold shadow-lg shadow-indigo-600/20"
                >
                  Save Manager Email
                </button>
              </form>

              <div className="mt-4 space-y-2">
                {managerContacts.length === 0 ? (
                  <p className="text-xs text-gray-500">No manager emails saved yet.</p>
                ) : (
                  managerContacts.map(contact => (
                    <div key={contact.id} className="flex items-start justify-between p-3 bg-white border border-gray-200 rounded-lg">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {contact.name ? `${contact.name} <${contact.email}>` : contact.email}
                        </p>
                        {contact.role && (
                          <p className="text-xs text-gray-500">{contact.role}</p>
                        )}
                        {contact.isPrimary && (
                          <span className="text-[10px] uppercase font-bold text-indigo-600">Primary</span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {!contact.isPrimary && (
                          <button
                            type="button"
                            onClick={() => handleSetPrimaryManager(contact.email)}
                            className="text-xs text-indigo-600 font-bold"
                          >
                            Set Primary
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveManager(contact.email)}
                          className="text-xs text-red-600 font-bold"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* S3 Setting */}
        {isAdmin && (
          <div className="border border-gray-200 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18M5 7v10a2 2 0 002 2h10a2 2 0 002-2V7M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2" />
              </svg>
              <h3 className="text-lg font-semibold text-gray-800">S3 Setting</h3>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Configure a custom S3 bucket for clinical file uploads. This overrides the default storage immediately after saving.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="URL"
                value={s3Settings.url}
                onChange={(e: any) => updateS3Settings({ url: e.target.value })}
                placeholder="https://your-bucket.s3.ap-southeast-1.amazonaws.com"
              />
              <Input
                label="Region"
                value={s3Settings.region}
                onChange={(e: any) => updateS3Settings({ region: e.target.value })}
                placeholder="ap-southeast-1"
              />
              <Input
                label="Access Key"
                value={s3Settings.accessKey}
                onChange={(e: any) => updateS3Settings({ accessKey: e.target.value })}
                placeholder="AKIA..."
              />
              <Input
                label="Secret Key"
                type="password"
                value={s3Settings.secretKey}
                onChange={(e: any) => updateS3Settings({ secretKey: e.target.value })}
                placeholder="********"
              />
            </div>

            <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <button
                type="button"
                onClick={handleSaveS3Settings}
                className="w-full md:w-auto rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700"
              >
                Save S3 Settings
              </button>
              {s3SettingsMessage && (
                <p className={`text-xs ${s3SettingsMessage.toLowerCase().includes('failed') ? 'text-red-600' : 'text-emerald-600'}`}>
                  {s3SettingsMessage}
                </p>
              )}
            </div>

            <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-100">
              <p className="text-xs text-amber-700">
                <strong>Note:</strong> The bucket must allow direct browser uploads and public reads (or provide signed access) for file previews.
              </p>
            </div>
          </div>
        )}

        {/* System Operations */}
        {isAdmin && onResetAllLoyaltyPoints && (
          <div className="border border-red-200 rounded-xl p-6 bg-red-50/30">
            <div className="flex items-center gap-3 mb-4">
              <RotateCcw className="w-5 h-5 text-red-600" />
              <h3 className="text-lg font-semibold text-red-800">Critical Operations</h3>
            </div>
            <p className="text-sm text-red-700 mb-6">
              These actions are irreversible and affect the entire system. Please proceed with caution.
            </p>
            
            <button 
              onClick={onResetAllLoyaltyPoints}
              className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-600/20"
            >
              <RotateCcw size={18} /> Restart All System Points
            </button>
          </div>
        )}

        {/* About Us Section */}
        <div className="border border-gray-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-800">About DentalCloud Pro</h3>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
            <p className="text-sm text-gray-700 leading-relaxed">
              This is the product developed by <span className="font-semibold text-indigo-600">WinterArc Myanmar Company Limited</span>. 
              If there is any issues, renew or upgrade the software, contact us:
            </p>
            
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <span className="text-sm font-medium text-gray-800">Phone:</span>
                <a href="tel:+959977144320" className="text-sm text-indigo-600 hover:underline">+959977144320</a>
              </div>
              
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="text-sm font-medium text-gray-800">Email:</span>
                <a href="mailto:winterarcmyanmar@yahoo.com" className="text-sm text-indigo-600 hover:underline">winterarcmyanmar@yahoo.com</a>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                © {new Date().getFullYear()} WinterArc Myanmar Company Limited. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </div>

      {showLocModal && (
        <Modal title="Add New Clinic Location" onClose={() => setShowLocModal(false)}>
          <form onSubmit={handleAddLoc} className="space-y-4">
            <Input label="Location Name" required value={newLoc.name} onChange={e => setNewLoc({...newLoc, name: e.target.value})} placeholder="e.g. Downtown Branch" />
            <Input label="Address" required value={newLoc.address} onChange={e => setNewLoc({...newLoc, address: e.target.value})} />
            <Input label="Phone" required value={newLoc.phone} onChange={e => setNewLoc({...newLoc, phone: e.target.value})} />
            <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-indigo-600/20">Create Location</button>
          </form>
        </Modal>
      )}

      {showRuleModal && (
        <Modal title={editingRuleId ? "Edit Loyalty Rule" : "Create Loyalty Rule"} onClose={() => setShowRuleModal(false)}>
          <form onSubmit={handleRuleSubmit} className="space-y-4">
            <Input label="Rule Name" required value={newRule.name} onChange={e => setNewRule({...newRule, name: e.target.value})} placeholder="e.g. Standard Treatment Points" />
            
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase mb-1.5">Event Type</label>
              <select 
                className="w-full border-gray-200 border rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500"
                value={newRule.event_type}
                onChange={e => setNewRule({...newRule, event_type: e.target.value as any})}
              >
                <option value="TREATMENT">Clinical Treatment (Earn)</option>
                <option value="PURCHASE">Medicine Purchase (Earn)</option>
                <option value="VISIT">Clinic Visit (Earn)</option>
                <option value="REDEEM">Points Redemption (Spend)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div>
                 <label className="block text-[10px] font-black text-gray-500 uppercase mb-1.5">
                   {newRule.event_type === 'REDEEM' ? 'Currency Value per Point' : 'Points per 1000 MMK'}
                 </label>
                 <input 
                   type="number" 
                   step={newRule.event_type === 'REDEEM' ? "1" : "0.1"}
                   className="w-full border-gray-200 border rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500"
                   value={newRule.event_type === 'REDEEM' ? (newRule.points_per_unit || 0) : (newRule.points_per_unit || 0) * 1000}
                   onChange={e => {
                     const val = parseFloat(e.target.value);
                     setNewRule({
                       ...newRule, 
                       points_per_unit: newRule.event_type === 'REDEEM' ? val : val / 1000
                     });
                   }}
                 />
               </div>
               <div>
                 <label className="block text-[10px] font-black text-gray-500 uppercase mb-1.5">
                   {newRule.event_type === 'REDEEM' ? 'Min Points to Redeem' : 'Min Amount to Earn'}
                 </label>
                 <input 
                   type="number" 
                   className="w-full border-gray-200 border rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500"
                   value={newRule.min_amount || 0}
                   onChange={e => setNewRule({...newRule, min_amount: parseFloat(e.target.value)})}
                 />
               </div>
            </div>

            <div className="flex items-center mt-2">
                 <label className="flex items-center gap-2 cursor-pointer">
                   <input 
                     type="checkbox"
                     checked={newRule.active}
                     onChange={e => setNewRule({...newRule, active: e.target.checked})}
                     className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                   />
                   <span className="text-sm font-medium text-gray-700">Active Rule</span>
                 </label>
               </div>

            <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-indigo-600/20">
              {editingRuleId ? "Update Rule" : "Create Rule"}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default SettingsView;

