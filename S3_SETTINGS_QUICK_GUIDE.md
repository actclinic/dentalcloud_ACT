# S3 Settings - Quick Setup Guide

## ✅ Good News!

Your `complete_database_setup.sql` **already includes** all S3 settings support. You don't need to update it!

## 📋 What You Need to Do

### For Existing Supabase Database (Already Running)

Run the migration script to add S3 settings:

**File:** `database/migrations/add_s3_settings.sql`

#### Steps:

1. Open Supabase SQL Editor
2. Copy contents of `add_s3_settings.sql`
3. Paste and run
4. Verify all checks show ✅ YES

### For Fresh Database (New Installation)

Just run:

**File:** `database/complete_database_setup.sql`

This already has S3 settings built-in!

## 🎯 After Migration

1. Login as **admin** to your Dental Cloud app
2. Navigate to **Settings** → **S3 Settings**
3. Enter your S3 bucket details:
   - URL (e.g., `https://s3.amazonaws.com/my-bucket`)
   - Region (e.g., `us-east-1`)
   - Access Key
   - Secret Key
4. Click **Save**

## 🔧 S3 Bucket Setup Required

Your S3 bucket needs CORS configuration:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["ETag", "Content-Length"],
    "MaxAgeSeconds": 3000
  }
]
```

⚠️ Replace `"*"` in `AllowedOrigins` with your actual domain in production!

## 📁 Files Created

```
database/
├── migrations/
│   ├── add_s3_settings.sql           ← Migration for existing databases
│   └── README_S3_MIGRATION.md        ← Detailed migration guide
└── complete_database_setup.sql       ← Already has S3 settings ✅
```

## 🧪 Verification

After running the migration, you should see:

```
=== S3 SETTINGS MIGRATION COMPLETE ===
app_settings table exists          | ✅ YES
s3_url column                      | ✅ YES
s3_access_key column               | ✅ YES
s3_secret_key column               | ✅ YES
s3_region column                   | ✅ YES
Default row exists                 | ✅ YES
=== MIGRATION SUCCESSFUL - S3 SETTINGS READY ===
```

## 🔄 How It Works

- **Without S3 settings**: App uses Supabase Storage (default)
- **With S3 settings configured**: App uses your S3 bucket for file uploads
- **Switch anytime**: Clear S3 settings to revert to Supabase Storage

## 📚 Full Documentation

See `database/migrations/README_S3_MIGRATION.md` for:
- Detailed migration steps
- S3 bucket configuration
- Troubleshooting
- Security best practices

---

**Created:** April 6, 2026
**Status:** Ready to use ✅
