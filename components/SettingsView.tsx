import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, DollarSign, MapPin, Award, Plus, Trash2, RotateCcw, Printer, Image as ImageIcon, Upload, Tags, CalendarRange, Activity, MessageCircle, Mail, HardDrive, Palette, Shield, Info } from 'lucide-react';
import { Location, LoyaltyRule, S3Settings, SupabaseStorageSettings, ReceiptSize, PatientType, AppointmentType } from '../types';
import { Modal, Input } from './Shared';
import { api } from '../services/api';
import { supabase } from '../services/supabase';
import { EMAIL_SETTINGS_KEY, EmailSettings, loadEmailSettings, loadEmailSettingsAsync, saveEmailSettings as persistEmailSettings, saveEmailSettingsAsync } from '../utils/emailSettings';

interface SettingsViewProps {
  currency: 'USD' | 'MMK';
  onCurrencyChange: (currency: 'USD' | 'MMK') => void;
  locations: Location[];
  currentLocationId: string;
  onLocationChange: (locationId: string) => Promise<void>;
  onAddLocation: (loc: Partial<Location>) => void;
  onUpdateLocation: (id: string, loc: Partial<Location>) => Promise<void>;
  onDeleteLocation: (id: string) => Promise<void>;
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
  clinicalFeeEnabled: boolean;
  clinicalFeeAmount: number;
  onSaveClinicalFeeSettings: (enabled: boolean, amount: number) => Promise<void>;
  patientTypes: PatientType[];
  appointmentTypes: AppointmentType[];
  onCreatePatientType: (data: Partial<PatientType>) => Promise<void>;
  onUpdatePatientType: (id: string, data: Partial<PatientType>) => Promise<void>;
  onDeletePatientType: (id: string) => Promise<void>;
  onCreateAppointmentType: (data: Partial<AppointmentType>) => Promise<void>;
  onUpdateAppointmentType: (id: string, data: Partial<AppointmentType>) => Promise<void>;
  onDeleteAppointmentType: (id: string) => Promise<void>;
  isAdmin: boolean;
  appName: string;
  appLogoUrl: string;
  onUploadAppLogo: (file: File) => Promise<void>;
  onDeleteAppLogo: () => Promise<void>;
  receiptInfo: { email: string; phone: string };
  onSaveReceiptInfo: (info: { email: string; phone: string }) => Promise<void>;
  receiptSize: ReceiptSize;
  onReceiptSizeChange: (size: ReceiptSize) => void;
  hoverTheme: 'blue' | 'green' | 'yellow' | 'brown' | 'dark';
  onHoverThemeChange: (theme: 'blue' | 'green' | 'yellow' | 'brown' | 'dark') => void;
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

interface SettingsTab {
  id: string;
  label: string;
  icon: React.ReactNode;
  adminOnly: boolean;
}

const SettingsView: React.FC<SettingsViewProps> = ({
  currency,
  onCurrencyChange,
  locations,
  currentLocationId,
  onLocationChange,
  onAddLocation,
  onUpdateLocation,
  onDeleteLocation,
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
  clinicalFeeEnabled,
  clinicalFeeAmount,
  onSaveClinicalFeeSettings,
  patientTypes,
  appointmentTypes,
  onCreatePatientType,
  onUpdatePatientType,
  onDeletePatientType,
  onCreateAppointmentType,
  onUpdateAppointmentType,
  onDeleteAppointmentType,
  isAdmin,
  appName,
  appLogoUrl,
  onUploadAppLogo,
  onDeleteAppLogo,
  receiptInfo,
  onSaveReceiptInfo,
  receiptSize,
  onReceiptSizeChange,
  hoverTheme,
  onHoverThemeChange
}) => {
  const tabs: SettingsTab[] = [
    { id: 'general', label: 'General', icon: <SettingsIcon size={18} />, adminOnly: false },
    { id: 'clinical', label: 'Clinical', icon: <Activity size={18} />, adminOnly: true },
    { id: 'rewards', label: 'Loyalty', icon: <Award size={18} />, adminOnly: false },
    { id: 'messaging', label: 'Messaging', icon: <MessageCircle size={18} />, adminOnly: true },
    { id: 'email', label: 'Email', icon: <Mail size={18} />, adminOnly: true },
    { id: 'storage', label: 'Storage', icon: <HardDrive size={18} />, adminOnly: true },
    { id: 'branding', label: 'Branding', icon: <Palette size={18} />, adminOnly: false },
    { id: 'system', label: 'System', icon: <Shield size={18} />, adminOnly: true },
  ];

  const [activeTab, setActiveTab] = useState<string>('general');

  const themeOptions: Array<{ value: 'blue' | 'green' | 'yellow' | 'brown' | 'dark'; label: string }> = [
    { value: 'blue', label: 'Blue' },
    { value: 'green', label: 'Green' },
    { value: 'yellow', label: 'Yellow' },
    { value: 'brown', label: 'Brown' },
    { value: 'dark', label: 'Dark' }
  ];
  const [appLogoMessage, setAppLogoMessage] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isDeletingLogo, setIsDeletingLogo] = useState(false);
  const [receiptEmailInput, setReceiptEmailInput] = useState<string>(receiptInfo.email);
  const [receiptPhoneInput, setReceiptPhoneInput] = useState<string>(receiptInfo.phone);
  const [receiptInfoMessage, setReceiptInfoMessage] = useState<string | null>(null);
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
  const [editingLoc, setEditingLoc] = useState<Location | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(currentLocationId);
  const [isSwitchingBranch, setIsSwitchingBranch] = useState(false);

