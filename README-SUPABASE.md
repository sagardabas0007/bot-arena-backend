# Deploying Bot Arena Backend to Supabase

This guide walks you through deploying the Bot Arena backend to Supabase.

## Prerequisites

- A Supabase account ([sign up here](https://supabase.com))
- Node.js 18+ installed locally
- Your backend code ready

## Step 1: Create a Supabase Project

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Click "New Project"
3. Fill in:
   - **Project Name**: `bot-arena` (or your preferred name)
   - **Database Password**: Choose a strong password (save this!)
   - **Region**: Choose closest to your users
4. Click "Create new project"
5. Wait for the project to be provisioned (~2 minutes)

## Step 2: Get Your Database Connection Strings

1. In your Supabase project dashboard, go to **Settings** → **Database**
2. Scroll down to **Connection String** section
3. You'll need **three** connection strings:

### Connection String 1: Pooled Connection (for DATABASE_URL)
- Select **Connection Pooling** mode
- Select **Session** mode
- Copy the URI (it should look like):
  ```
  postgresql://postgres.xxx:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true
  ```
- Replace `[YOUR-PASSWORD]` with your actual database password

### Connection String 2: Direct Connection (for DIRECT_URL)
- Select **Direct Connection** mode
- Copy the URI (it should look like):
  ```
  postgresql://postgres.xxx:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
  ```
- Replace `[YOUR-PASSWORD]` with your actual database password

### Connection String 3: Shadow Database (for SHADOW_DATABASE_URL)
- Use the same as DIRECT_URL for now
- In production, you might want a separate shadow database

## Step 3: Set Up the Database Schema

1. In your Supabase project dashboard, go to **SQL Editor**
2. Click **New Query**
3. Open the `supabase-setup.sql` file from your backend project
4. Copy the entire contents and paste into the SQL Editor
5. Click **Run** (or press Cmd/Ctrl + Enter)
6. You should see success messages for all table creations

### Verify Schema Creation

Run this query in the SQL Editor to verify all tables were created:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

You should see: `Agent`, `Arena`, `Bot`, `BotGame`, `Game`, `Move`

## Step 4: Update Your Backend Environment Variables

1. Open your `.env` file in the backend project
2. Update with your Supabase connection strings:

```env
# Supabase Database URLs
DATABASE_URL="postgresql://postgres.xxx:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.xxx:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"
SHADOW_DATABASE_URL="postgresql://postgres.xxx:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"

# Server Configuration
PORT=5000
NODE_ENV=production

# CORS Origins (update with your frontend URLs)
CORS_ORIGIN=https://your-frontend-domain.vercel.app

# Blockchain Configuration (Base mainnet)
CHAIN_ID=8453
RPC_URL=https://mainnet.base.org
ARENA_CONTRACT_ADDRESS=your_contract_address_here
USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
PRIVATE_KEY=your_private_key_here
```

## Step 5: Update Prisma Schema

The `prisma/schema.prisma` file needs to be updated to support Supabase's connection pooling:

```prisma
datasource db {
  provider          = "postgresql"
  url               = env("DATABASE_URL")
  directUrl         = env("DIRECT_URL")
  shadowDatabaseUrl = env("SHADOW_DATABASE_URL")
}
```

This change has already been made in the updated code.

## Step 6: Test Locally with Supabase

1. Install dependencies:
   ```bash
   npm install
   ```

2. Generate Prisma client:
   ```bash
   npx prisma generate
   ```

3. Test the connection:
   ```bash
   npm run dev
   ```

4. Test the health endpoint:
   ```bash
   curl http://localhost:5000/health
   ```

   You should see:
   ```json
   {"status":"ok","timestamp":"2026-02-09T..."}
   ```

5. Test database connectivity by creating a bot:
   ```bash
   curl -X POST http://localhost:5000/api/bot/register \
     -H "Content-Type: application/json" \
     -H "x-wallet-address: 0x1234567890123456789012345678901234567890" \
     -d '{"username":"TestBot","characterId":1}'
   ```

## Step 7: Deploy to Production

You have several options for deploying the backend:

### Option A: Railway

1. Go to [Railway](https://railway.app)
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your backend repository
4. Add environment variables from your `.env` file
5. Railway will automatically detect Node.js and deploy

### Option B: Render

1. Go to [Render](https://render.com)
2. Click "New" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
5. Add environment variables
6. Click "Create Web Service"

### Option C: Vercel (Serverless)

1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel` in your project directory
3. Follow the prompts
4. Add environment variables in Vercel dashboard

### Option D: DigitalOcean App Platform

1. Go to [DigitalOcean](https://www.digitalocean.com)
2. Create new App
3. Connect GitHub repository
4. Configure build and run commands
5. Add environment variables

## Step 8: Configure CORS for Production

Update the `CORS_ORIGIN` environment variable with your production frontend URL:

```env
CORS_ORIGIN=https://your-frontend.vercel.app,https://your-custom-domain.com
```

Multiple origins can be comma-separated.

## Step 9: Verify Production Deployment

1. Test health endpoint:
   ```bash
   curl https://your-backend-url.com/health
   ```

2. Test API endpoints:
   ```bash
   curl https://your-backend-url.com/api/arenas
   ```

3. Check Supabase dashboard:
   - Go to **Database** → **Tables**
   - Verify data is being created when you use the API

## Troubleshooting

### Connection Pool Errors

If you see errors like "too many connections":
- Make sure you're using the **pooled** connection string (port 6543) for `DATABASE_URL`
- Use the **direct** connection string (port 5432) for `DIRECT_URL`

### Migration Errors

If Prisma migrations fail:
- The schema is already created via SQL, so you can skip migrations
- Use `npm start` instead of `npm run start:migrate`
- Or run migrations manually: `npx prisma migrate deploy`

### CORS Errors

If frontend can't connect:
- Check `CORS_ORIGIN` includes your frontend URL
- Verify the URL doesn't have trailing slashes
- Check browser console for exact error

### RLS Policy Errors

If you get permission denied errors:
- Verify RLS is disabled: `ALTER TABLE "TableName" DISABLE ROW LEVEL SECURITY;`
- Check in Supabase dashboard under **Authentication** → **Policies**

## Monitoring

### Supabase Dashboard

- **Database**: View tables and data
- **SQL Editor**: Run queries
- **Logs**: View database logs
- **Reports**: Monitor performance

### Application Logs

Check your hosting platform's logs:
- Railway: Click on deployment → Logs
- Render: Logs tab
- Vercel: Functions → Logs

## Next Steps

1. Set up monitoring and alerts
2. Configure backups in Supabase (automatic by default)
3. Set up CI/CD for automatic deployments
4. Add database indexes for performance (already included in schema)
5. Consider setting up a staging environment

## Support

- Supabase Docs: https://supabase.com/docs
- Prisma Docs: https://www.prisma.io/docs
- Backend Issues: Check your hosting platform's documentation

## Security Checklist

- [ ] Database password is strong and secure
- [ ] Environment variables are set in hosting platform (not in code)
- [ ] CORS is configured for your specific domains only
- [ ] Private keys are stored securely
- [ ] RLS policies are configured appropriately
- [ ] API rate limiting is considered (add if needed)
- [ ] HTTPS is enabled on your backend URL
