import { User, Patient } from '../types';
import { api } from './api';
import { supabase } from './supabase';
import type { AppTabPermission } from '../constants';
import { DOCTOR_DASHBOARD_TABS } from '../constants';
import { resolveAllowedTabs } from '../utils/permissions';

// Default admin credentials
export const DEFAULT_ADMIN = {
  username: 'admin',
  password: 'admin123'
};

// Session storage keys
const SESSION_KEY = 'dental_auth_session';
const SESSION_USER_KEY = 'dental_auth_user';
const SESSION_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

const isRecoveryFlowActive = (): boolean => {
  if (typeof window === 'undefined') return false;

  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  return searchParams.get('reset') === 'password' || hashParams.get('type') === 'recovery';
};

const loadPendingPatientSignup = (email: string): { username?: string; phone?: string } | null => {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem(`pending_patient_signup_${email.toLowerCase().trim()}`);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn('Unable to read pending patient signup:', error);
    return null;
  }
};

const normalizeMyanmarPhoneForLookup = (value?: string | null): string | null => {
  const digits = (value || '').replace(/\D/g, '');
  const localDigits = digits.length === 10 && digits.startsWith('9') ? `0${digits}` : digits;
  return /^09\d{9}$/.test(localDigits) ? localDigits : null;
};

const lookupPatientAuthEmailByIdentifier = async (identifier: string): Promise<string | null> => {
  const trimmedIdentifier = identifier.trim();
  const normalizedIdentifier = trimmedIdentifier.toLowerCase();

  const lookupByColumn = async (column: 'phone' | 'username', value: string): Promise<string | null> => {
    if (!value) return null;

    const { data, error } = await supabase
      .from('patient_auth')
      .select('email')
      .eq(column, value)
      .maybeSingle();

    if (error) {
      console.warn(`Patient auth lookup error (${column}):`, error.message);
      return null;
    }

    return data?.email || null;
  };

  return (
    await lookupByColumn('username', normalizedIdentifier) ||
    await lookupByColumn('phone', normalizeMyanmarPhoneForLookup(trimmedIdentifier) || '') ||
    await lookupPatientEmailByNormalizedPhone(trimmedIdentifier)
  );
};

const lookupPatientEmailByNormalizedPhone = async (identifier: string): Promise<string | null> => {
  const normalizedPhone = normalizeMyanmarPhoneForLookup(identifier);
  if (!normalizedPhone) return null;

  const { data: authRows, error: authError } = await supabase
    .from('patient_auth')
    .select('email, phone');

  if (authError) {
    console.warn('Patient auth normalized phone lookup error:', authError.message);
  } else {
    const authMatch = (authRows || []).find((row: any) => normalizeMyanmarPhoneForLookup(row.phone) === normalizedPhone);
    if (authMatch?.email) {
      return authMatch.email;
    }
  }

  const { data: patientRows, error: patientError } = await supabase
    .from('patients')
    .select('email, phone');

  if (patientError) {
    console.warn('Patient normalized phone lookup error:', patientError.message);
    return null;
  }

  const patientMatch = (patientRows || []).find((row: any) => normalizeMyanmarPhoneForLookup(row.phone) === normalizedPhone);
  return patientMatch?.email || null;
};

export interface AuthSession {
  userId: string;
  username: string;
  role: 'admin' | 'normal' | 'patient' | 'doctor';
  allowed_tabs?: AppTabPermission[];
  location_id: string | null;
  loginTime: number;
  doctor_id?: string | null;
  patientId?: string; // For patient sessions
  supabaseUserId?: string; // For Supabase Auth sessions
}

