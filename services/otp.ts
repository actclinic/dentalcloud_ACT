import { supabase } from './supabase';

export interface OTPRecord {
  id: string;
  email: string;
  code: string;
  expires_at: string;
  used: boolean;
  created_at: string;
}

export const otpService = {
  // Generate a random 6-digit OTP
  generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  },

  // Generate expiration timestamp (5 minutes from now)
  generateExpiration(): Date {
    const now = new Date();
    return new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes
  },

  // Store OTP in database
  async storeOTP(email: string, code: string): Promise<OTPRecord> {
    const expires_at = this.generateExpiration();
    
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

  // Verify OTP code
  async verifyOTP(email: string, code: string): Promise<boolean> {
    try {
      // First, clean up expired codes
      await this.cleanupExpiredCodes();
      
      const { data, error } = await supabase
        .from('otp_codes')
        .select('*')
        .eq('email', email.toLowerCase().trim())
        .eq('code', code)
        .eq('used', false)
        .gt('expires_at', new Date().toISOString())
        .limit(1);

      if (error) {
        console.error('OTP verification error:', error);
        return false;
      }

      if (!data || data.length === 0) {
        return false;
      }

      // Mark OTP as used
      const otpRecord = data[0];
      await supabase
        .from('otp_codes')
        .update({ used: true })
        .eq('id', otpRecord.id);

      return true;
    } catch (error) {
      console.error('OTP verification failed:', error);
      return false;
    }
  },

  // Mock send email (logs to console for now)
  async sendOTPEmail(email: string, code: string): Promise<void> {
    // In production, you would integrate with an email service like:
    // - Nodemailer with SMTP
    // - SendGrid
    // - AWS SES
    // - Firebase Email
    
    console.log('=== EMAIL OTP ===');
    console.log('To:', email);
    console.log('Subject: DentalCloud - Verify Your Email');
    console.log('Body:');
    console.log(`
Dear Patient,

Thank you for registering with DentalCloud. Please use the following verification code to complete your registration:

Verification Code: ${code}

This code will expire in 5 minutes.

If you did not request this code, please ignore this email.

Best regards,
DentalCloud Team
    `);
    console.log('=== END EMAIL ===');
    
    // Simulate email sending delay
    await new Promise(resolve => setTimeout(resolve, 1000));
  },

  // Request OTP for email verification
  async requestOTP(email: string): Promise<{ success: boolean; message: string }> {
    try {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return { success: false, message: 'Please enter a valid email address' };
      }

      // Clean up any existing unused codes for this email
      await this.cleanupUnusedCodes(email);
      
      // Generate new OTP
      const code = this.generateOTP();
      
      // Store in database
      await this.storeOTP(email, code);
      
      // Send email (mock)
      await this.sendOTPEmail(email, code);
      
      return { 
        success: true, 
        message: 'Verification code sent to your email address' 
      };
    } catch (error: any) {
      console.error('OTP request failed:', error);
      return { 
        success: false, 
        message: error.message || 'Failed to send verification code' 
      };
    }
  },

  // Cleanup expired OTP codes
  async cleanupExpiredCodes(): Promise<void> {
    try {
      const { error } = await supabase
        .from('otp_codes')
        .delete()
        .lt('expires_at', new Date().toISOString());
      
      if (error) {
        console.warn('Failed to cleanup expired OTP codes:', error);
      }
    } catch (error) {
      console.warn('Error during OTP cleanup:', error);
    }
  },

  // Cleanup unused codes for a specific email
  async cleanupUnusedCodes(email: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('otp_codes')
        .delete()
        .eq('email', email.toLowerCase().trim())
        .eq('used', false);
      
      if (error) {
        console.warn('Failed to cleanup unused OTP codes:', error);
      }
    } catch (error) {
      console.warn('Error during OTP cleanup for email:', error);
    }
  },

  // Validate if email already has an account
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
  }
};