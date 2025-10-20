# Deployment Guide - Markit Social Whiteboard

This guide covers different deployment strategies for the Markit Social collaborative whiteboard.

## Architecture Options

### Option 1: Frontend-Only (Recommended for MVP)

Deploy the React frontend directly. All collaboration runs through Supabase.

**Pros:**
- Simple deployment
- No backend to manage
- Lower costs
- Automatic scaling with Vercel/Netlify

**Cons:**
- Limited custom server logic
- All processing happens client-side

### Option 2: Full-Stack with Docker

Deploy both frontend and optional backend service.

**Pros:**
- Custom AI integration
- File processing server-side
- Analytics and logging
- More control over data flow

**Cons:**
- More complex deployment
- Higher costs
- Requires server management

---

## Option 1: Frontend-Only Deployment

### Deploy to Vercel (Recommended)

1. **Push to GitHub**

```bash
git add .
git commit -m "Add whiteboard feature"
git push origin main
```

2. **Import to Vercel**

- Go to https://vercel.com/new
- Import your repository
- Framework preset: Vite
- Root directory: `.`

3. **Environment Variables**

Add these in Vercel settings:

```
VITE_SUPABASE_URL=https://wvspwskluqkqeniwtoqf.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

4. **Deploy**

Click "Deploy" and wait ~2 minutes.

Your app will be live at: `https://your-app.vercel.app`

### Deploy to Netlify

1. **Build Command**

```bash
npm run build
```

2. **Publish Directory**

```
dist
```

3. **Environment Variables**

Same as Vercel (in Site Settings → Environment Variables)

4. **Deploy**

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Deploy
netlify deploy --prod
```

---

## Option 2: Docker Deployment

### Prerequisites

- Docker & Docker Compose installed
- A server (VPS, EC2, DigitalOcean Droplet, etc.)
- Domain name (optional but recommended)

### Step 1: Prepare Environment

Create `.env` file:

```bash
cp .env.docker .env
```

Edit with production values:

```env
# Frontend
VITE_SUPABASE_URL=https://wvspwskluqkqeniwtoqf.supabase.co
VITE_SUPABASE_ANON_KEY=your_production_anon_key

# Backend
SUPABASE_URL=https://wvspwskluqkqeniwtoqf.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key
PORT=3001
NODE_ENV=production
CORS_ORIGIN=https://yourdomain.com

# Optional
OPENAI_API_KEY=your_openai_key
```

### Step 2: Build and Deploy

```bash
# Build images
docker-compose build

# Start services
docker-compose up -d

# Check logs
docker-compose logs -f
```

### Step 3: Configure Nginx (Reverse Proxy)

Install Nginx on your server:

```bash
sudo apt update
sudo apt install nginx
```

Create config at `/etc/nginx/sites-available/markit`:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Frontend
    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/markit /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Step 4: Add SSL with Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

---

## Production Checklist

### Security

- [ ] Use environment variables for all secrets
- [ ] Enable HTTPS (SSL certificate)
- [ ] Configure CORS properly
- [ ] Set up rate limiting (optional)
- [ ] Review Supabase RLS policies
- [ ] Use service role key only on backend

### Performance

- [ ] Enable gzip compression
- [ ] Set up CDN (Cloudflare, etc.)
- [ ] Configure caching headers
- [ ] Monitor Supabase usage
- [ ] Set up error tracking (Sentry, etc.)

### Monitoring

- [ ] Set up uptime monitoring
- [ ] Configure log aggregation
- [ ] Monitor Docker container health
- [ ] Track database queries
- [ ] Monitor real-time connections

### Backup

- [ ] Enable Supabase automatic backups
- [ ] Export migrations regularly
- [ ] Document database schema
- [ ] Keep `.env` backup (securely)

---

## Scaling Considerations

### Supabase Limits

**Free Tier:**
- 500MB database
- 1GB file storage
- 2GB bandwidth
- Up to 50k monthly active users

**Upgrade when:**
- You hit any limit
- Need more real-time connections
- Require better performance

### Docker Scaling

For high traffic:

1. **Use Docker Swarm or Kubernetes**
   - Multiple frontend replicas
   - Load balancing
   - Auto-scaling

2. **Separate Database**
   - Move to managed PostgreSQL
   - Or self-host with replication

3. **Add Redis**
   - Cache scene data
   - Rate limiting
   - Session management

---

## Troubleshooting Deployment

### Frontend not loading

**Check:**
1. Build completed successfully
2. Environment variables are set
3. Supabase URL is accessible
4. Check browser console

### Real-time not working

**Check:**
1. Supabase Realtime is enabled
2. Tables are added to publication
3. RLS policies allow access
4. WebSocket connections allowed

### Backend API errors

**Check:**
1. Backend container is running: `docker ps`
2. Environment variables loaded
3. Supabase service key is valid
4. Check logs: `docker-compose logs backend`

---

## Rollback Strategy

If deployment fails:

### Vercel/Netlify

Use the dashboard to revert to previous deployment.

### Docker

```bash
# Stop current deployment
docker-compose down

# Pull previous image
docker pull your-registry/markit-frontend:previous-tag

# Restart
docker-compose up -d
```

### Database

```bash
# Rollback migration
supabase db reset

# Or restore from backup in Supabase dashboard
```

---

## Cost Estimates

### Frontend-Only (Vercel)

- **Vercel Free**: $0/month (hobby projects)
- **Vercel Pro**: $20/month (commercial use)
- **Supabase Free**: $0/month (up to 500MB)
- **Supabase Pro**: $25/month (8GB included)

**Total:** $0-45/month

### Full-Stack Docker

- **VPS (DigitalOcean)**: $12-24/month
- **Supabase Pro**: $25/month
- **Domain**: $10-15/year
- **SSL**: Free (Let's Encrypt)

**Total:** $37-49/month

---

## Next Steps After Deployment

1. **Test thoroughly** with multiple users
2. **Monitor performance** for 24-48 hours
3. **Set up analytics** (Google Analytics, PostHog)
4. **Document API** if using backend
5. **Create user guide** for whiteboard features
6. **Gather feedback** from early users

---

## Support

For deployment issues:

1. Check logs first
2. Review Supabase status: https://status.supabase.com
3. Check Docker status: `docker-compose ps`
4. Review Vercel/Netlify build logs
5. Open GitHub issue with detailed error info

Happy deploying! 🚀

