import React, { useState } from 'react';
import { User, Mail, Phone, Lock, Shield, CheckCircle, XCircle, ArrowLeft } from 'lucide-react';
import { otpService } from '../services/otp';
import { api } from '../services/api';
import { Input } from './Shared';

interface PatientRegistrationProps {
  onBack: () => void;
  onRegistrationComplete: () => void;
}

const PatientSelfRegistration: React.FC<PatientRegistrationProps> = ({ onBack, onRegistrationComplete }) => {
  const [step, setStep] = useState<'email' | 'otp' | 'password' | 'complete'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      // Check if email is already registered
      const isRegistered = await otpService.isEmailRegistered(email);
      if (isRegistered) {
        setError('This email is already registered. Please use a different email or login instead.');
        setLoading(false);
        return;
      }
      
      const result = await otpService.requestOTP(email);
      if (result.success) {
        setSuccess(result.message);
        setStep('otp');
      } else {
        setError(result.message);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleOTPSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const isValid = await otpService.verifyOTP(email, otp);
      if (isValid) {
        setSuccess('Email verified successfully!');
        setStep('password');
      } else {
        setError('Invalid or expired verification code. Please try again.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to verify code');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
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
      // Create patient record first
      const patientData = {
        name: email.split('@')[0], // Use email prefix as name for now
        email: email,
        phone: '', // Will be updated later
        medicalHistory: ''
      };
      
      const patient = await api.patients.create(patientData);
      
      // In a real implementation, you would:
      // 1. Store the hashed password in patient_auth table
      // 2. Link the patient_auth record to the patient
      // 3. Set is_verified = true
      
      setSuccess('Account created successfully!');
      setStep('complete');
      
      // Auto-redirect after 2 seconds
      setTimeout(() => {
        onRegistrationComplete();
      }, 2000);
      
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (value: string) => {
    // Only allow numbers and limit to 6 digits
    const numericValue = value.replace(/[^0-9]/g, '').slice(0, 6);
    setOtp(numericValue);
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
              {step === 'email' && 'Enter your email to get started'}
              {step === 'otp' && 'Enter the verification code'}
              {step === 'password' && 'Create your password'}
              {step === 'complete' && 'Registration Complete!'}
            </p>
          </div>

          {/* Progress Indicator */}
          <div className="flex items-center justify-center mb-8">
            <div className="flex items-center space-x-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step === 'email' ? 'bg-indigo-600 text-white' : 
                step === 'otp' || step === 'password' || step === 'complete' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                {step === 'email' ? '1' : <CheckCircle className="w-5 h-5" />}
              </div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step === 'otp' ? 'bg-indigo-600 text-white' : 
                step === 'password' || step === 'complete' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                {step === 'otp' ? '2' : step === 'email' ? '2' : <CheckCircle className="w-5 h-5" />}
              </div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step === 'password' ? 'bg-indigo-600 text-white' : 
                step === 'complete' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                {step === 'password' ? '3' : step === 'otp' || step === 'email' ? '3' : <CheckCircle className="w-5 h-5" />}
              </div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step === 'complete' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                {step === 'complete' ? <CheckCircle className="w-5 h-5" /> : '4'}
              </div>
            </div>
          </div>

          {/* Email Step */}
          {step === 'email' && (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
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
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Sending Code...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    Send Verification Code
                  </>
                )}
              </button>
            </form>
          )}

          {/* OTP Step */}
          {step === 'otp' && (
            <form onSubmit={handleOTPSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Verification Code
                </label>
                <p className="text-sm text-gray-600 mb-3">
                  Enter the 6-digit code sent to <span className="font-medium">{email}</span>
                </p>
                <Input
                  type="text"
                  value={otp}
                  onChange={(e) => handleOtpChange(e.target.value)}
                  placeholder="123456"
                  required
                  maxLength={6}
                  className="w-full text-center text-2xl tracking-widest"
                />
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
              
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep('email')}
                  className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading || otp.length !== 6}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Verifying...
                    </>
                  ) : (
                    <>
                      <Shield className="w-4 h-4" />
                      Verify Code
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Password Step */}
          {step === 'password' && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
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
              
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep('otp')}
                  className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading || password.length < 6 || password !== confirmPassword}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
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
              </div>
            </form>
          )}

          {/* Complete Step */}
          {step === 'complete' && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Registration Complete!</h2>
              <p className="text-gray-600">
                Your account has been created successfully. You can now login to access your dashboard.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
                <p className="font-medium mb-1">Temporary Login Credentials:</p>
                <p><span className="font-medium">Username:</span> {email.split('@')[0]}</p>
                <p><span className="font-medium">Password:</span> patient_{/* patient ID first 8 chars */}</p>
              </div>
            </div>
          )}

          {/* Back to Login */}
          <div className="mt-6 text-center">
            <button
              onClick={onBack}
              className="text-indigo-600 hover:text-indigo-800 font-medium text-sm flex items-center justify-center gap-1 mx-auto"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientSelfRegistration;