# S3 Settings - Quick Reference Card

## 🚨 Getting 403 Forbidden Error?

**Your Error:**
```
GET https://s3api.nationalcancercenter.click/storage/v1/s3 403 (Forbidden)
```

---

## ✅ INSTANT FIX

### Step 1: Open Settings
Go to **Settings** → **S3 Settings**

### Step 2: Clear All Fields
Make ALL fields **BLANK**:
```
URL:        [delete everything]
Region:     [delete everything]
Access Key: [delete everything]
Secret Key: [delete everything]
```

### Step 3: Save & Refresh
1. Click **Save**
2. **Refresh** the page (Ctrl+F5)
3. Try uploading a file

✅ **Done!** The app will use Supabase Storage automatically.

---

## 📋 Your Supabase S3 Credentials (Local Development)

**Only use these if you MUST configure S3:**

```
URL:        http://127.0.0.1:54321/storage/v1/s3
Region:     local
Access Key: 625729a08b95bf1b7ff351a663f3a23c
Secret Key: 850181e4652dd023b7a98c58ae0d2d34bd487ee0cc3254aed6eda37307425907
```

⚠️ **Warning:** 
- No trailing slash in URL
- Region must be exactly `local`
- Copy keys exactly (no modifications)

---

## 🎯 When to Use What

| Scenario | S3 Settings | Why |
|----------|-------------|-----|
| **Local Development** | ❌ Leave Empty | Supabase Storage works automatically |
| **Production (Supabase)** | ❌ Leave Empty | Simpler, managed by Supabase |
| **Production (AWS S3)** | ✅ Configure | Need external storage |
| **Production (R2/MinIO)** | ✅ Configure | Cost-effective storage |

---

## 🔍 Error Diagnosis

### Your Current Setup
```
Error URL: https://s3api.nationalcancercenter.click/storage/v1/s3
Local URL: http://127.0.0.1:54321/storage/v1/s3
```

**Problem:** You're trying to access a **remote** Supabase but may be using **local** credentials, or the remote instance doesn't have S3 storage configured.

### Solution
- **For local dev:** Clear S3 settings (use Supabase Storage SDK)
- **For remote:** Get S3 credentials from remote Supabase dashboard

---

## 🧪 Testing After Changes

1. **Clear S3 settings** (all fields blank)
2. **Save** in Settings
3. **Refresh** page (Ctrl+F5)
4. Open **F12 Developer Tools**
5. Go to a **Patient page**
6. Try to **upload a file**
7. Check **Network tab**:
   - ✅ Should see successful upload
   - ❌ Should NOT see 403 errors

---

## 📚 Documentation Files

- `database/migrations/FIX_S3_403_ERROR.md` - Detailed troubleshooting
- `database/migrations/SUPABASE_S3_CONFIG.md` - Supabase S3 setup guide
- `database/migrations/S3_TROUBLESHOOTING.md` - All S3 issues & solutions
- `database/migrations/README_S3_MIGRATION.md` - Migration guide

---

## 💡 Pro Tip

**You probably don't need S3 settings at all!**

The Dental Cloud app automatically uses:
- ✅ **Supabase Storage** when S3 settings are empty
- ✅ **S3 Storage** when S3 settings are configured

**Just leave them empty** and it works! 🎉

---

**Print this card for quick reference** 📄
