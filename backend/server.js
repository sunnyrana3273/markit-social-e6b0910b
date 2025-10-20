const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    // Allow common document and image types
    const allowedTypes = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/gif',
      'image/webp',
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF and images are allowed.'));
    }
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes

// Get whiteboard session
app.get('/api/v1/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const { data, error } = await supabase
      .from('whiteboard_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error) throw error;
    
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create whiteboard session
app.post('/api/v1/sessions', async (req, res) => {
  try {
    const { name, course_id, host_user_id } = req.body;
    
    const { data, error } = await supabase
      .from('whiteboard_sessions')
      .insert({
        name,
        course_id,
        host_user_id,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;
    
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get scene data
app.get('/api/v1/sessions/:sessionId/scene', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const { data, error } = await supabase
      .from('whiteboard_scenes')
      .select('*')
      .eq('session_id', sessionId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // Ignore "no rows" error
    
    res.json({ success: true, data: data || null });
  } catch (error) {
    console.error('Error fetching scene:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Save scene data
app.post('/api/v1/sessions/:sessionId/scene', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { elements, app_state, version } = req.body;
    
    const { data, error } = await supabase
      .from('whiteboard_scenes')
      .upsert({
        session_id: sessionId,
        elements,
        app_state,
        version: version || 1,
      })
      .select()
      .single();

    if (error) throw error;
    
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error saving scene:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Upload file endpoint
app.post('/api/v1/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    // TODO: Process file (OCR, convert to whiteboard elements, etc.)
    // For now, just return file info
    
    res.json({
      success: true,
      data: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        path: req.file.path,
      }
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get collaborators
app.get('/api/v1/sessions/:sessionId/collaborators', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const { data, error } = await supabase
      .from('whiteboard_collaborators')
      .select('*')
      .eq('session_id', sessionId)
      .eq('is_online', true);

    if (error) throw error;
    
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching collaborators:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// AI assistance endpoint (placeholder)
app.post('/api/v1/ai/ask', async (req, res) => {
  try {
    const { question, elements, context } = req.body;
    
    // TODO: Integrate with AI service (OpenAI, Anthropic, etc.)
    // For now, return a placeholder response
    
    res.json({
      success: true,
      data: {
        answer: 'AI integration coming soon! This will provide intelligent assistance based on your whiteboard content.',
        confidence: 0.95,
      }
    });
  } catch (error) {
    console.error('Error in AI assistance:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: error.message || 'Internal server error',
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Markit Whiteboard Backend running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

