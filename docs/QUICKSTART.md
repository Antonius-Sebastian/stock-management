# Quick Start Guide

Get the Stock Management System running in 5 minutes.

---

## Prerequisites

- Node.js 18.17+ installed
- PostgreSQL 15+ or Supabase account
- Terminal/Command line access

---

## Step 1: Clone & Install (1 minute)

```bash
# Clone repository
git clone <repository-url>
cd stock-management

# Install dependencies
npm install
```

---

## Step 2: Configure Environment (2 minutes)

### Option A: Using Supabase (Recommended)

1. Create free account at [supabase.com](https://supabase.com)
2. Create new project
3. Get connection strings from Settings → Database

```bash
# Copy environment template
cp .env.example .env

# Edit .env file
nano .env  # or use your preferred editor
```

Update these values in `.env`:

```env
# Replace with your Supabase connection strings
DATABASE_URL="postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"

# Generate a secure secret
NEXTAUTH_SECRET="<run: openssl rand -base64 32>"
AUTH_SECRET="<same as above>"
NEXTAUTH_URL="http://localhost:3000"
```

### Option B: Using Local PostgreSQL

```bash
# Create database
createdb stock_management

# Update .env
DATABASE_URL="postgresql://localhost:5432/stock_management"
DIRECT_URL="postgresql://localhost:5432/stock_management"
NEXTAUTH_SECRET="<run: openssl rand -base64 32>"
AUTH_SECRET="<same as above>"
NEXTAUTH_URL="http://localhost:3000"
```

---

## Step 3: Setup Database (1 minute)

```bash
# Push schema to database
npx prisma db push

# Seed with initial data (creates default users)
npx prisma db seed
```

**Default users created:**
- `admin` / `password123` (Admin)
- `factory` / `password123` (Factory Staff)
- `office` / `password123` (Office Staff)

---

## Step 4: Start Development Server (30 seconds)

```bash
npm run dev
```

Open browser: http://localhost:3000

---

## Step 5: Login & Explore (30 seconds)

1. **Login**
   - Username: `admin`
   - Password: `password123`

2. **Quick Tour**
   - Raw Materials → Add a test material
   - Click "Input Stok Masuk" → Add stock
   - Batches → Create a test batch
   - Reports → View stock report

---

## ✅ You're Done!

### Next Steps

- **Change default passwords** (important!)
- **Read full documentation** → [../README.md](../README.md)
- **Learn testing** → [guides/TESTING_GUIDE.md](guides/TESTING_GUIDE.md)
- **Deploy to production** → [guides/DEPLOYMENT.md](guides/DEPLOYMENT.md)

---

## 🔧 Troubleshooting

### Error: "Cannot find module '@prisma/client'"

```bash
npx prisma generate
```

### Error: "Invalid DATABASE_URL"

- Check connection string format
- Ensure database is running
- Verify credentials are correct

### Error: "Port 3000 already in use"

```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3001 npm run dev
```

### Error: "Migration failed"

```bash
# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# Push schema again
npx prisma db push
```

---

## 📚 Important Commands

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm start                # Start production server

# Database
npx prisma studio        # Open database GUI
npx prisma db push       # Update schema
npx prisma db seed       # Add seed data
npx prisma generate      # Generate Prisma Client

# Utilities
npm run lint             # Check code style
```

---

## 🎯 Quick Feature Test

### Test Raw Materials

```bash
# 1. Go to: http://localhost:3000/raw-materials
# 2. Click "Add Raw Material"
# 3. Fill:
#    Code: TEST-001
#    Name: Test Sugar
#    MOQ: 100
# 4. Click Create
# 5. Click "Input Stok Masuk"
# 6. Quantity: 500
# 7. Verify stock shows 500 kg
```

### Test Batch Creation

```bash
# 1. Go to: http://localhost:3000/batches
# 2. Click "Add Production Batch"
# 3. Fill:
#    Code: B-001
#    Date: Today
#    Select material: TEST-001
#    Quantity: 100
#    Select finished good: (create one first if needed)
# 4. Click Create
# 5. Verify material stock reduced to 400 kg
```

### Test Reports

```bash
# 1. Go to: http://localhost:3000/reports
# 2. Select current month
# 3. View "Stok Sisa" tab
# 4. Verify shows your test material with 400 kg
```

---

## 🚀 Deploy to Vercel (Bonus - 2 minutes)

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

Set environment variables in Vercel dashboard:
- DATABASE_URL
- DIRECT_URL
- NEXTAUTH_SECRET
- NEXTAUTH_URL (your Vercel domain)
- AUTH_SECRET

---

## 📖 Full Documentation

- **[Main README](../README.md)** - Complete project overview
- **[API Reference](reference/API.md)** - All endpoints
- **[Testing Guide](guides/TESTING_GUIDE.md)** - 80+ test scenarios
- **[Deployment Guide](guides/DEPLOYMENT.md)** - Production setup
- **[Known Issues](reference/KNOWN_ISSUES.md)** - Limitations & workarounds

---

## ❓ Need Help?

1. Check [Known Issues](reference/KNOWN_ISSUES.md)
2. Search documentation
3. Open GitHub issue
4. Contact support

---

**Time to Complete:** ~5 minutes
**Difficulty:** Beginner-friendly
**Last Updated:** October 4, 2025

**Now go build something awesome! 🚀**
