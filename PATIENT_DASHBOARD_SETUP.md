# Patient Dashboard Setup Guide

## 📋 Overview
This guide will help you set up the Patient Dashboard with OTP-based registration system in your DentalCloud application.

## 🔧 Database Setup

### 1. Run Database Schema
Execute the following SQL script in your Supabase SQL Editor:

**File:** `database/patient_auth_tables.sql`

This will create:
- `patient_auth` table for patient credentials
- `otp_codes` table for OTP management
- Necessary indexes and RLS policies

### 2. Database Tables Structure

#### patient_auth Table
```sql
CREATE TABLE IF NOT EXISTS patient_auth (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(20),
  password VARCHAR(255),
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### otp_codes Table
```sql
CREATE TABLE IF NOT EXISTS otp_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  code VARCHAR(6) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 🚀 Features Implemented

### 1. Patient Authentication
- **Login Methods**: Phone number or patient name + password
- **Session Management**: 24-hour sessions with automatic logout
- **Role-based Access**: Separate 'patient' role from admin/normal users

### 2. OTP Registration System
- **Email Verification**: 6-digit codes with 5-minute expiration
- **Mock Email Sending**: Codes logged to console (configure SMTP later)
- **Self-registration Flow**: Email → OTP → Password setup

### 3. Mobile-Optimized Dashboard
- **Bottom Navigation**: Home, Appointments, Records, Profile
- **Responsive Design**: Works on all device sizes
- **Touch-friendly Interface**: Optimized for mobile use

### 4. Patient Dashboard Sections

#### Home Tab
- Quick stats (appointments count, treatments count)
- Upcoming appointments preview
- Recent treatments preview

#### Appointments Tab
- View all appointments with status
- Appointment details (date, time, doctor, notes)
- Status indicators (Scheduled/Completed/Cancelled)

#### Records Tab
- Treatment history with details
- Cost information
- Teeth involved in treatments

#### Profile Tab
- Personal information
- Contact details
- Account balance
- Loyalty points
- Medical history

## 🔐 Authentication Flow

### Staff Login (Admin/Normal Users)
1. Enter username
2. Enter password
3. Complete CAPTCHA verification
4. Access full admin dashboard

### Patient Login
1. Enter phone number OR patient name
2. Enter password
3. Access patient dashboard

### Patient Self-Registration
1. Enter email address
2. Receive 6-digit OTP (check console logs)
3. Enter verification code
4. Set password
5. Account created and verified

## 🛠️ Configuration

### Environment Variables (.env)
```env
# SMTP Configuration (for production)
SMTP_HOST=your-smtp-host.com
SMTP_PORT=587
SMTP_USER=your-email@domain.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@domain.com

# Supabase (already configured)
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Current Mock Email Setup
OTP codes are currently logged to the browser console. To configure real email sending:
1. Install nodemailer: `npm install nodemailer`
2. Update `services/otp.ts` to use SMTP configuration
3. Add email service credentials to `.env` file

## 📱 Testing Instructions

### 1. Test Patient Login
- **Phone Login**: Use existing patient phone number + generated password
- **Name Login**: Use existing patient name + generated password
- **Password Format**: `patient_{first_8_chars_of_patient_id}`

### 2. Test Self-Registration
1. Click "Patient" tab on login screen
2. Click "Register New Account"
3. Enter email address
4. Check browser console for OTP code
5. Enter OTP code
6. Set password
7. Login with new credentials

### 3. Test Dashboard Features
- Navigate between tabs using bottom navigation
- View appointment details
- Check treatment records
- Update profile information

## ⚠️ Security Notes

### Current Implementation
- Passwords stored as plain text (for development)
- Simple deterministic password generation
- Console-based OTP delivery

### Production Recommendations
- Implement proper password hashing (bcrypt)
- Use secure random password generation
- Configure real SMTP email service
- Add rate limiting for OTP requests
- Implement proper session security

## 📁 Files Created/Modified

### New Files
- `services/otp.ts` - OTP service implementation
- `components/PatientSelfRegistration.tsx` - Self-registration form
- `components/PatientDashboardView.tsx` - Patient dashboard UI
- `database/patient_auth_tables.sql` - Database schema

### Modified Files
- `services/auth.ts` - Added patient authentication methods
- `services/api.ts` - Added patient authenticate method
- `components/LoginView.tsx` - Added patient login mode and registration link
- `App.tsx` - Added patient dashboard routing

## 🆘 Troubleshooting

### Common Issues

1. **OTP Not Received**
   - Check browser console for mock email logs
   - Verify email format is correct

2. **Login Failed**
   - Ensure patient exists in database
   - Check password format: `patient_{first_8_chars_of_id}`
   - Verify patient has valid phone/name

3. **Dashboard Not Loading**
   - Check browser console for errors
   - Verify patient session is active
   - Ensure database connection is working

4. **Registration Errors**
   - Check if email is already registered
   - Verify OTP code format (6 digits)
   - Ensure password meets requirements (6+ characters)

## 📞 Support
For issues or questions, check the browser console for detailed error messages and consult the development team.