export const auth = {
  // Initialize default admin if it doesn't exist
  async initializeDefaultAdmin(): Promise<void> {
    try {
      const users = await api.users.getAll();
      const adminExists = users.some(u => u.username === DEFAULT_ADMIN.username && u.role === 'admin');
      
      if (!adminExists) {
        // Create default admin
        await api.users.create({
          username: DEFAULT_ADMIN.username,
          password: DEFAULT_ADMIN.password,
          role: 'admin'
        });
      }
    } catch (error) {
      console.warn('Error initializing default admin:', error);
    }
  },

  // Login with username, password, and CAPTCHA
  async login(username: string, password: string, captchaAnswer: number, captchaExpected: number): Promise<AuthSession> {
    // Verify CAPTCHA
    if (captchaAnswer !== captchaExpected) {
      throw new Error('Invalid CAPTCHA. Please try again.');
    }

    // Check database users (including default admin if already initialized)
    try {
      const user = await api.users.authenticate(username, password);
      
      if (!user && username === DEFAULT_ADMIN.username && password === DEFAULT_ADMIN.password) {
        // If database auth fails but credentials match default, initialize and try again
        await this.initializeDefaultAdmin();
        const retryUser = await api.users.authenticate(username, password);
        if (retryUser) {
          const isDoctorUser = Boolean(retryUser.doctor_id);
          const resolvedRole: AuthSession['role'] = isDoctorUser ? 'doctor' : retryUser.role;
          const session: AuthSession = {
            userId: retryUser.id,
            username: retryUser.username,
            role: resolvedRole,
            allowed_tabs: isDoctorUser ? [...DOCTOR_DASHBOARD_TABS] : resolveAllowedTabs(retryUser.role, retryUser.allowed_tabs),
            location_id: retryUser.location_id || null,
            doctor_id: retryUser.doctor_id || null,
            loginTime: Date.now()
          };
          this.setSession(session);
          return session;
        }
      }

      if (!user) {
        throw new Error('Invalid username or password');
      }

      const isDoctorUser = Boolean(user.doctor_id);
      const resolvedRole: AuthSession['role'] = isDoctorUser ? 'doctor' : user.role;
      const session: AuthSession = {
        userId: user.id,
        username: user.username,
        role: resolvedRole,
        allowed_tabs: isDoctorUser ? [...DOCTOR_DASHBOARD_TABS] : resolveAllowedTabs(user.role, user.allowed_tabs),
        location_id: user.location_id || null,
        doctor_id: user.doctor_id || null,
        loginTime: Date.now()
      };
      this.setSession(session);
      return session;
    } catch (error: any) {
      throw new Error(error.message || 'Invalid username or password');
    }
  },

  // Logout
  logout(): void {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_USER_KEY);
    // Also sign out from Supabase Auth
    supabase.auth.signOut().catch(err => console.warn('Supabase signout error:', err));
  },

  // Get current session
  getSession(): AuthSession | null {
    try {
      if (isRecoveryFlowActive()) {
        return null;
      }

      const sessionStr = localStorage.getItem(SESSION_KEY);
      if (!sessionStr) return null;
      
      const session: AuthSession = JSON.parse(sessionStr);
      // Keep users signed in on this device for up to one year.
      if (Date.now() - session.loginTime > SESSION_MAX_AGE_MS) {
        this.logout();
        return null;
      }
      return session;
    } catch {
      return null;
    }
  },

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return this.getSession() !== null;
  },

  // Check if user is admin
  isAdmin(): boolean {
    const session = this.getSession();
    return session?.role === 'admin' || false;
  },

  // Set session
  setSession(session: AuthSession): void {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  },

  // Get current user
  getCurrentUser(): AuthSession | null {
    return this.getSession();
  },

  // Patient login with email, phone, username, or name + password
  async patientLogin(identifier: string, password: string): Promise<AuthSession> {
    try {
      const trimmedIdentifier = identifier.trim();
      const normalizedIdentifier = trimmedIdentifier.toLowerCase();

      const trySupabaseLogin = async (email: string): Promise<AuthSession | null> => {
        const normalizedEmail = email.toLowerCase().trim();
        if (!normalizedEmail) return null;

        console.log('Attempting Supabase Auth login for:', normalizedEmail);

        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password
        });

        if (authError) {
          console.log('Supabase Auth error:', authError.message);
          // Common errors:
          // - "Invalid login credentials" = wrong password or email not confirmed
          // - "Email not confirmed" = user needs to verify email
          return null;
        }

        if (!authData.user) return null;

        console.log('Supabase Auth succeeded, user ID:', authData.user.id);

        const { data: patientAuth, error: paError } = await supabase
          .from('patient_auth')
          .select('patient_id')
          .eq('email', normalizedEmail)
          .single();

        let patientId = patientAuth?.patient_id;

        console.log('patient_auth lookup:', { found: !!patientAuth, error: paError?.message });

        if (!patientId) {
          console.warn('Supabase Auth succeeded but patient profile is missing. Attempting to complete signup for:', normalizedEmail);

          const pendingSignup = loadPendingPatientSignup(normalizedEmail);
          const metadata = authData.user.user_metadata || {};
          const fallbackUsername =
            pendingSignup?.username ||
            (typeof metadata.username === 'string' ? metadata.username : undefined);
          const fallbackPhone =
            pendingSignup?.phone ||
            (typeof metadata.phone === 'string' ? metadata.phone : undefined);

          await api.patients.registerWithSupabase(
            normalizedEmail,
            '',
            authData.user.id,
            fallbackUsername,
            fallbackPhone
          );

          const { data: refreshedPatientAuth, error: refreshedAuthError } = await supabase
            .from('patient_auth')
            .select('patient_id')
            .eq('email', normalizedEmail)
            .single();

          if (refreshedAuthError || !refreshedPatientAuth?.patient_id) {
            console.error('Unable to complete patient signup after Supabase login:', refreshedAuthError?.message);
            throw new Error('Account setup incomplete. Please contact support or try registering again.');
          }

          patientId = refreshedPatientAuth.patient_id;
        }

        const { data: patient, error: pError } = await supabase
          .from('patients')
          .select('*')
          .eq('id', patientId)
          .single();

        console.log('patients lookup:', { found: !!patient, error: pError?.message });

        if (!patient) return null;

        const session: AuthSession = {
          userId: patient.id,
          username: patient.name,
          role: 'patient',
          location_id: patient.location_id || null,
          loginTime: Date.now(),
          patientId: patient.id,
          supabaseUserId: authData.user.id
        };

        this.setSession(session);
        return session;
      };

      // 1) Supabase Auth: email login OR map phone/username -> email and login
      const isEmail = normalizedIdentifier.includes('@');
      if (isEmail) {
        const session = await trySupabaseLogin(normalizedIdentifier);
        if (session) return session;
      } else {
        const identifierEmail = await lookupPatientAuthEmailByIdentifier(trimmedIdentifier);
        if (identifierEmail) {
          const session = await trySupabaseLogin(identifierEmail);
          if (session) return session;
        }
      }

      // Fallback to legacy authentication (email/phone/username/name + password against patient_auth table)
      console.log('Falling back to legacy authentication for:', identifier);
      const patient = await api.patients.authenticate(trimmedIdentifier, password);
      if (!patient) {
        throw new Error('Invalid credentials. Please check your email, phone, or username and password.');
      }

      const session: AuthSession = {
        userId: patient.id,
        username: patient.name,
        role: 'patient',
        location_id: patient.location_id || null,
        loginTime: Date.now(),
        patientId: patient.id
      };
      
      this.setSession(session);
      return session;
    } catch (error: any) {
      console.error('Patient login error:', error);
      throw new Error(error.message || 'Invalid patient credentials');
    }
  },

  // Check if user is patient
  isPatient(): boolean {
    const session = this.getSession();
    return session?.role === 'patient' || false;
  },

  // Get current patient ID
  getCurrentPatientId(): string | null {
    const session = this.getSession();
    return session?.patientId || null;
  },

  // Check if there's an active Supabase Auth session
  async getSupabaseSession() {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  },

  // Restore session from Supabase Auth (for page refresh)
  async restoreSupabaseSession(): Promise<AuthSession | null> {
    try {
      if (isRecoveryFlowActive()) {
        return null;
      }

      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        return null;
      }

      // Check if we have an existing local session that matches
      const localSession = this.getSession();
      if (localSession?.supabaseUserId === session.user.id) {
        return localSession;
      }

      // Try to find the patient associated with this Supabase user
      const { data: patientAuth } = await supabase
        .from('patient_auth')
        .select('patient_id')
        .eq('email', session.user.email?.toLowerCase())
        .single();

      if (!patientAuth?.patient_id) {
        return null;
      }

      const { data: patient } = await supabase
        .from('patients')
        .select('*')
        .eq('id', patientAuth.patient_id)
        .single();

      if (!patient) {
        return null;
      }

      const newSession: AuthSession = {
        userId: patient.id,
        username: patient.name,
        role: 'patient',
        location_id: patient.location_id || null,
        loginTime: Date.now(),
        patientId: patient.id,
        supabaseUserId: session.user.id
      };
      
      this.setSession(newSession);
      return newSession;
    } catch (error) {
      console.error('Failed to restore Supabase session:', error);
      return null;
    }
  },

  // Listen for auth state changes
  onAuthStateChange(callback: (session: AuthSession | null) => void) {
    return supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        this.logout();
        callback(null);
      } else if (event === 'PASSWORD_RECOVERY') {
        callback(null);
      } else if (event === 'SIGNED_IN' && session?.user) {
        if (isRecoveryFlowActive()) {
          callback(null);
          return;
        }
        const restoredSession = await this.restoreSupabaseSession();
        callback(restoredSession);
      }
    });
  }
};