  useEffect(() => {
    setSelectedBranchId(currentLocationId);
  }, [currentLocationId]);

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
  const [supabaseStorage, setSupabaseStorage] = useState<SupabaseStorageSettings>({
    storageUrl: '',
    anonKey: '',
    serviceKey: '',
    bucket: ''
  });
  const [supabaseStorageMessage, setSupabaseStorageMessage] = useState<string>('');
  const [clinicalFeeForm, setClinicalFeeForm] = useState<{ enabled: boolean; amount: number }>({
    enabled: clinicalFeeEnabled,
    amount: clinicalFeeAmount
  });
  const [clinicalFeeMessage, setClinicalFeeMessage] = useState<string>('');
  const [patientTypeForm, setPatientTypeForm] = useState<{ name: string; sort_order: string; is_active: boolean }>({
    name: '',
    sort_order: String(patientTypes.length),
    is_active: true
  });
  const [editingPatientTypeId, setEditingPatientTypeId] = useState<string | null>(null);
  const [patientTypeMessage, setPatientTypeMessage] = useState<string>('');
  const [appointmentTypeForm, setAppointmentTypeForm] = useState<{ name: string; sort_order: string; is_active: boolean }>({
    name: '',
    sort_order: String(appointmentTypes.length),
    is_active: true
  });
  const [editingAppointmentTypeId, setEditingAppointmentTypeId] = useState<string | null>(null);
  const [appointmentTypeMessage, setAppointmentTypeMessage] = useState<string>('');

  const updateEmailSettings = (updates: Partial<EmailSettings>) => {
    setEmailSettingsMessage('');
    setEmailSettings(prev => ({
      ...prev,
      ...updates
    }));
  };

  const handleSaveEmailSettings = async () => {
    const nextSettings: EmailSettings = {
      ...emailSettings,
      updatedAt: new Date().toISOString()
    };
    try {
      const savedSettings = await saveEmailSettingsAsync(nextSettings);
      setEmailSettings(savedSettings);
      setEmailSettingsMessage('Email settings saved and synced across devices.');
    } catch (error: any) {
      console.error('Failed to save email settings:', error);
      setEmailSettingsMessage(error?.message || 'Failed to save email settings.');
    }
  };

  const updateS3Settings = (updates: Partial<S3Settings>) => {
    setS3SettingsMessage('');
    setS3Settings(prev => ({
      ...prev,
      ...updates
    }));
  };

  const updateSupabaseStorage = (updates: Partial<SupabaseStorageSettings>) => {
    setSupabaseStorageMessage('');
    setSupabaseStorage(prev => ({
      ...prev,
      ...updates
    }));
  };

