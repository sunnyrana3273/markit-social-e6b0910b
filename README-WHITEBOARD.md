# Markit Social - Excalidraw + Supabase Integration Guide

This guide explains how the real-time collaborative whiteboard feature works in Markit Social, powered by Excalidraw and Supabase.

## Architecture Overview

The whiteboard system consists of:

1. **Frontend**: React + Excalidraw for the drawing canvas
2. **Backend**: Supabase for storage and real-time collaboration
3. **Optional Backend Service**: Node.js/Express for additional features (AI, file processing)

## Database Schema

The following tables have been created in Supabase:

### `whiteboard_sessions`
Stores whiteboard session metadata.
- `id`: UUID (primary key)
- `name`: Session name
- `course_id`: Optional link to a course
- `host_user_id`: User who created the session
- `is_active`: Whether the session is active
- `created_at`, `updated_at`: Timestamps

### `whiteboard_scenes`
Stores Excalidraw scene data (elements and app state).
- `id`: UUID (primary key)
- `session_id`: Foreign key to `whiteboard_sessions`
- `elements`: JSONB array of Excalidraw elements
- `app_state`: JSONB object of Excalidraw app state
- `version`: Integer for optimistic locking
- `created_at`, `updated_at`: Timestamps

### `whiteboard_collaborators`
Tracks who is in a session and their presence.
- `id`: UUID (primary key)
- `session_id`: Foreign key to `whiteboard_sessions`
- `user_id`: Foreign key to `auth.users`
- `cursor_position`: JSONB object {x, y}
- `color`: Hex color for the user's cursor
- `is_online`: Boolean for online status
- `last_seen`: Timestamp
- `created_at`: Timestamp

## Setup Instructions

### 1. Apply Database Migration

Run the migration file to create the tables:

```bash
# If using Supabase CLI
supabase db push

# Or manually run the SQL in Supabase Dashboard
# Go to SQL Editor and run: supabase/migrations/20251020000000_create_whiteboard_tables.sql
```

### 2. Configure Environment Variables

Create a `.env.local` file (copy from `.env.docker`):

```env
VITE_SUPABASE_URL=https://wvspwskluqkqeniwtoqf.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

### 3. Run the Frontend

```bash
npm install
npm run dev
```

### 4. (Optional) Run with Docker

Full-stack deployment with Docker Compose:

```bash
# Set environment variables in .env.docker
docker-compose up --build
```

This will start:
- Frontend on http://localhost:5173
- Backend API on http://localhost:3001

## How Real-Time Collaboration Works

### 1. Connection Flow

When a user joins a whiteboard session:

1. **Authentication**: User must be signed in via Supabase Auth
2. **Session Loading**: Fetch session metadata and latest scene data
3. **Collaborator Registration**: Insert/update record in `whiteboard_collaborators`
4. **Real-time Channel**: Subscribe to Supabase Realtime channel for the session

### 2. Scene Updates

When a user draws on the canvas:

1. **Local Change**: Excalidraw fires `onChange` event
2. **Throttled Broadcast**: Hook throttles updates (100ms) and broadcasts via Supabase Realtime
3. **Database Save**: Scene is saved to `whiteboard_scenes` table
4. **Other Clients**: Receive broadcast and update their canvas

### 3. Cursor Tracking

When a user moves their cursor:

1. **Pointer Event**: Excalidraw fires `onPointerUpdate` event
2. **Broadcast**: Cursor position is broadcast via Supabase Realtime
3. **Visual Indicator**: Other clients show a colored cursor with the user's name

### 4. Presence Management

Users are tracked in real-time:

1. **Join**: User's presence is tracked when they subscribe to the channel
2. **Heartbeat**: Supabase automatically maintains presence
3. **Leave**: When user disconnects, they're marked as offline

## API Endpoints (Optional Backend)

If you're running the backend service, these endpoints are available:

### Sessions

- `GET /api/v1/sessions/:sessionId` - Get session info
- `POST /api/v1/sessions` - Create a new session
- `GET /api/v1/sessions/:sessionId/scene` - Get latest scene
- `POST /api/v1/sessions/:sessionId/scene` - Save scene data

### Collaborators

- `GET /api/v1/sessions/:sessionId/collaborators` - Get active collaborators

### File Upload

- `POST /api/v1/upload` - Upload a file (PDF, image)

### AI Assistance

- `POST /api/v1/ai/ask` - Ask AI about selected elements

## Using the Whiteboard Component

```tsx
import Whiteboard from '@/components/Whiteboard';

function StudySession() {
  return (
    <Whiteboard 
      sessionId="your-session-id"
      isHost={true}
      onSceneChange={(elements, appState) => {
        console.log('Scene changed:', elements);
      }}
    />
  );
}
```

## Creating a New Session

Use the `useWhiteboardCollaboration` hook:

```tsx
import { useWhiteboardCollaboration } from '@/hooks/useWhiteboardCollaboration';

function CreateSession() {
  const { createSession } = useWhiteboardCollaboration('temp-id');
  
  const handleCreate = async () => {
    const session = await createSession('My Study Session', 'course-123');
    if (session) {
      // Navigate to /whiteboard/${session.id}
    }
  };
  
  return <button onClick={handleCreate}>Create Whiteboard</button>;
}
```

## Features

### ✅ Implemented

- Real-time collaborative drawing
- Cursor tracking with user names and colors
- Scene persistence to Supabase
- Presence tracking (who's online)
- Connection status indicator
- Export to PNG
- Docker deployment

### 🚧 Coming Soon

- AI assistance for solving problems on the whiteboard
- File upload and conversion to whiteboard elements
- Video/audio calls integration
- Chat with message history
- Version history and undo/redo across users
- Hand-drawn equation recognition
- Collaborative text editing

## Troubleshooting

### Connection Issues

If the whiteboard isn't connecting:

1. Check Supabase credentials in `.env.local`
2. Verify Realtime is enabled for the tables in Supabase Dashboard
3. Check browser console for errors
4. Ensure Row Level Security policies are correctly configured

### Scene Not Loading

If the scene doesn't load:

1. Check the `whiteboard_scenes` table has data
2. Verify the `session_id` matches the URL parameter
3. Check RLS policies allow the user to read scenes

### Cursors Not Showing

If collaborator cursors aren't visible:

1. Ensure `whiteboard_collaborators` table has records
2. Check that `cursor_position` is being broadcast
3. Verify real-time subscription is active

## Performance Optimization

### Throttling

Scene updates are throttled to 100ms to prevent overwhelming the network. Adjust in `useWhiteboardCollaboration.ts`:

```typescript
throttleTimerRef.current = setTimeout(async () => {
  // Broadcast logic
}, 100); // Adjust this value
```

### Debouncing Database Saves

Currently, every throttled update saves to the database. For high-traffic sessions, consider:

1. Increasing throttle delay
2. Implementing a separate debounced save (e.g., 1 second)
3. Using conflict-free replicated data types (CRDTs)

## Security

### Row Level Security (RLS)

All tables have RLS enabled. Users can only:

- View sessions they created or are collaborating on
- Update their own collaborator records
- Insert/update scenes for sessions they're part of

### API Security

The optional backend service uses:

- Helmet.js for security headers
- CORS with configurable origins
- File upload validation
- Request size limits

## Contributing

To add new features:

1. Update the database schema in a new migration file
2. Update the TypeScript types in `src/integrations/supabase/types.ts`
3. Update the hook or component logic
4. Test with multiple users in different browsers

## License

MIT License - See LICENSE file for details

