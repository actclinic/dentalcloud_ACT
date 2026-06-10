import { supabase } from './supabase';
import { api } from './api';

export interface OTPRecord {
  id: string;
  email: string;
  code: string;
  expires_at: string;
  used: boolean;
  created_at: string;
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const otpService = {
  generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  },

  getPendingSignupKey(email: string): string {
    return `pending_patient_signup_${email.toLowerCase().trim()}`;
  },

  isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.toLowerCase().trim());
  },

  escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  async getClinicName(): Promise<string> {
    try {
      return await api.appSettings.getAppName();
    } catch (error) {
      return 'DentalCloud Pro';
    }
  },

  async invalidateCodes(email: string): Promise<void> {
    const normalizedEmail = email.toLowerCase().trim();
    try {
      const { error } = await supabase
        .from('otp_codes')
        .update({ used: true })
        .eq('email', normalizedEmail)
        .eq('used', false);

      if (error) {
        console.warn('Unable to invalidate previous auth email codes:', error.message);
      }
    } catch (error) {
      console.warn('Unable to invalidate previous auth email codes:', error);
    }
  },

  async storeAuthCode(email: string, code: string, ttlMinutes: number): Promise<OTPRecord> {
    const normalizedEmail = email.toLowerCase().trim();
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    await this.invalidateCodes(normalizedEmail);

    const { data, error } = await supabase
      .from('otp_codes')
      .insert({
        email: normalizedEmail,
        code,
        expires_at: expiresAt.toISOString(),
        used: false
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to store verification code: ${error.message}`);
    }

    return data;
  },

  async verifyAuthCode(email: string, code: string, markUsed = true): Promise<boolean> {
    const normalizedEmail = email.toLowerCase().trim();
    const normalizedCode = code.trim();

    if (!this.isValidEmail(normalizedEmail) || !/^\d{6}$/.test(normalizedCode)) {
      return false;
    }

    const { data, error } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('email', normalizedEmail)
      .eq('code', normalizedCode)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) {
      if (error) console.error('Verification code lookup error:', error);
      return false;
    }

    if (markUsed) {
      const { error: updateError } = await supabase
        .from('otp_codes')
        .update({ used: true })
        .eq('id', data[0].id);

      if (updateError) {
        throw new Error(updateError.message);
      }
    }

    return true;
  },

  buildEmailHtml(params: {
    title: string;
    eyebrow: string;
    message: string;
    buttonText: string;
    buttonUrl: string;
    code: string;
    expiryText: string;
    clinicName: string;
  }): string {
    const safeTitle = this.escapeHtml(params.title);
    const safeEyebrow = this.escapeHtml(params.eyebrow);
    const safeMessage = this.escapeHtml(params.message);
    const safeButtonText = this.escapeHtml(params.buttonText);
    const safeButtonUrl = this.escapeHtml(params.buttonUrl);
    const safeCode = this.escapeHtml(params.code);
    const safeExpiryText = this.escapeHtml(params.expiryText);
    const safeClinicName = this.escapeHtml(params.clinicName);

    return `
      <div style="margin:0;padding:0;background:#020617;font-family:Inter,Arial,sans-serif;color:#e5e7eb;">
        <div style="max-width:620px;margin:0 auto;padding:32px 18px;">
          <div style="background:#0f172a;border:1px solid #1e293b;border-radius:22px;overflow:hidden;box-shadow:0 24px 80px rgba(15,23,42,.45);">
            <div style="height:7px;background:linear-gradient(90deg,#2563eb,#06b6d4,#8b5cf6);"></div>
            <div style="padding:30px;">
              <div style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#38bdf8;font-weight:800;margin-bottom:12px;">${safeEyebrow}</div>
              <h1 style="margin:0 0 14px;font-size:28px;line-height:1.15;color:#ffffff;font-weight:900;">${safeTitle}</h1>
              <p style="margin:0 0 24px;color:#cbd5e1;font-size:15px;line-height:1.65;">${safeMessage}</p>
              <div style="margin:24px 0;text-align:center;">
                <a href="${safeButtonUrl}" style="display:inline-block;text-decoration:none;background:linear-gradient(135deg,#2563eb,#06b6d4);color:#ffffff;font-weight:800;border-radius:14px;padding:14px 24px;box-shadow:0 12px 30px rgba(37,99,235,.35);">${safeButtonText}</a>
              </div>
              <div style="background:#111827;border:1px solid #334155;border-radius:16px;padding:18px;margin:22px 0;">
                <div style="font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:.12em;font-weight:800;margin-bottom:8px;">Verification code</div>
                <div style="font-size:30px;letter-spacing:.28em;color:#ffffff;font-weight:900;">${safeCode}</div>
              </div>
              <p style="margin:0;color:#94a3b8;font-size:13px;line-height:1.55;">${safeExpiryText}</p>
              <p style="margin:18px 0 0;color:#64748b;font-size:12px;line-height:1.55;">If the button does not work, copy and paste this link into your browser:<br><span style="color:#93c5fd;word-break:break-all;">${safeButtonUrl}</span></p>
            </div>
            <div style="padding:18px 30px;background:#020617;border-top:1px solid #1e293b;color:#64748b;font-size:12px;">${safeClinicName} - Secure patient portal</div>
          </div>
        </div>
      </div>
    `;
  },

  async sendPatientAuthEmail(params: {
    to: string;
    subject: string;
    html: string;
    text: string;
    clinicName: string;
  }): Promise<void> {
    await api.email.sendManagerEmail({
      to: params.to,
      subject: params.subject,
      body: params.text,
      html: params.html,
      fromName: params.clinicName
    });
  },

  async sendSignupConfirmationEmail(
    email: string,
    profile: { username?: string; phone?: string },
    password: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const normalizedEmail = email.toLowerCase().trim();
      if (!this.isValidEmail(normalizedEmail)) {
        return { success: false, message: 'Please enter a valid email address.' };
      }
      if (!password || password.length < 6) {
        return { success: false, message: 'Password must be at least 6 characters long.' };
      }

      await api.patients.registerWithSupabase(
        normalizedEmail,
        password,
        undefined,
        profile.username,
        profile.phone,
        false
      );

      const code = this.generateOTP();
      await this.storeAuthCode(normalizedEmail, code, 30);

      const pendingData = {
        username: profile.username?.trim() || undefined,
        phone: profile.phone?.trim() || undefined
      };
      localStorage.setItem(this.getPendingSignupKey(normalizedEmail), JSON.stringify(pendingData));

      const clinicName = await this.getClinicName();
      const confirmUrl = `${window.location.origin}${window.location.pathname}?confirm_patient=${encodeURIComponent(code)}&email=${encodeURIComponent(normalizedEmail)}`;
      const html = this.buildEmailHtml({
        title: 'Confirm your patient portal email',
        eyebrow: 'DentalCloud patient signup',
        message: `Welcome to ${clinicName}. Please confirm this email address to finish creating your patient portal account.`,
        buttonText: 'Confirm email',
        buttonUrl: confirmUrl,
        code,
        expiryText: 'This confirmation link and code expire in 30 minutes. If you did not request this account, you can ignore this email.',
        clinicName
      });

      await this.sendPatientAuthEmail({
        to: normalizedEmail,
        subject: `Confirm your ${clinicName} patient portal email`,
        html,
        text: `Confirm your ${clinicName} patient portal email. Open this link: ${confirmUrl}\n\nVerification code: ${code}\n\nThis code expires in 30 minutes.`,
        clinicName
      });

      return { success: true, message: 'Please check your email and click the confirmation link to verify your account.' };
    } catch (error: any) {
      console.error('Custom signup confirmation failed:', error);
      return { success: false, message: error.message || 'Failed to send confirmation email.' };
    }
  },

  async confirmPatientSignup(email: string, code: string): Promise<{ success: boolean; message: string; email?: string }> {
    try {
      const normalizedEmail = email.toLowerCase().trim();
      const valid = await this.verifyAuthCode(normalizedEmail, code, true);
      if (!valid) {
        return { success: false, message: 'This confirmation link is invalid or has expired. Please request a new confirmation email.' };
      }

      const { data: existingAuth, error: fetchError } = await supabase
        .from('patient_auth')
        .select('id')
        .eq('email', normalizedEmail)
        .maybeSingle();

      if (fetchError || !existingAuth?.id) {
        return { success: false, message: 'No pending patient account was found for this email. Please register again.' };
      }

      const { error: updateError } = await supabase
        .from('patient_auth')
        .update({ is_verified: true, updated_at: new Date().toISOString() })
        .eq('id', existingAuth.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      localStorage.removeItem(this.getPendingSignupKey(normalizedEmail));
      return { success: true, message: 'Email verified and account created successfully!', email: normalizedEmail };
    } catch (error: any) {
      console.error('Custom patient signup confirmation failed:', error);
      return { success: false, message: error.message || 'Failed to confirm patient signup.' };
    }
  },

  async resendConfirmationEmail(email: string): Promise<{ success: boolean; message: string }> {
    try {
      const normalizedEmail = email.toLowerCase().trim();
      const { data: existingAuth, error: fetchError } = await supabase
        .from('patient_auth')
        .select('username, phone, password, is_verified')
        .eq('email', normalizedEmail)
        .maybeSingle();

      if (fetchError || !existingAuth?.password) {
        return { success: false, message: 'Your pending signup was not found. Please start registration again.' };
      }
      if (existingAuth.is_verified) {
        return { success: false, message: 'This email is already verified. Please log in instead.' };
      }

      return await this.sendSignupConfirmationEmail(normalizedEmail, {
        username: existingAuth.username,
        phone: existingAuth.phone
      }, existingAuth.password);
    } catch (error: any) {
      console.error('Custom resend confirmation failed:', error);
      return { success: false, message: error.message || 'Failed to resend confirmation email.' };
    }
  },

  async isEmailRegistered(email: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('patient_auth')
        .select('id, is_verified')
        .eq('email', email.toLowerCase().trim())
        .limit(1);

      if (error) {
        console.error('Email check error:', error);
        return false;
      }

      return Boolean(data && data.some((record: any) => record.is_verified !== false));
    } catch (error) {
      console.error('Email registration check failed:', error);
      return false;
    }
  },

  async isUsernameRegistered(username: string): Promise<boolean> {
    try {
      const normalized = username.trim().toLowerCase();
      if (!normalized) return false;

      const { data, error } = await supabase
        .from('patient_auth')
        .select('id')
        .eq('username', normalized)
        .limit(1);

      if (error) {
        console.error('Username check error:', error);
        return false;
      }

      return Boolean(data && data.some((record: any) => record.is_verified !== false));
    } catch (error) {
      console.error('Username registration check failed:', error);
      return false;
    }
  },

  async requestPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
    const genericSuccess = 'If that email is registered, password reset instructions have been sent.';

    try {
      const normalizedEmail = email.toLowerCase().trim();
      if (!this.isValidEmail(normalizedEmail)) {
        return { success: false, message: 'Please enter a valid email address.' };
      }

      const { data: existingAuth, error: fetchError } = await supabase
        .from('patient_auth')
        .select('id')
        .eq('email', normalizedEmail)
        .maybeSingle();

      if (fetchError) {
        console.error('Password reset patient lookup error:', fetchError);
        return { success: true, message: genericSuccess };
      }

      if (!existingAuth?.id) {
        return { success: true, message: genericSuccess };
      }

      const code = this.generateOTP();
      await this.storeAuthCode(normalizedEmail, code, 20);

      const clinicName = await this.getClinicName();
      const resetUrl = `${window.location.origin}${window.location.pathname}?reset=password&email=${encodeURIComponent(normalizedEmail)}&code=${encodeURIComponent(code)}`;
      const html = this.buildEmailHtml({
        title: 'Reset your patient portal password',
        eyebrow: 'DentalCloud password recovery',
        message: `We received a request to reset your ${clinicName} patient portal password. Use the secure link below to choose a new password.`,
        buttonText: 'Reset password',
        buttonUrl: resetUrl,
        code,
        expiryText: 'This password reset link and code expire in 20 minutes. If you did not request a password reset, you can ignore this email.',
        clinicName
      });

      await this.sendPatientAuthEmail({
        to: normalizedEmail,
        subject: `Reset your ${clinicName} patient portal password`,
        html,
        text: `Reset your ${clinicName} patient portal password. Open this link: ${resetUrl}\n\nVerification code: ${code}\n\nThis code expires in 20 minutes.`,
        clinicName
      });

      return { success: true, message: genericSuccess };
    } catch (error: any) {
      console.error('Custom password reset request failed:', error);
      return { success: false, message: error.message || 'Failed to send password reset email.' };
    }
  },

  async completePasswordReset(newPassword: string, email?: string, code?: string): Promise<{ success: boolean; message: string; email?: string }> {
    try {
      const trimmedPassword = newPassword.trim();
      const normalizedEmail = (email || '').toLowerCase().trim();
      const normalizedCode = (code || '').trim();

      if (trimmedPassword.length < 6) {
        return { success: false, message: 'Password must be at least 6 characters long.' };
      }
      if (!this.isValidEmail(normalizedEmail) || !/^\d{6}$/.test(normalizedCode)) {
        return { success: false, message: 'This reset link is invalid. Please request a new reset email.' };
      }

      const valid = await this.verifyAuthCode(normalizedEmail, normalizedCode, true);
      if (!valid) {
        return { success: false, message: 'This reset link has expired or was already used. Please request a new reset email.' };
      }

      await api.patients.updatePasswordByEmail(normalizedEmail, trimmedPassword);

      return {
        success: true,
        message: 'Your password has been reset successfully. Please log in again.',
        email: normalizedEmail
      };
    } catch (error: any) {
      console.error('Custom password reset completion failed:', error);
      return { success: false, message: error.message || 'Failed to reset password.' };
    }
  },

  // Legacy 6-digit OTP helpers retained for compatibility with any older screens.
  async storeOTP(email: string, code: string): Promise<OTPRecord> {
    const expires_at = new Date(Date.now() + 5 * 60 * 1000);

    const { data, error } = await supabase
      .from('otp_codes')
      .insert({
        email: email.toLowerCase().trim(),
        code,
        expires_at: expires_at.toISOString()
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to store OTP: ${error.message}`);
    }

    return data;
  },

  async verifyOTPLegacy(email: string, code: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('otp_codes')
        .select('*')
        .eq('email', email.toLowerCase().trim())
        .eq('code', code)
        .eq('used', false)
        .gt('expires_at', new Date().toISOString())
        .limit(1);

      if (error || !data || data.length === 0) {
        return false;
      }

      await supabase
        .from('otp_codes')
        .update({ used: true })
        .eq('id', data[0].id);

      return true;
    } catch (error) {
      console.error('OTP verification failed:', error);
      return false;
    }
  }
};