  const handleSaveSupabaseStorage = async () => {
    try {
      const nextSettings: SupabaseStorageSettings = {
        ...supabaseStorage,
        storageUrl: supabaseStorage.storageUrl.trim(),
        anonKey: supabaseStorage.anonKey.trim(),
        serviceKey: supabaseStorage.serviceKey.trim(),
        bucket: supabaseStorage.bucket.trim()
      };
      await api.appSettings.saveSupabaseStorage(nextSettings);
      setSupabaseStorage(nextSettings);
      setSupabaseStorageMessage('Supabase Storage settings saved. Uploads will use the new bucket immediately.');
    } catch (error: any) {
      console.error('Failed to save Supabase Storage settings:', error);
      setSupabaseStorageMessage(error?.message || 'Failed to save Supabase Storage settings.');
    }
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

  const handleSaveClinicalFee = async () => {
    try {
      setClinicalFeeMessage('');
      const normalizedAmount = Math.max(0, Number(clinicalFeeForm.amount || 0));
      await onSaveClinicalFeeSettings(clinicalFeeForm.enabled, normalizedAmount);
      setClinicalFeeForm(prev => ({ ...prev, amount: normalizedAmount }));
      setClinicalFeeMessage('Clinical fee settings saved successfully.');
    } catch (error: any) {
      console.error('Failed to save clinical fee settings:', error);
      setClinicalFeeMessage(error?.message || 'Failed to save clinical fee settings.');
    }
  };

  const resetPatientTypeForm = () => {
    setEditingPatientTypeId(null);
    setPatientTypeForm({
      name: '',
      sort_order: String(patientTypes.length),
      is_active: true
    });
  };

  const handleSavePatientType = async () => {
    const trimmedName = patientTypeForm.name.trim();
    if (!trimmedName) {
      setPatientTypeMessage('Patient type name is required.');
      return;
    }

    try {
      setPatientTypeMessage('');
      const payload: Partial<PatientType> = {
        name: trimmedName,
        sort_order: parseInt(patientTypeForm.sort_order, 10) || 0,
        is_active: patientTypeForm.is_active
      };

      if (editingPatientTypeId) {
        await onUpdatePatientType(editingPatientTypeId, payload);
        setPatientTypeMessage('Patient type updated successfully.');
      } else {
        await onCreatePatientType(payload);
        setPatientTypeMessage('Patient type created successfully.');
      }

      resetPatientTypeForm();
    } catch (error: any) {
      console.error('Failed to save patient type:', error);
      setPatientTypeMessage(error?.message || 'Failed to save patient type.');
    }
  };

  const handleEditPatientType = (patientType: PatientType) => {
    setPatientTypeMessage('');
    setEditingPatientTypeId(patientType.id);
    setPatientTypeForm({
      name: patientType.name || '',
      sort_order: String(patientType.sort_order ?? 0),
      is_active: patientType.is_active
    });
  };

  const handleDeletePatientType = async (patientType: PatientType) => {
    if (!window.confirm(`Delete patient type "${patientType.name}"?`)) {
      return;
    }

    try {
      setPatientTypeMessage('');
      await onDeletePatientType(patientType.id);
      if (editingPatientTypeId === patientType.id) {
        resetPatientTypeForm();
      }
      setPatientTypeMessage('Patient type deleted successfully.');
    } catch (error: any) {
      console.error('Failed to delete patient type:', error);
      setPatientTypeMessage(error?.message || 'Failed to delete patient type.');
    }
  };

  const resetAppointmentTypeForm = () => {
    setEditingAppointmentTypeId(null);
    setAppointmentTypeForm({
      name: '',
      sort_order: String(appointmentTypes.length),
      is_active: true
    });
  };

  const handleSaveAppointmentType = async () => {
    const trimmedName = appointmentTypeForm.name.trim();
    if (!trimmedName) {
      setAppointmentTypeMessage('Appointment type name is required.');
      return;
    }

    try {
      setAppointmentTypeMessage('');
      const payload: Partial<AppointmentType> = {
        name: trimmedName,
        sort_order: parseInt(appointmentTypeForm.sort_order, 10) || 0,
        is_active: appointmentTypeForm.is_active
      };

      if (editingAppointmentTypeId) {
        await onUpdateAppointmentType(editingAppointmentTypeId, payload);
        setAppointmentTypeMessage('Appointment type updated successfully.');
      } else {
        await onCreateAppointmentType(payload);
        setAppointmentTypeMessage('Appointment type created successfully.');
      }

      resetAppointmentTypeForm();
    } catch (error: any) {
      console.error('Failed to save appointment type:', error);
      setAppointmentTypeMessage(error?.message || 'Failed to save appointment type.');
    }
  };

  const handleEditAppointmentType = (appointmentType: AppointmentType) => {
    setAppointmentTypeMessage('');
    setEditingAppointmentTypeId(appointmentType.id);
    setAppointmentTypeForm({
      name: appointmentType.name || '',
      sort_order: String(appointmentType.sort_order ?? 0),
      is_active: appointmentType.is_active
    });
  };

  const handleDeleteAppointmentType = async (appointmentType: AppointmentType) => {
    if (!window.confirm(`Delete appointment type "${appointmentType.name}"?`)) {
      return;
    }

    try {
      setAppointmentTypeMessage('');
      await onDeleteAppointmentType(appointmentType.id);
      if (editingAppointmentTypeId === appointmentType.id) {
        resetAppointmentTypeForm();
      }
      setAppointmentTypeMessage('Appointment type deleted successfully.');
    } catch (error: any) {
      console.error('Failed to delete appointment type:', error);
      setAppointmentTypeMessage(error?.message || 'Failed to delete appointment type.');
    }
  };

  const handleAppLogoUpload = async (file?: File | null) => {
    if (!file) return;

    setAppLogoMessage(null);
    if (file.type !== 'image/png' || !file.name.toLowerCase().endsWith('.png')) {
      setAppLogoMessage('Only PNG logo files are allowed.');
      return;
    }

    try {
      setIsUploadingLogo(true);
      await onUploadAppLogo(file);
      setAppLogoMessage('Logo uploaded successfully.');
    } catch (error: any) {
      console.error('Failed to upload app logo:', error);
      setAppLogoMessage(error?.message || 'Failed to upload logo.');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleDeleteAppLogo = async () => {
    if (!appLogoUrl) return;
    if (!window.confirm('Remove the uploaded clinic logo? The app name will show again in the header and sidebar.')) return;

    try {
      setIsDeletingLogo(true);
      setAppLogoMessage(null);
      await onDeleteAppLogo();
      setAppLogoMessage('Logo removed successfully.');
    } catch (error: any) {
      console.error('Failed to remove app logo:', error);
      setAppLogoMessage(error?.message || 'Failed to remove logo.');
    } finally {
      setIsDeletingLogo(false);
    }
  };

  useEffect(() => {
    if (!editingPatientTypeId) {
      setPatientTypeForm((prev) => ({
        ...prev,
        sort_order: String(patientTypes.length)
      }));
    }
  }, [patientTypes, editingPatientTypeId]);

  useEffect(() => {
    if (!editingAppointmentTypeId) {
      setAppointmentTypeForm((prev) => ({
        ...prev,
        sort_order: String(appointmentTypes.length)
      }));
    }
  }, [appointmentTypes, editingAppointmentTypeId]);

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
    localStorage.removeItem('dc_email_outbox');
    let isMounted = true;

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
          saveEmailSettingsAsync(migrated).catch((error) => {
            console.warn('Failed to migrate email settings to shared storage:', error);
          });
          if (isMounted) setEmailSettings(migrated);
        }
      } catch (error) {
        // Ignore malformed legacy settings
      }
    }

