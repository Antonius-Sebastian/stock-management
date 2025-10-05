# Deployment Guide - Stock Management System

**Version:** 1.0
**Last Updated:** October 4, 2025

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Database Setup](#database-setup)
4. [Build & Deploy](#build--deploy)
5. [Post-Deployment Verification](#post-deployment-verification)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software
- **Node.js:** v18.17.0 or higher
- **npm:** v9.0.0 or higher
- **PostgreSQL:** v15 or higher (or Supabase account)
- **Git:** For version control

### Required Access
- Production database credentials
- Domain/hosting access (Vercel, Netlify, or VPS)
- SSL certificate (for HTTPS)

---

## Environment Setup

### 1. Generate Production Secrets

```bash
# Generate cryptographically secure secret
openssl rand -base64 32
```

**Example output:** `XVlBzgPqYfKsJmN9RtUwZaB3CdEfGhI2JkLmNoPqRs=`

⚠️ **IMPORTANT:**
- Use DIFFERENT secrets for dev, staging, and production
- Never commit secrets to version control
- Store in secure environment variable service

---

### 2. Create Production Environment File

Create `.env.production` in project root:

```env
# Database Connection (Supabase or PostgreSQL)
DATABASE_URL="postgresql://user:password@host:6543/database?pgbouncer=true"
DIRECT_URL="postgresql://user:password@host:5432/database"

# NextAuth Configuration
NEXTAUTH_SECRET="YOUR_GENERATED_SECRET_HERE"
NEXTAUTH_URL="https://yourdomain.com"
AUTH_SECRET="YOUR_GENERATED_SECRET_HERE"

# Node Environment
NODE_ENV="production"
```

**Replace:**
- `YOUR_GENERATED_SECRET_HERE` - Use the output from step 1
- `yourdomain.com` - Your actual production domain
- Database credentials - Your production database details

---

### 3. Configure Environment Variables

#### For Vercel:
```bash
vercel env add NEXTAUTH_SECRET
vercel env add NEXTAUTH_URL
vercel env add AUTH_SECRET
vercel env add DATABASE_URL
vercel env add DIRECT_URL
```

#### For Netlify:
1. Go to Site Settings → Environment Variables
2. Add each variable from `.env.production`

#### For VPS/Docker:
```bash
# Copy environment file
scp .env.production user@server:/path/to/app/.env

# Or use environment variable service
export NEXTAUTH_SECRET="..."
export NEXTAUTH_URL="..."
```

---

## Database Setup

### Option A: Using Supabase (Recommended)

#### 1. Create Supabase Project
```bash
# Visit https://supabase.com/dashboard
# Create new project
# Copy connection strings
```

#### 2. Run Database Migration
```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# Or use migrations (recommended for production)
npx prisma migrate deploy
```

#### 3. Seed Initial Data
```bash
npx prisma db seed
```

**This creates:**
- 3 default users (admin, factory, office)
- Default password: `password123`

⚠️ **IMPORTANT:** Change default passwords immediately after first login!

---

### Option B: Using Self-Hosted PostgreSQL

#### 1. Create Database
```sql
CREATE DATABASE stock_management;
CREATE USER stock_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE stock_management TO stock_user;
```

#### 2. Update Connection Strings
```env
DATABASE_URL="postgresql://stock_user:secure_password@localhost:5432/stock_management"
DIRECT_URL="postgresql://stock_user:secure_password@localhost:5432/stock_management"
```

#### 3. Run Migrations
```bash
npx prisma migrate deploy
npx prisma db seed
```

---

## Build & Deploy

### Option A: Deploy to Vercel (Easiest)

#### 1. Install Vercel CLI
```bash
npm install -g vercel
```

#### 2. Login to Vercel
```bash
vercel login
```

#### 3. Deploy
```bash
# First deployment
vercel

# Production deployment
vercel --prod
```

#### 4. Configure Domain
```bash
vercel domains add yourdomain.com
```

---

### Option B: Deploy to Netlify

#### 1. Build Production Bundle
```bash
npm run build
```

#### 2. Install Netlify CLI
```bash
npm install -g netlify-cli
```

#### 3. Deploy
```bash
netlify deploy --prod
```

#### 4. Configure Build Settings
- Build command: `npm run build`
- Publish directory: `.next`
- Functions directory: `.netlify/functions`

---

### Option C: Deploy to VPS (Advanced)

#### 1. Build on Server
```bash
# SSH into server
ssh user@your-server.com

# Clone repository
git clone https://github.com/your-repo/stock-management.git
cd stock-management

# Install dependencies
npm ci --production

# Build
npm run build
```

#### 2. Install Process Manager
```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start npm --name "stock-management" -- start

# Save PM2 configuration
pm2 save

# Setup auto-restart on reboot
pm2 startup
```

#### 3. Configure Nginx Reverse Proxy
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### 4. Setup SSL with Let's Encrypt
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

---

### Option D: Deploy with Docker

#### 1. Create Dockerfile
```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000

CMD ["npm", "start"]
```

#### 2. Create docker-compose.yml
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - NEXTAUTH_URL=${NEXTAUTH_URL}
      - AUTH_SECRET=${AUTH_SECRET}
    depends_on:
      - db

  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: stock_management
      POSTGRES_USER: stock_user
      POSTGRES_PASSWORD: secure_password
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

#### 3. Deploy
```bash
docker-compose up -d
```

---

## Post-Deployment Verification

### 1. Health Check

**Visit:** `https://yourdomain.com`

**Expected:** Redirect to `/login` page

---

### 2. Test Authentication

#### Login with Default Admin
```
Username: admin
Password: password123
```

**Expected:** Redirect to `/raw-materials` page

---

### 3. Test Core Features

Follow these steps:

#### ✅ Test 1: Create Raw Material
1. Navigate to Raw Materials page
2. Click "Add Raw Material"
3. Fill form:
   - Code: `TEST-001`
   - Name: `Test Material`
   - MOQ: `100`
4. Submit

**Expected:** Material created successfully

---

#### ✅ Test 2: Record Stock Movement
1. Click "Input Stok Masuk"
2. Select material: `TEST-001`
3. Quantity: `500`
4. Submit

**Expected:** Stock updated to 500

---

#### ✅ Test 3: Create Batch
1. Navigate to Batches page
2. Click "Add Production Batch"
3. Fill form with test data
4. Submit

**Expected:** Batch created, stock reduced

---

#### ✅ Test 4: View Reports
1. Navigate to Reports page
2. Select current month
3. View "Stok Sisa" tab

**Expected:** Shows accurate stock data

---

#### ✅ Test 5: Export Excel
1. On material detail page
2. Click "Export to Excel"

**Expected:** Excel file downloads

---

### 4. Monitor Application Logs

#### Vercel:
```bash
vercel logs
```

#### PM2:
```bash
pm2 logs stock-management
```

#### Docker:
```bash
docker-compose logs -f app
```

---

### 5. Database Connection Test

```bash
# Test database connectivity
npx prisma db pull

# Should successfully connect and pull schema
```

---

## Security Checklist

### Before Going Live

- [ ] Generate unique production secrets
- [ ] Update all environment variables
- [ ] Change default user passwords
- [ ] Enable HTTPS/SSL
- [ ] Configure CORS if needed
- [ ] Set up database backups
- [ ] Configure error monitoring (Sentry)
- [ ] Test authentication flows
- [ ] Verify API endpoints require auth
- [ ] Review database constraints

---

### Recommended Security Headers

Add to `next.config.js`:

```javascript
module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          }
        ]
      }
    ]
  }
}
```

---

## Backup & Restore

### Database Backup

#### Automated Daily Backups (PostgreSQL)
```bash
# Create backup script
cat > backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump -U stock_user stock_management > $BACKUP_DIR/backup_$DATE.sql
# Keep only last 30 days
find $BACKUP_DIR -name "backup_*.sql" -mtime +30 -delete
EOF

chmod +x backup.sh

# Add to crontab (daily at 2 AM)
crontab -e
# Add: 0 2 * * * /path/to/backup.sh
```

#### Manual Backup
```bash
# Export database
pg_dump -U stock_user stock_management > backup.sql

# Or use Prisma
npx prisma db pull
```

---

### Database Restore

```bash
# Restore from backup
psql -U stock_user stock_management < backup.sql

# Or recreate from schema
npx prisma migrate deploy
npx prisma db seed
```

---

## Monitoring & Maintenance

### Setup Error Monitoring (Sentry)

#### 1. Install Sentry
```bash
npm install @sentry/nextjs
npx @sentry/wizard -i nextjs
```

#### 2. Configure Sentry
Add to `.env.production`:
```env
SENTRY_DSN="your-sentry-dsn"
SENTRY_AUTH_TOKEN="your-auth-token"
```

---

### Application Monitoring

**Recommended Tools:**
- **Uptime:** UptimeRobot, Pingdom
- **Performance:** Vercel Analytics, New Relic
- **Logs:** Papertrail, Logtail
- **Database:** Supabase Dashboard, pgAdmin

---

### Regular Maintenance Tasks

#### Daily
- [ ] Check error logs
- [ ] Monitor application uptime
- [ ] Verify database connectivity

#### Weekly
- [ ] Review user reports/feedback
- [ ] Check disk space
- [ ] Verify backups are running

#### Monthly
- [ ] Update dependencies
- [ ] Review security advisories
- [ ] Test backup restoration
- [ ] Rotate secrets (recommended)

---

## Rollback Procedure

### In Case of Critical Issues

#### 1. Revert to Previous Deployment

**Vercel:**
```bash
# List deployments
vercel ls

# Promote previous deployment
vercel promote <deployment-url>
```

**PM2:**
```bash
# Stop current version
pm2 stop stock-management

# Checkout previous version
git checkout <previous-commit>
npm ci
npm run build

# Restart
pm2 restart stock-management
```

---

#### 2. Restore Database

```bash
# Stop application first
pm2 stop stock-management

# Restore database
psql -U stock_user stock_management < backup.sql

# Restart application
pm2 start stock-management
```

---

## Troubleshooting

### Issue: Build Fails

**Check:**
```bash
# Clear cache
rm -rf .next node_modules
npm install
npm run build
```

---

### Issue: Database Connection Errors

**Check:**
1. Environment variables are set correctly
2. Database server is running
3. Firewall allows connections
4. Connection string format is correct

```bash
# Test connection
npx prisma db pull
```

---

### Issue: Authentication Not Working

**Check:**
1. `NEXTAUTH_SECRET` is set and matches
2. `NEXTAUTH_URL` matches your domain (with https://)
3. Cookies are enabled
4. No CORS issues

```bash
# Verify environment
echo $NEXTAUTH_SECRET
echo $NEXTAUTH_URL
```

---

### Issue: 500 Internal Server Error

**Check:**
1. Application logs for error details
2. Database connectivity
3. Environment variables loaded
4. Disk space available

```bash
# View logs
pm2 logs stock-management
# or
vercel logs
```

---

## Performance Optimization

### Enable Caching

Add to `next.config.js`:
```javascript
module.exports = {
  experimental: {
    optimizeCss: true,
  },
  compress: true,
}
```

---

### Database Optimization

```sql
-- Add indexes for frequently queried fields
CREATE INDEX idx_stock_movements_date ON stock_movements(date);
CREATE INDEX idx_stock_movements_raw_material ON stock_movements(raw_material_id);
CREATE INDEX idx_batch_usages_batch ON batch_usages(batch_id);
```

---

### CDN Setup (Optional)

**For Vercel:** Automatic CDN

**For Self-Hosted:**
- Use Cloudflare for CDN + DDoS protection
- Configure caching rules for static assets

---

## Scaling Considerations

### Horizontal Scaling

**Load Balancer Setup:**
```nginx
upstream stock_app {
    server app1.internal:3000;
    server app2.internal:3000;
    server app3.internal:3000;
}

server {
    listen 80;
    location / {
        proxy_pass http://stock_app;
    }
}
```

---

### Database Scaling

1. **Read Replicas:** For read-heavy workloads
2. **Connection Pooling:** Already configured with Supabase
3. **Caching:** Redis for frequently accessed data

---

## Support & Resources

### Documentation
- `TESTING_GUIDE.md` - Manual testing procedures
- `STATUS.md` - Current project status
- `KNOWN_ISSUES.md` - Active bugs and limitations
- `API.md` - API endpoint reference

### External Resources
- [Next.js Deployment Docs](https://nextjs.org/docs/deployment)
- [Vercel Docs](https://vercel.com/docs)
- [Prisma Deployment](https://www.prisma.io/docs/guides/deployment)
- [Supabase Docs](https://supabase.com/docs)

---

## Quick Reference

### Essential Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Database migrations
npx prisma migrate deploy

# Seed database
npx prisma db seed

# Generate Prisma client
npx prisma generate

# View logs (PM2)
pm2 logs stock-management

# Restart app (PM2)
pm2 restart stock-management
```

---

**Last Updated:** October 4, 2025
**Version:** 1.0
**Status:** Production Ready
