# How to Get Database Connection Strings from Supabase

You have the Supabase URL and anon keys, but for the **backend with Prisma**, we need the **PostgreSQL database connection strings**.

## Step-by-Step Instructions

### 1. Go to Your Supabase Project Dashboard
- Open https://app.supabase.com
- Click on your project

### 2. Navigate to Database Settings
- Click on **Settings** (gear icon in the left sidebar)
- Click on **Database**

### 3. Find "Connection String" Section
Scroll down until you see **"Connection String"** section.

### 4. Get the Connection Strings

You'll see a dropdown with different modes. Get **TWO** connection strings:

#### A. Pooled Connection (for DATABASE_URL)
1. In the dropdown, select **"Connection Pooling"**
2. Select **"Session"** mode
3. Copy the connection string - it will look like:
   ```
   postgresql://postgres.xxx:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
   ```
4. **IMPORTANT**: Add `?pgbouncer=true` at the end:
   ```
   postgresql://postgres.xxx:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
   ```
5. Replace `[YOUR-PASSWORD]` with your actual database password (the one you set when creating the project)

#### B. Direct Connection (for DIRECT_URL and SHADOW_DATABASE_URL)
1. In the dropdown, select **"Direct Connection"**
2. Copy the connection string - it will look like:
   ```
   postgresql://postgres.xxx:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres
   ```
3. Replace `[YOUR-PASSWORD]` with your actual database password

### 5. Update Your .env File

Open `/Users/sagardabas/Desktop/bot-arena-backend/.env` and update:

```env
# Replace these with the connection strings you just copied
DATABASE_URL="postgresql://postgres.xxx:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.xxx:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres"
SHADOW_DATABASE_URL="postgresql://postgres.xxx:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres"
```

## Visual Guide

```
Supabase Dashboard
└── Settings (⚙️)
    └── Database
        └── Connection String
            ├── Connection Pooling (Session mode) → DATABASE_URL
            └── Direct Connection → DIRECT_URL & SHADOW_DATABASE_URL
```

## What About the Keys You Have?

The keys you mentioned are for **client-side** applications:
- `SUPABASE_URL` - Used by frontend apps
- `SUPABASE_ANON_KEY` - Public key for client-side access
- `SUPABASE_SERVICE_ROLE_KEY` - Private key (if you have it)

For a **Node.js backend with Prisma**, we need the **PostgreSQL connection strings** instead, which give direct database access.

## Can't Find Your Database Password?

If you forgot your database password:
1. Go to **Settings** → **Database**
2. Scroll to **"Database Password"** section
3. Click **"Reset Database Password"**
4. Set a new password
5. Use this new password in your connection strings

## Next Steps After Getting Connection Strings

1. ✅ Update `.env` with the connection strings
2. ✅ Run the SQL schema in Supabase SQL Editor (copy from `supabase-setup.sql`)
3. ✅ Test locally: `npm run dev`
4. ✅ Deploy to production

Need help? Let me know which step you're stuck on!