    loadEmailSettingsAsync()
      .then((settings) => {
        if (isMounted) {
          setEmailSettings(settings);
        }
      })
      .catch((error) => {
        console.warn('Failed to load shared email settings:', error);
      });

    const settingsChannel = supabase
      .channel(`settings-shared-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_settings' },
        (payload) => {
          const row = payload.new as any;
          if (!row || row.id !== 1) return;

          const nextEmailSettings: EmailSettings = {
            enabled: row.email_delivery_enabled ?? false,
            senderName: row.email_sender_name || 'DentalCloud',
            senderEmail: row.email_sender_email || '',
            messageNotificationsEnabled: row.email_message_notifications_enabled ?? true,
            updatedAt: row.email_settings_updated_at || row.updated_at || new Date().toISOString()
          };
          persistEmailSettings(nextEmailSettings);
          setEmailSettings(nextEmailSettings);

          setSupabaseStorage({
            storageUrl: row.storage_url || '',
            anonKey: row.storage_anon_key || '',
            serviceKey: row.storage_service_key || '',
            bucket: row.storage_bucket || '',
            updated_at: row.updated_at
          });
          setS3Settings({
            url: row.s3_url || '',
            accessKey: row.s3_access_key || '',
            secretKey: row.s3_secret_key || '',
            region: row.s3_region || '',
            updated_at: row.updated_at
          });
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(settingsChannel);
    };
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
    
    api.appSettings.getSupabaseStorage()
      .then((settings) => {
        if (isMounted) {
          setSupabaseStorage(settings);
        }
      })
      .catch((error) => {
        console.warn('Failed to load Supabase Storage settings:', error);
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

  useEffect(() => {
    setClinicalFeeForm({
      enabled: clinicalFeeEnabled,
      amount: clinicalFeeAmount
    });
  }, [clinicalFeeEnabled, clinicalFeeAmount]);

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

  const handleEditLoc = (loc: Location) => {
    setEditingLoc(loc);
    setNewLoc({ name: loc.name, address: loc.address, phone: loc.phone });
    setShowLocModal(true);
  };

  const handleUpdateLoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLoc) return;
    await onUpdateLocation(editingLoc.id, newLoc);
    setShowLocModal(false);
    setEditingLoc(null);
    setNewLoc({ name: '', address: '', phone: '' });
  };

  const handleDeleteLoc = async (loc: Location) => {
    if (!window.confirm(`Are you sure you want to delete "${loc.name}"? This action cannot be undone.`)) return;
    await onDeleteLocation(loc.id);
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

  const visibleTabs = tabs.filter(t => !t.adminOnly || isAdmin);

  useEffect(() => {
    const firstVisible = visibleTabs[0]?.id;
    if (firstVisible && !visibleTabs.find(t => t.id === activeTab)) {
      setActiveTab(firstVisible);
    }
  }, [isAdmin, activeTab, visibleTabs]);

  const renderGeneralTab = () => (
    <div className="space-y-6">
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

      {isAdmin && (
        <div className="border border-gray-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <DollarSign className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-semibold text-gray-800">Patient Registration Clinical Fee</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Configure a default fee that can be applied to newly registered patients.
          </p>

          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={clinicalFeeForm.enabled}
                onChange={(e) => {
                  setClinicalFeeMessage('');
                  setClinicalFeeForm({ ...clinicalFeeForm, enabled: e.target.checked });
                }}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm font-medium text-gray-700">Enable clinical fee for new patient registration by default</span>
            </label>

            <Input
              label={`Clinical Fee Amount (${currencySymbols[currency]})`}
              type="number"
              min="0"
              step="0.01"
              value={clinicalFeeForm.amount}
              onChange={(e: any) => {
                setClinicalFeeMessage('');
                setClinicalFeeForm({ ...clinicalFeeForm, amount: parseFloat(e.target.value) || 0 });
              }}
            />

            <button
              type="button"
              onClick={handleSaveClinicalFee}
              className="w-full md:w-auto rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700"
            >
              Save Clinical Fee Settings
            </button>

            {clinicalFeeMessage && (
              <p className={`text-xs ${clinicalFeeMessage.toLowerCase().includes('failed') ? 'text-red-600' : 'text-emerald-600'}`}>
                {clinicalFeeMessage}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );

  const renderClinicalTab = () => (
    <div className="space-y-6">
      <div className="border border-gray-200 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Tags className="w-5 h-5 text-indigo-600" />
          <h3 className="text-lg font-semibold text-gray-800">Patient Type Management</h3>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Manage the patient type options shown in patient registration and profile edit forms.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6">
          <div className="space-y-3">
            {patientTypes.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-500 text-center">
                No patient types found yet.
              </div>
            ) : (
              patientTypes.map((patientType) => (
                <div key={patientType.id} className="rounded-xl border border-gray-200 bg-white p-4 flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-gray-900">{patientType.name}</h4>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide ${patientType.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'}`}>
                        {patientType.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Display order: {patientType.sort_order ?? 0}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleEditPatientType(patientType)}
                      className="px-3 py-1.5 rounded-lg border border-indigo-200 text-indigo-700 text-xs font-bold hover:bg-indigo-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeletePatientType(patientType)}
                      className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-bold hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-4 h-fit">
            <div className="flex items-center justify-between gap-3">
              <h4 className="font-semibold text-gray-900">{editingPatientTypeId ? 'Edit Patient Type' : 'Add Patient Type'}</h4>
              {editingPatientTypeId && (
                <button
                  type="button"
                  onClick={resetPatientTypeForm}
                  className="text-xs font-bold text-gray-500 hover:text-gray-700"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            <Input
              label="Patient Type Name"
              value={patientTypeForm.name}
              onChange={(e: any) => {
                setPatientTypeMessage('');
                setPatientTypeForm({ ...patientTypeForm, name: e.target.value });
              }}
              placeholder="e.g. Facebook Ads"
            />

            <Input
              label="Display Order"
              type="number"
              min="0"
              value={patientTypeForm.sort_order}
              onChange={(e: any) => {
                setPatientTypeMessage('');
                setPatientTypeForm({ ...patientTypeForm, sort_order: e.target.value });
              }}
            />

            <label className="flex items-center gap-3 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={patientTypeForm.is_active}
                onChange={(e) => {
                  setPatientTypeMessage('');
                  setPatientTypeForm({ ...patientTypeForm, is_active: e.target.checked });
                }}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              Show this type in patient forms
            </label>

            <button
              type="button"
              onClick={handleSavePatientType}
              className="w-full rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700"
            >
              {editingPatientTypeId ? 'Update Patient Type' : 'Create Patient Type'}
            </button>

            {patientTypeMessage && (
              <p className={`text-xs ${patientTypeMessage.toLowerCase().includes('failed') || patientTypeMessage.toLowerCase().includes('cannot') || patientTypeMessage.toLowerCase().includes('required') ? 'text-red-600' : 'text-emerald-600'}`}>
                {patientTypeMessage}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="border border-gray-200 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <CalendarRange className="w-5 h-5 text-indigo-600" />
          <h3 className="text-lg font-semibold text-gray-800">Appointment Type Management</h3>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Manage the options shown in the appointment form Type field without affecting your treatment service table.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6">
          <div className="space-y-3">
            {appointmentTypes.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-500 text-center">
                No appointment types found yet.
              </div>
            ) : (
              appointmentTypes.map((appointmentType) => (
                <div key={appointmentType.id} className="rounded-xl border border-gray-200 bg-white p-4 flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-gray-900">{appointmentType.name}</h4>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide ${appointmentType.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'}`}>
                        {appointmentType.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Display order: {appointmentType.sort_order ?? 0}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleEditAppointmentType(appointmentType)}
                      className="px-3 py-1.5 rounded-lg border border-indigo-200 text-indigo-700 text-xs font-bold hover:bg-indigo-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteAppointmentType(appointmentType)}
                      className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-bold hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-4 h-fit">
            <div className="flex items-center justify-between gap-3">
              <h4 className="font-semibold text-gray-900">{editingAppointmentTypeId ? 'Edit Appointment Type' : 'Add Appointment Type'}</h4>
              {editingAppointmentTypeId && (
                <button
                  type="button"
                  onClick={resetAppointmentTypeForm}
                  className="text-xs font-bold text-gray-500 hover:text-gray-700"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            <Input
              label="Appointment Type Name"
              value={appointmentTypeForm.name}
              onChange={(e: any) => {
                setAppointmentTypeMessage('');
                setAppointmentTypeForm({ ...appointmentTypeForm, name: e.target.value });
              }}
              placeholder="e.g. Follow-up"
            />

            <Input
              label="Display Order"
              type="number"
              min="0"
              value={appointmentTypeForm.sort_order}
              onChange={(e: any) => {
                setAppointmentTypeMessage('');
                setAppointmentTypeForm({ ...appointmentTypeForm, sort_order: e.target.value });
              }}
            />

            <label className="flex items-center gap-3 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={appointmentTypeForm.is_active}
                onChange={(e) => {
                  setAppointmentTypeMessage('');
                  setAppointmentTypeForm({ ...appointmentTypeForm, is_active: e.target.checked });
                }}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              Show this type in appointment forms
            </label>

            <button
              type="button"
              onClick={handleSaveAppointmentType}
              className="w-full rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700"
            >
              {editingAppointmentTypeId ? 'Update Appointment Type' : 'Create Appointment Type'}
            </button>

            {appointmentTypeMessage && (
              <p className={`text-xs ${appointmentTypeMessage.toLowerCase().includes('failed') || appointmentTypeMessage.toLowerCase().includes('required') ? 'text-red-600' : 'text-emerald-600'}`}>
                {appointmentTypeMessage}
              </p>
            )}
          </div>
        </div>
      </div>

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
        
        <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
            <MapPin size={10} /> Change Active Branch
          </p>
          <p className="text-xs text-gray-500 mb-3">
            Select a branch and click Save to switch. All data (patients, appointments, doctors, etc.) will reload for the selected branch.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={selectedBranchId || ''}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="flex-1 bg-white text-gray-800 text-sm border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              disabled={isSwitchingBranch}
            >
              <option value="">Select a branch</option>
              {locations.map(loc => (
                <option key={loc.id} value={loc.id}>
                  {loc.name} {currentLocationId === loc.id ? '(Current)' : ''}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={async () => {
                if (!selectedBranchId || selectedBranchId === currentLocationId) return;
                setIsSwitchingBranch(true);
                try {
                  await onLocationChange(selectedBranchId);
                } catch (err: any) {
                  console.error('Failed to switch branch:', err);
                  alert('Failed to switch branch: ' + (err?.message || 'Unknown error'));
                } finally {
                  setIsSwitchingBranch(false);
                }
              }}
              disabled={!selectedBranchId || selectedBranchId === currentLocationId || isSwitchingBranch}
              className="px-6 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-bold shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {isSwitchingBranch ? 'Switching...' : 'Save Branch'}
            </button>
          </div>
          {selectedBranchId && selectedBranchId !== currentLocationId && (
            <p className="mt-2 text-xs text-amber-600">
              You have unsaved changes. Click "Save Branch" to switch to <strong>{locations.find(l => l.id === selectedBranchId)?.name || selectedBranchId}</strong>.
            </p>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {locations.map(loc => (
            <div key={loc.id} className="p-4 border border-gray-100 rounded-xl bg-gray-50 flex justify-between items-start">
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-gray-900">{loc.name}</h4>
                <p className="text-xs text-gray-500 mt-1">{loc.address}</p>
                <p className="text-xs text-gray-500">{loc.phone}</p>
              </div>
              <div className="flex items-center gap-1 ml-3 shrink-0">
                <button
                  onClick={() => handleEditLoc(loc)}
                  className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                  title="Edit location"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                </button>
                <button
                  onClick={() => handleDeleteLoc(loc)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete location"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderRewardsTab = () => (
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
  );

  const renderMessagingTab = () => (
    <div className="border border-gray-200 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <MessageCircle className="w-5 h-5 text-indigo-600" />
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
  );

  const renderEmailTab = () => (
    <div className="border border-gray-200 rounded-xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <Mail className="w-5 h-5 text-indigo-600" />
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
          <strong>Resend note:</strong> The sender email must be from a verified domain in Resend. If you don't have a domain yet, use a verified sender provided by Resend (for example, `onboarding@resend.dev` for testing).
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
  );

  const renderStorageTab = () => (
    <div className="space-y-6">
      <div className="border border-emerald-200 rounded-xl p-6 bg-emerald-50/30">
        <div className="flex items-center gap-3 mb-4">
          <HardDrive className="w-5 h-5 text-emerald-600" />
          <h3 className="text-lg font-semibold text-emerald-800">Supabase Storage (Recommended)</h3>
          <span className="ml-auto text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-medium">Easy Setup</span>
        </div>

        <p className="text-sm text-emerald-700 mb-4">
          Use Supabase Storage REST API directly. No signature calculation needed — more reliable and easier to configure.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Storage URL"
            value={supabaseStorage.storageUrl}
            onChange={(e: any) => updateSupabaseStorage({ storageUrl: e.target.value })}
            placeholder="https://your-project.supabase.co"
          />
          <Input
            label="Bucket Name"
            value={supabaseStorage.bucket}
            onChange={(e: any) => updateSupabaseStorage({ bucket: e.target.value })}
            placeholder="patient_files"
          />
          <Input
            label="Anon/Publishable Key"
            value={supabaseStorage.anonKey}
            onChange={(e: any) => updateSupabaseStorage({ anonKey: e.target.value })}
            placeholder="sb_publishable_..."
          />
          <Input
            label="Service Role Key"
            type="password"
            value={supabaseStorage.serviceKey}
            onChange={(e: any) => updateSupabaseStorage({ serviceKey: e.target.value })}
            placeholder="sb_secret_..."
          />
        </div>

        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <button
            type="button"
            onClick={handleSaveSupabaseStorage}
            className="w-full md:w-auto rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700"
          >
            Save Supabase Storage Settings
          </button>
          {supabaseStorageMessage && (
            <p className={`text-xs ${supabaseStorageMessage.toLowerCase().includes('failed') ? 'text-red-600' : 'text-emerald-600'}`}>
              {supabaseStorageMessage}
            </p>
          )}
        </div>

        <div className="mt-4 p-3 bg-emerald-100/50 rounded-lg border border-emerald-200">
          <p className="text-xs text-emerald-700">
            <strong>Note:</strong> This method uses the Supabase REST API directly — no AWS Signature V4 required. Make sure the <code className="bg-white px-1 rounded">patient_files</code> bucket exists in your Supabase Storage dashboard.
          </p>
        </div>
      </div>

      <div className="border border-gray-200 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <HardDrive className="w-5 h-5 text-indigo-600" />
          <h3 className="text-lg font-semibold text-gray-800">S3-Compatible Storage (Advanced)</h3>
          <span className="ml-auto text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full font-medium">AWS Signature V4</span>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          Configure an S3-compatible bucket (AWS S3, Cloudflare R2, MinIO, etc.). Uses AWS Signature V4 signing.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="S3 URL"
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
            <strong>Advanced:</strong> Requires proper AWS Signature V4 implementation. May not work with all S3-compatible services (e.g., Supabase S3 API).
          </p>
        </div>
      </div>
    </div>
  );

  const renderBrandingTab = () => (
    <div className="space-y-6">
      <div className="border border-gray-200 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <ImageIcon className="w-5 h-5 text-indigo-600" />
          <h3 className="text-lg font-semibold text-gray-800">Clinic Logo</h3>
        </div>
        
        <p className="text-sm text-gray-600 mb-4">
          Upload a PNG logo to replace the app name in the header and sidebar. Browser tab names, receipts, and other document text stay unchanged.
        </p>
        
        <div className="flex flex-col md:flex-row gap-4 md:items-center">
          <div className="flex h-24 w-full md:w-56 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 p-4">
            {appLogoUrl ? (
              <img src={appLogoUrl} alt={`${appName} logo`} className="max-h-full max-w-full object-contain" />
            ) : (
              <div className="text-center text-xs font-semibold text-gray-400">No logo uploaded</div>
            )}
          </div>
          <div className="flex-1">
            <label className={`inline-flex cursor-pointer items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white shadow-lg shadow-[var(--hover-600)]/20 transition ${isUploadingLogo ? 'bg-[var(--hover-600)] cursor-wait opacity-70' : 'bg-[var(--hover-600)] hover:bg-[var(--hover-700)]'}`}>
              <Upload size={16} />
              {isUploadingLogo ? 'Uploading Logo...' : 'Upload PNG Logo'}
              <input
                type="file"
                accept="image/png,.png"
                disabled={isUploadingLogo}
                className="hidden"
                onChange={(event) => {
                  void handleAppLogoUpload(event.target.files?.[0]);
                  event.target.value = '';
                }}
              />
            </label>
            <p className="mt-2 text-xs text-gray-500">PNG only. Transparent-background logos work best.</p>
            {appLogoUrl && (
              <button
                type="button"
                onClick={() => void handleDeleteAppLogo()}
                disabled={isDeletingLogo}
                className="mt-3 inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-wait disabled:opacity-70"
              >
                <Trash2 size={14} />
                {isDeletingLogo ? 'Removing Logo...' : 'Remove Logo'}
              </button>
            )}
            {appLogoMessage && (
              <p className={`mt-2 text-xs ${appLogoMessage.toLowerCase().includes('failed') || appLogoMessage.toLowerCase().includes('only png') ? 'text-red-600' : 'text-emerald-600'}`}>
                {appLogoMessage}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="border border-gray-200 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Info className="w-5 h-5 text-indigo-600" />
          <h3 className="text-lg font-semibold text-gray-800">Receipt Contact Info</h3>
        </div>
        
        <p className="text-sm text-gray-600 mb-4">
          Customize the contact information displayed on printed receipts and invoices.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Receipt Email"
            type="email"
            value={receiptEmailInput}
            onChange={(e: any) => {
              setReceiptEmailInput(e.target.value);
              setReceiptInfoMessage(null);
            }}
            placeholder="info@dentflowpro.com"
          />
          <Input
            label="Receipt Phone"
            value={receiptPhoneInput}
            onChange={(e: any) => {
              setReceiptPhoneInput(e.target.value);
              setReceiptInfoMessage(null);
            }}
            placeholder="(555) 123-4567"
          />
        </div>

        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <button
            type="button"
            onClick={async () => {
              try {
                await onSaveReceiptInfo({
                  email: receiptEmailInput,
                  phone: receiptPhoneInput
                });
                setReceiptInfoMessage('Receipt contact info saved successfully!');
              } catch (err: any) {
                setReceiptInfoMessage('Failed to save receipt info: ' + (err?.message || 'Unknown error'));
              }
            }}
            className="w-full md:w-auto rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700"
          >
            Save Receipt Info
          </button>
          {receiptInfoMessage && (
            <p className={`text-xs ${receiptInfoMessage.toLowerCase().includes('failed') ? 'text-red-600' : 'text-emerald-600'}`}>
              {receiptInfoMessage}
            </p>
          )}
        </div>

        <div className="mt-4 p-3 bg-indigo-50 rounded-lg border border-indigo-100">
          <p className="text-xs text-indigo-700">
            <strong>Note:</strong> Changes will be applied to all new receipts and invoices generated after saving.
          </p>
        </div>
      </div>

      <div className="border border-gray-200 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Printer className="w-5 h-5 text-indigo-600" />
          <h3 className="text-lg font-semibold text-gray-800">Receipt Format</h3>
        </div>
        
        <p className="text-sm text-gray-600 mb-4">
          Select the default receipt output format. A4 is suitable for standard document printing. 55mm Thermal is optimized for thermal receipt printers.
        </p>
        
        <div className="space-y-3">
          <label className="flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all hover:bg-gray-50"
            style={{ borderColor: receiptSize === 'A4' ? '#4F46E5' : '#E5E7EB' }}>
            <input
              type="radio"
              name="receiptSize"
              value="A4"
              checked={receiptSize === 'A4'}
              onChange={() => onReceiptSizeChange('A4')}
              className="w-5 h-5 text-indigo-600 focus:ring-indigo-500"
            />
            <div className="flex-1">
              <div className="font-semibold text-gray-900">A4 Receipt</div>
              <div className="text-sm text-gray-500">Standard 210mm x 297mm format for document printers</div>
            </div>
            {receiptSize === 'A4' && (
              <div className="w-2 h-2 rounded-full bg-indigo-600"></div>
            )}
          </label>

          <label className="flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all hover:bg-gray-50"
            style={{ borderColor: receiptSize === 'THERMAL_55MM' ? '#4F46E5' : '#E5E7EB' }}>
            <input
              type="radio"
              name="receiptSize"
              value="THERMAL_55MM"
              checked={receiptSize === 'THERMAL_55MM'}
              onChange={() => onReceiptSizeChange('THERMAL_55MM')}
              className="w-5 h-5 text-indigo-600 focus:ring-indigo-500"
            />
            <div className="flex-1">
              <div className="font-semibold text-gray-900">55mm Thermal Receipt</div>
              <div className="text-sm text-gray-500">Optimized for 58mm wide thermal receipt printers (48–56mm printable width)</div>
            </div>
            {receiptSize === 'THERMAL_55MM' && (
              <div className="w-2 h-2 rounded-full bg-indigo-600"></div>
            )}
          </label>
        </div>

        <div className="mt-4 p-3 bg-indigo-50 rounded-lg border border-indigo-100">
          <p className="text-xs text-indigo-700">
            <strong>Note:</strong> The selected format will be used when generating receipts. Thermal format uses condensed layout, smaller fonts, and monospace styling suitable for thermal roll paper.
          </p>
        </div>
      </div>
    </div>
  );

  const renderSystemTab = () => (
    <div className="space-y-6">
      {onResetAllLoyaltyPoints && (
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

      <div className="border border-gray-200 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Info className="w-5 h-5 text-indigo-600" />
          <h3 className="text-lg font-semibold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">About {appName}</h3>
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
              &copy; {new Date().getFullYear()} WinterArc Myanmar Company Limited. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden animate-fade-in">
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-start justify-between gap-4 mb-2">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-100 p-2 rounded-lg">
              <SettingsIcon className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">System Settings</h2>
              <p className="text-sm text-gray-500">Customize your clinic management system</p>
            </div>
          </div>
          <div className="min-w-[140px]">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-500">Theme</p>
            <select
              value={hoverTheme}
              onChange={(event) => onHoverThemeChange(event.target.value as 'blue' | 'green' | 'yellow' | 'brown' | 'dark')}
              className="theme-select theme-accent-text w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs font-semibold focus:outline-none"
              aria-label="Select hover color"
            >
              {themeOptions.map((themeOption) => (
                <option key={themeOption.value} value={themeOption.value}>
                  {themeOption.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="px-6 pt-4 border-b border-gray-100">
        <nav className="flex overflow-x-auto gap-1" role="tablist" aria-label="Settings categories">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all whitespace-nowrap border-b-2 rounded-t-lg ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span className={activeTab === tab.id ? 'text-indigo-600' : 'text-gray-400'}>
                {tab.icon}
              </span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="p-6">
        {activeTab === 'general' && renderGeneralTab()}
        {activeTab === 'clinical' && renderClinicalTab()}
        {activeTab === 'rewards' && renderRewardsTab()}
        {activeTab === 'messaging' && renderMessagingTab()}
        {activeTab === 'email' && renderEmailTab()}
        {activeTab === 'storage' && renderStorageTab()}
        {activeTab === 'branding' && renderBrandingTab()}
        {activeTab === 'system' && renderSystemTab()}
      </div>

      {showLocModal && (
        <Modal title={editingLoc ? "Edit Clinic Location" : "Add New Clinic Location"} onClose={() => { setShowLocModal(false); setEditingLoc(null); setNewLoc({ name: '', address: '', phone: '' }); }}>
          <form onSubmit={editingLoc ? handleUpdateLoc : handleAddLoc} className="space-y-4">
            <Input label="Location Name" required value={newLoc.name} onChange={e => setNewLoc({...newLoc, name: e.target.value})} placeholder="e.g. Downtown Branch" />
            <Input label="Address" required value={newLoc.address} onChange={e => setNewLoc({...newLoc, address: e.target.value})} />
            <Input label="Phone" required value={newLoc.phone} onChange={e => setNewLoc({...newLoc, phone: e.target.value})} />
            <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-indigo-600/20">
              {editingLoc ? 'Update Location' : 'Create Location'}
            </button>
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
