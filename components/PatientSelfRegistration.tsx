import React, { useState } from 'react';
import { User, Mail, Lock, CheckCircle, XCircle, ArrowLeft, RefreshCw, Inbox, Phone, KeyRound } from 'lucide-react';
import { otpService } from '../services/otp';
import { Input } from './Shared';

interface PatientRegistrationProps {
  onBack: () => void;
  onRegistrationComplete: () => void;
}

const PatientSelfRegistration: React.FC<PatientRegistrationProps> = ({ 
  onBack, 
  onRegistrationComplete
}) => {
  // Flow: signup -> otp -> result
  const [step, setStep] = useState<'signup' | 'otp' | 'result'>('signup');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [verificationSucceeded, setVerificationSucceeded] = useState(false);
  
  const isValidUsername = (value: string) => /^[a-zA-Z0-9._-]{3,30}$/.test(value);


  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const normalizedUsername = username.trim();
    const normalizedEmail = email.toLowerCase().trim();
    const normalizedPhone = phone.trim();

    if (!normalizedUsername) {
      setError('Username is required');
      return;
    }
    
    if (!isValidUsername(normalizedUsername)) {
      setError('Username must be 3-30 characters and use letters, numbers, dot, underscore, or hyphen.');
      return;
    }

    if (email !== normalizedEmail) {
      setEmail(normalizedEmail);
    }
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }
    
    setLoading(true);
    
    try {
      // Check if email is already registered in patient_auth
      const isRegistered = await otpService.isEmailRegistered(normalizedEmail);
      if (isRegistered) {
        setError('This email is already registered. Please use a different email or login instead.');
        setLoading(false);
        return;
      }
      
      const usernameRegistered = await otpService.isUsernameRegistered(normalizedUsername);
      if (usernameRegistered) {
        setError('This username is already taken. Please choose a different one.');
        setLoading(false);
        return;
      }

      
      // Send OTP email through the existing Resend-backed email provider.
      const result = await otpService.sendSignupOtpEmail(normalizedEmail, {
        username: normalizedUsername,
        phone: normalizedPhone,
      }, password);
      
      if (result.success) {
        setSuccess(result.message);
        setStep('otp');
      } else {
        setError(result.message || 'Failed to create account');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmail = async () => {
    setError('');
    setSuccess('');
    setResending(true);
    
    try {
      const result = await otpService.resendSignupOtp(email);
      if (result.success) {
        setSuccess(result.message);
      } else {
        setError(result.message);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to resend OTP code');
    } finally {
      setResending(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedCode = otpCode.trim();
    if (!/^\d{6}$/.test(normalizedCode)) {
      setError('Please enter the 6-digit OTP code from your email.');
      return;
    }

    setLoading(true);
    try {
      const result = await otpService.verifySignupOtp(normalizedEmail, normalizedCode);
      setVerificationSucceeded(result.success);
      if (result.success) {
        setSuccess(result.message || 'Account verified successfully. You can now log in.');
      } else {
        setError(result.message || 'OTP verification failed. Please try again.');
      }
      setStep('result');
    } catch (err: any) {
      setVerificationSucceeded(false);
      setError(err.message || 'Failed to verify OTP code.');
      setStep('result');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-6">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-full mb-4">
              <User className="w-8 h-8 text-indigo-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Patient Registration</h1>
            <p className="text-gray-600">
              {step === 'signup' && 'Create your account'}
              {step === 'otp' && 'Enter OTP code'}
              {step === 'result' && (verificationSucceeded ? 'Registration Complete!' : 'Verification Failed')}
            </p>
          </div>

          {/* Progress Indicator */}
          <div className="flex items-center justify-center mb-8">
            <div className="flex items-center space-x-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step === 'signup' ? 'bg-indigo-600 text-white' : 
                step === 'otp' || step === 'result' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                {step === 'signup' ? '1' : <CheckCircle className="w-5 h-5" />}
              </div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step === 'otp' ? 'bg-indigo-600 text-white' : 
                step === 'result' && verificationSucceeded ? 'bg-green-500 text-white' : step === 'result' ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                {step === 'otp' ? '2' : step === 'result' ? (verificationSucceeded ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />) : '2'}
              </div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step === 'result' && verificationSucceeded ? 'bg-green-500 text-white' : step === 'result' ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                {step === 'result' ? (verificationSucceeded ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />) : '3'}
              </div>
            </div>
          </div>

          {/* Signup Step - Email and Password */}
          {step === 'signup' && (
            <form onSubmit={handleSignupSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Username
                </label>
                <Input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Choose a username"
                  required
                  className="w-full"
                />
                <p className="text-[11px] text-gray-400 mt-1">3-30 characters. Letters, numbers, dot, underscore, or hyphen.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email Address
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  required
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Phone Number (optional)
                </label>
                <Input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g., 09-123456789"
                  className="w-full"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Password
                </label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a password"
                  required
                  className="w-full"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Confirm Password
                </label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  required
                  className="w-full"
                />
              </div>
              
              <div className="text-xs text-gray-500">
                <ul className="space-y-1">
                  <li className="flex items-center gap-1">
                    {password.length >= 6 ? (
                      <CheckCircle className="w-3 h-3 text-green-500" />
                    ) : (
                      <XCircle className="w-3 h-3 text-red-500" />
                    )}
                    At least 6 characters
                  </li>
                  <li className="flex items-center gap-1">
                    {password && password === confirmPassword ? (
                      <CheckCircle className="w-3 h-3 text-green-500" />
                    ) : (
                      <XCircle className="w-3 h-3 text-red-500" />
                    )}
                    Passwords match
                  </li>
                </ul>
              </div>
              
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-start gap-2">
                  <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  {error}
                </div>
              )}
              
              {success && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700 flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  {success}
                </div>
              )}
              
              <button
                type="submit"
                disabled={loading || password.length < 6 || password !== confirmPassword}
                className="w-full bg-[var(--hover-600)] hover:bg-[var(--hover-700)] text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Creating Account...
                  </>
                ) : (
                  <>
                    <User className="w-4 h-4" />
                    Create Account
                  </>
                )}
              </button>
            </form>
          )}

          {/* OTP Verification Step */}
          {step === 'otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-6">
              <div className="text-center">
                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Inbox className="w-10 h-10 text-blue-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Enter OTP Code</h2>
                <p className="text-gray-600">We've sent a 6-digit OTP code to:</p>
                <p className="font-medium text-indigo-600 mt-1">{email}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                  <KeyRound className="w-4 h-4" />
                  OTP Code
                </label>
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Enter 6-digit code"
                  required
                  className="w-full text-center tracking-[0.4em] font-bold text-lg"
                />
                <p className="text-xs text-gray-500 mt-2">The code expires in 30 minutes.</p>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-700">
                <p><strong>Tip:</strong> If you don't see the email, check your spam or junk folder.</p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-start gap-2">
                  <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  {error}
                </div>
              )}

              {success && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700 flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  {success}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || otpCode.length !== 6}
                className="w-full bg-[var(--hover-600)] hover:bg-[var(--hover-700)] text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Verifying...
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    Verify OTP
                  </>
                )}
              </button>

              <div className="text-center space-y-3">
                <p className="text-sm text-gray-600">
                  Didn't receive the code?{' '}
                  <button
                    type="button"
                    onClick={handleResendEmail}
                    disabled={resending}
                    className="text-indigo-600 hover:text-indigo-800 font-medium inline-flex items-center gap-1"
                  >
                    {resending ? (
                      <>
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        Resending...
                      </>
                    ) : (
                      'Resend OTP'
                    )}
                  </button>
                </p>

                <button
                  type="button"
                  onClick={() => {
                    setStep('signup');
                    setOtpCode('');
                    setError('');
                    setSuccess('');
                  }}
                  className="text-gray-500 hover:text-gray-700 text-sm flex items-center justify-center gap-1 mx-auto"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Use a different email
                </button>
              </div>
            </form>
          )}

          {/* Result Step */}
          {step === 'result' && (
            <div className="text-center space-y-4">
              {loading ? (
                <>
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                    <div className="w-8 h-8 border-3 border-[var(--hover-600)] border-t-transparent rounded-full animate-spin"></div>
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">Setting up your account...</h2>
                  <p className="text-gray-600">Please wait while we complete your registration.</p>
                </>
              ) : (
                <>
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${verificationSucceeded ? 'bg-green-100' : 'bg-red-100'}`}>
                    {verificationSucceeded ? <CheckCircle className="w-8 h-8 text-green-600" /> : <XCircle className="w-8 h-8 text-red-600" />}
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">{verificationSucceeded ? 'Registration Complete!' : 'Verification Failed'}</h2>
                  <p className="text-gray-600">
                    {verificationSucceeded ? 'Your account has been verified successfully. You can now log in to access your dashboard.' : (error || 'OTP verification failed. Please try again or request a new code.')}
                  </p>
                  {verificationSucceeded && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
                      <p className="font-medium mb-1">Your Login Credentials:</p>
                      <p><span className="font-medium">Email:</span> {email}</p>
                      {username && <p><span className="font-medium">Username:</span> {username}</p>}
                      {phone && <p><span className="font-medium">Phone:</span> {phone}</p>}
                      <p><span className="font-medium">Password:</span> (The password you set)</p>
                    </div>
                  )}
                  
                  {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-start gap-2">
                      <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      {error}
                    </div>
                  )}
                  
                  <button
                    onClick={() => {
                      if (verificationSucceeded) {
                        onRegistrationComplete();
                      } else {
                        setStep('otp');
                        setError('');
                        setSuccess('');
                      }
                    }}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-lg transition-colors"
                  >
                    {verificationSucceeded ? 'Go to Login' : 'Try Again'}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Back to Login */}
          {step !== 'result' && (
            <div className="mt-6 text-center">
              <button
                onClick={onBack}
                className="text-indigo-600 hover:text-indigo-800 font-medium text-sm flex items-center justify-center gap-1 mx-auto"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PatientSelfRegistration;
