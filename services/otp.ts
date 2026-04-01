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
  async waitForRecoverySession(
    attempts = 12,
    delayMs = 250
  ): Promise<{ success: boolean; message?: string }> {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.error('Recovery session lookup error:', error);
      }

      if (data.session?.user?.email) {
        return { success: true };
      }

      await wait(delayMs);
    }

    return {
      success: false,
      message: 'Your password reset session is not ready yet. Please wait a moment and try again.'
    };
  },

  /**
   * Request OTP for patient registration using Supabase Auth
   * This uses Supabase's built-in email verification
   */
  async requestOTP(email: string): Promise<{ success: boolean; message: string }> {
    try {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return { success: false, message: 'Please enter a valid email address' };
      }

      // Use Supabase Auth's built-in OTP system
      // This sends an email with a 6-digit code
      const { error } = await supabase.auth.signInWithOtp({
        email: email.toLowerCase().trim(),
        options: {
          // Don't create a session until OTP is verified
          shouldCreateUser: true,
        }
      });

      if (error) {
        console.error('Supabase OTP request error:', error);
        
        // Handle rate limiting
        if (error.message.includes('rate') || error.message.includes('limit')) {
          return { 
            success: false, 
            message: 'Too many requests. Please wait a few minutes before trying again.' 
          };
        }
        
        return { success: false, message: error.message };
      }

      return { 
        success: true, 
        message: 'Verification code sent to your email address. Check your inbox (and spam folder).' 
      };
    } catch (error: any) {
      console.error('OTP request failed:', error);
      return { 
        success: false, 
        message: error.message || 'Failed to send verification code' 
      };
    }
  },

  /**
   * Verify OTP code using Supabase Auth
   */
  async verifyOTP(email: string, code: string): Promise<{ success: boolean; userId?: string; message?: string }> {
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.toLowerCase().trim(),
        token: code,
        type: 'email' // Use 'email' for signInWithOtp, 'signup' for signUp
      });

      if (error) {
        console.error('OTP verification error:', error);
        
        // Provide user-friendly error messages
        if (error.message.includes('expired')) {
          return { success: false, message: 'Verification code has expired. Please request a new one.' };
        }
        if (error.message.includes('invalid')) {
          return { success: false, message: 'Invalid verification code. Please check and try again.' };
        }
        
        return { success: false, message: error.message };
      }

      if (!data.user) {
        return { success: false, message: 'Verification failed. Please try again.' };
      }

      return { 
        success: true, 
        userId: data.user.id,
        message: 'Email verified successfully!' 
      };
    } catch (error: any) {
      console.error('OTP verification failed:', error);
      return { 
        success: false, 
        message: error.message || 'Failed to verify code' 
      };
    }
  },

  /**
   * Sign up a new user with email and password using Supabase Auth
   * This will send a confirmation email automatically
   */
  async signUpWithPassword(email: string, password: string): Promise<{ 
    success: boolean; 
    userId?: string; 
    needsVerification?: boolean;
    message?: string 
  }> {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.toLowerCase().trim(),
        password,
        options: {
          emailRedirectTo: window.location.origin,
        }
      });

      if (error) {
        console.error('Sign up error:', error);
        
        if (error.message.includes('already registered')) {
          return { success: false, message: 'This email is already registered. Please login instead.' };
        }
        
        return { success: false, message: error.message };
      }

      // Check if user needs email confirmation
      const needsVerification = data.user && !data.user.email_confirmed_at;
      
      return { 
        success: true, 
        userId: data.user?.id,
        needsVerification,
        message: needsVerification 
          ? 'Please check your email for the verification code.'
          : 'Account created successfully!'
      };
    } catch (error: any) {
      console.error('Sign up failed:', error);
      return { 
        success: false, 
        message: error.message || 'Failed to create account' 
      };
    }
  },

  /**
   * Verify signup OTP (for email + password signup flow)
   */
  async verifySignupOTP(email: string, code: string): Promise<{ success: boolean; userId?: string; message?: string }> {
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.toLowerCase().trim(),
        token: code,
        type: 'signup'
      });

      if (error) {
        console.error('Signup OTP verification error:', error);
        return { success: false, message: error.message };
      }

      if (!data.user) {
        return { success: false, message: 'Verification failed. Please try again.' };
      }

      return { 
        success: true, 
        userId: data.user.id,
        message: 'Email verified successfully!' 
      };
    } catch (error: any) {
      console.error('Signup OTP verification failed:', error);
      return { 
        success: false, 
        message: error.message || 'Failed to verify code' 
      };
    }
  },

  /**
   * Sign up with email confirmation link (not OTP code)
   * Uses Supabase's default email confirmation behavior
   */
  async signUpWithEmailConfirmation(
    email: string,
    password: string,
    profile?: { username?: string; phone?: string }
  ): Promise<{ 
    success: boolean; 
    userId?: string; 
    message?: string 
  }> {
    try {
      // Build the redirect URL - user will be redirected here after clicking the link
      const redirectUrl = `${window.location.origin}?confirmed=true&email=${encodeURIComponent(email)}`;
      
      const { data, error } = await supabase.auth.signUp({
        email: email.toLowerCase().trim(),
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            username: profile?.username?.trim() || undefined,
            phone: profile?.phone?.trim() || undefined,
          },
        }
      });

      if (error) {
        console.error('Sign up error:', error);
        
        if (error.message.includes('already registered')) {
          return { success: false, message: 'This email is already registered. Please login instead.' };
        }
        
        return { success: false, message: error.message };
      }

      // Supabase will send a confirmation email with a link
      return { 
        success: true, 
        userId: data.user?.id,
        message: 'Please check your email and click the confirmation link to verify your account.'
      };
    } catch (error: any) {
      console.error('Sign up failed:', error);
      return { 
        success: false, 
        message: error.message || 'Failed to create account' 
      };
    }
  },

  /**
   * Resend confirmation email
   */
  async resendConfirmationEmail(email: string): Promise<{ success: boolean; message: string }> {
    try {
      const redirectUrl = `${window.location.origin}?confirmed=true&email=${encodeURIComponent(email)}`;
      
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.toLowerCase().trim(),
        options: {
          emailRedirectTo: redirectUrl,
        }
      });

      if (error) {
        console.error('Resend confirmation error:', error);
        
        if (error.message.includes('rate') || error.message.includes('limit')) {
          return { 
            success: false, 
            message: 'Please wait a few minutes before requesting another email.' 
          };
        }
        
        return { success: false, message: error.message };
      }

      return { 
        success: true, 
        message: 'A new confirmation email has been sent. Please check your inbox.' 
      };
    } catch (error: any) {
      console.error('Resend confirmation failed:', error);
      return { 
        success: false, 
        message: error.message || 'Failed to resend confirmation email' 
      };
    }
  },

  /**
   * Update password for authenticated user
   */
  async updatePassword(newPassword: string): Promise<{ success: boolean; message?: string }> {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        console.error('Password update error:', error);
        return { success: false, message: error.message };
      }

      return { success: true, message: 'Password updated successfully!' };
    } catch (error: any) {
      console.error('Password update failed:', error);
      return { 
        success: false, 
        message: error.message || 'Failed to update password' 
      };
    }
  },

  /**
   * Sign out the current user
   */
  async signOut(): Promise<void> {
    await supabase.auth.signOut();
  },

  /**
   * Get current authenticated user
   */
  async getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  },

  /**
   * Check if email is already registered in patient_auth table
   * (for checking existing patient accounts, separate from Supabase Auth)
   */
  async isEmailRegistered(email: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('patient_auth')
        .select('id')
        .eq('email', email.toLowerCase().trim())
        .limit(1);
      
      if (error) {
        console.error('Email check error:', error);
        return false;
      }
      
      return data && data.length > 0;
    } catch (error) {
      console.error('Email registration check failed:', error);
      return false;
    }
  },

  /**
   * Send a password reset email for an existing patient account.
   */
  async requestPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
    try {
      const normalizedEmail = email.toLowerCase().trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(normalizedEmail)) {
        return { success: false, message: 'Please enter a valid email address.' };
      }

      const redirectUrl = `${window.location.origin}${window.location.pathname}?reset=password`;
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: redirectUrl
      });

      if (error) {
        console.error('Password reset request error:', error);

        if (error.message.includes('rate') || error.message.includes('limit')) {
          return {
            success: false,
            message: 'Please wait a few minutes before requesting another reset email.'
          };
        }

        return { success: false, message: error.message };
      }

      return {
        success: true,
        message: 'If that email is registered, password reset instructions have been sent.'
      };
    } catch (error: any) {
      console.error('Password reset request failed:', error);
      return {
        success: false,
        message: error.message || 'Failed to send password reset email.'
      };
    }
  },

  /**
   * Complete a password reset using the active Supabase recovery session
   * and sync the legacy patient_auth password for compatibility.
   */
  async completePasswordReset(newPassword: string): Promise<{ success: boolean; message: string; email?: string }> {
    try {
      const trimmedPassword = newPassword.trim();
      if (trimmedPassword.length < 6) {
        return {
          success: false,
          message: 'Password must be at least 6 characters long.'
        };
      }

      const recoverySessionReady = await this.waitForRecoverySession();
      if (!recoverySessionReady.success) {
        return {
          success: false,
          message: recoverySessionReady.message || 'Your password reset session is not ready yet.'
        };
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.error('Password reset session error:', sessionError);
        return { success: false, message: sessionError.message };
      }

      const recoveryUser = sessionData.session?.user;
      if (!recoveryUser?.email) {
        return {
          success: false,
          message: 'The reset link is still loading or has expired. Please wait a moment and try again, or request a new reset email.'
        };
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: trimmedPassword
      });

      if (updateError) {
        console.error('Password reset update error:', updateError);
        return { success: false, message: updateError.message };
      }

      await api.patients.updatePasswordByEmail(
        recoveryUser.email,
        trimmedPassword,
        recoveryUser.id
      );

      return {
        success: true,
        message: 'Your password has been reset successfully. Please log in again.',
        email: recoveryUser.email
      };
    } catch (error: any) {
      console.error('Password reset completion failed:', error);
      return {
        success: false,
        message: error.message || 'Failed to reset password.'
      };
    }
  },

  /**
   * Check if username is already registered in patient_auth table
   */
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
      
      return data && data.length > 0;
    } catch (error) {
      console.error('Username registration check failed:', error);
      return false;
    }
  },

  /**
   * Resend OTP verification email
   */
  async resendOTP(email: string): Promise<{ success: boolean; message: string }> {
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.toLowerCase().trim(),
      });

      if (error) {
        console.error('Resend OTP error:', error);
        
        if (error.message.includes('rate') || error.message.includes('limit')) {
          return { 
            success: false, 
            message: 'Please wait a few minutes before requesting another code.' 
          };
        }
        
        return { success: false, message: error.message };
      }

      return { 
        success: true, 
        message: 'A new verification code has been sent to your email.' 
      };
    } catch (error: any) {
      console.error('Resend OTP failed:', error);
      return { 
        success: false, 
        message: error.message || 'Failed to resend verification code' 
      };
    }
  },

  // ============ Legacy methods for backward compatibility ============
  // These can be removed once fully migrated to Supabase Auth

  /**
   * @deprecated Use Supabase Auth instead. Kept for backward compatibility.
   */
  generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  },

  /**
   * @deprecated Use Supabase Auth instead. Kept for backward compatibility.
   */
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

  /**
   * @deprecated Use Supabase Auth instead. Kept for backward compatibility.
   */
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

      // Mark OTP as used
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
