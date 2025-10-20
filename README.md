# Markit Social - Collaborative Learning Platform

A modern social learning platform with real-time collaborative whiteboards, study sessions, and community features.

## 🎨 **NEW: Collaborative Whiteboard Feature!**

We've integrated Excalidraw with Supabase for real-time collaborative whiteboards. [**Get started in 5 minutes →**](./QUICKSTART-WHITEBOARD.md)

### Quick Links
- 📖 [Whiteboard Documentation](./README-WHITEBOARD.md) - Complete technical guide
- 🚀 [Quick Start Guide](./QUICKSTART-WHITEBOARD.md) - Get up and running fast
- 🚢 [Deployment Guide](./DEPLOYMENT.md) - Production deployment
- 📊 [Feature Summary](./WHITEBOARD-SUMMARY.md) - What's included

---

## Project info

**URL**: https://lovable.dev/projects/c90a3eac-cf10-4abe-964b-a4a80f26cbd7

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/c90a3eac-cf10-4abe-964b-a4a80f26cbd7) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- **Frontend:** React, TypeScript, Vite
- **UI Components:** shadcn-ui, Tailwind CSS
- **Whiteboard:** Excalidraw
- **Backend:** Supabase (PostgreSQL, Realtime, Auth)
- **Deployment:** Vercel, Docker (optional)

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/c90a3eac-cf10-4abe-964b-a4a80f26cbd7) and click on Share -> Publish.

## Features

### ✨ Collaborative Whiteboard
- Real-time drawing and collaboration
- Cursor tracking with user presence
- Automatic scene persistence
- Full Excalidraw toolset (shapes, arrows, text)
- Export to PNG

### 📚 Study & Learning
- Course communities
- Study sessions
- Document upload and editing
- Friend connections

### 🔒 Security
- Supabase authentication
- Row-level security (RLS)
- Session-based access control

## Environment Setup

Create a `.env.local` file with your Supabase credentials:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

Get these from: [Supabase Dashboard](https://supabase.com/dashboard) → Settings → API

## Whiteboard Quick Start

```bash
# 1. Run the database migration in Supabase SQL Editor
# Copy: supabase/migrations/20251020000000_create_whiteboard_tables.sql

# 2. Set up environment
cp .env.docker .env.local
# Edit .env.local with your credentials

# 3. Install and run
npm install
npm run dev

# 4. Navigate to /whiteboard/new in your browser
```

See [QUICKSTART-WHITEBOARD.md](./QUICKSTART-WHITEBOARD.md) for detailed instructions.

## Deployment

### Vercel (Recommended)
```bash
# Connect GitHub repo → Vercel
# Set environment variables
# Deploy!
```

### Docker
```bash
docker-compose up --build
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for full deployment guide.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

## Support

- 🐛 [Report Issues](https://github.com/your-repo/issues)
- 📖 [Whiteboard Docs](./README-WHITEBOARD.md)
- 🚀 [Quick Start](./QUICKSTART-WHITEBOARD.md)
