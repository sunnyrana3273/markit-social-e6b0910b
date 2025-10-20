# Quickstart: Excalidraw + Supabase Integration

Get your collaborative whiteboard up and running in 5 minutes!

## Prerequisites

- Node.js 18+
- Supabase account (free tier works!)
- npm or yarn

## Setup Steps

### 1. Database Setup

Run the migration in your Supabase Dashboard:

1. Go to https://supabase.com/dashboard/project/wvspwskluqkqeniwtoqf
2. Click "SQL Editor" in the sidebar
3. Copy the contents of `supabase/migrations/20251020000000_create_whiteboard_tables.sql`
4. Paste and click "Run"

✅ You should see: "Success. No rows returned"

### 2. Environment Setup

Copy the example environment file:

```bash
cp .env.docker .env.local
```

Edit `.env.local` with your Supabase credentials:

```env
VITE_SUPABASE_URL=https://wvspwskluqkqeniwtoqf.supabase.co
VITE_SUPABASE_ANON_KEY=your_actual_anon_key
```

**Where to find your keys:**
1. Go to Supabase Dashboard → Settings → API
2. Copy "Project URL" and "anon public" key

### 3. Install Dependencies

```bash
npm install
```

### 4. Start Development Server

```bash
npm run dev
```

### 5. Test It Out!

1. Open http://localhost:5173
2. Sign in (or sign up)
3. Navigate to the whiteboard page
4. Start drawing!

## Testing Real-Time Collaboration

To test real-time features:

1. Open the app in **two different browsers** (or incognito mode)
2. Sign in with different accounts in each
3. Open the same whiteboard session
4. Draw in one browser → see it appear in the other!

## Docker Deployment (Optional)

For production deployment:

```bash
# Set up environment
cp .env.docker .env

# Edit .env with your production credentials
nano .env

# Build and start
docker-compose up --build
```

Access at:
- Frontend: http://localhost:80
- Backend API: http://localhost:3001

## Quick Integration Example

Add a whiteboard to any page:

```tsx
import Whiteboard from '@/components/Whiteboard';

function MyPage() {
  // Create a session ID (or get from route params)
  const sessionId = "my-study-session-123";
  
  return (
    <div className="h-screen">
      <Whiteboard sessionId={sessionId} />
    </div>
  );
}
```

## Features Out of the Box

✅ Real-time collaborative drawing  
✅ Cursor tracking with names  
✅ Automatic scene persistence  
✅ Online/offline indicators  
✅ Export to PNG  
✅ Full Excalidraw features (shapes, arrows, text, etc.)

## Troubleshooting

### "Connection failed" error

**Solution:** Check your Supabase credentials in `.env.local`

### Scene not loading

**Solution:** Make sure you ran the migration SQL in Supabase Dashboard

### Realtime not working

**Solution:** 
1. Go to Supabase Dashboard → Database → Replication
2. Enable replication for: `whiteboard_sessions`, `whiteboard_scenes`, `whiteboard_collaborators`

### Can't see other users' cursors

**Solution:** Make sure you're signed in with different accounts in each browser

## Next Steps

- Read `README-WHITEBOARD.md` for detailed documentation
- Customize the UI in `src/components/Whiteboard.tsx`
- Add AI features using the optional backend service
- Integrate with your course/study session system

## Need Help?

- Check the browser console for errors
- Review the Supabase logs in the Dashboard
- Open an issue on GitHub

Happy collaborating! 🎨✨

