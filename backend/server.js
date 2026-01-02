import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import OpenAI from 'openai';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import twilio from 'twilio';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { requireUser, getUserFromRequest } from './middleware/auth.js';
import { incrementAndCheckUsage, getUsageToday } from './lib/usageTracking.js';
import { getPlanConfig } from './lib/subscription.js';
import { 
  validateInput, 
  uuidSchema, 
  planTypeSchema, 
  contentSchema, 
  titleSchema 
} from './lib/validation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';

// Trust proxy - Required for Render and other proxied environments
// This ensures req.ip and secure cookies work correctly
app.set('trust proxy', 1);

// ============================
// Security Middleware
// ============================

// Helmet - Security headers
app.use(helmet({
  contentSecurityPolicy: false, // Disable for now, configure properly for production
  crossOriginEmbedderPolicy: false,
}));

// CORS - Configure allowed origins
// In production, use FRONTEND_ORIGIN env var; in development, allow localhost
const allowedOrigins = isProduction
  ? [process.env.FRONTEND_ORIGIN].filter(Boolean) // Only production origin
  : [
      process.env.FRONTEND_ORIGIN,
      process.env.FRONTEND_URL,
      'http://localhost:8080',
      'http://localhost:5173', // Vite default
      'http://localhost:3000',
    ].filter(Boolean);

// Warn if FRONTEND_ORIGIN is not set in production
if (isProduction && !process.env.FRONTEND_ORIGIN) {
  console.error('❌ WARNING: FRONTEND_ORIGIN environment variable is not set in production!');
  console.error('CORS will reject all cross-origin requests.');
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, curl, etc.)
    // In production, be more strict about this
    if (!origin) {
      return callback(null, !isProduction);
    }
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    console.warn(`CORS blocked request from origin: ${origin}`);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'stripe-signature']
}));

// Rate Limiting - General
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 100 : 1000, // Limit each IP (more lenient in dev)
  message: { success: false, error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/api/health', // Don't limit health checks
});

// Rate Limiting - Strict for expensive operations (AI, payments)
const strictLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: isProduction ? 10 : 100, // 10 requests per minute in production
  message: { success: false, error: 'Rate limit exceeded. Please wait before trying again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate Limiting - Auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 20 : 100, // 20 attempts per 15 minutes
  message: { success: false, error: 'Too many authentication attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply general rate limiter to all routes
app.use(generalLimiter);

// Body parsing middleware
// IMPORTANT: Skip express.json() for Stripe webhook route - it needs the raw body for signature verification
app.use((req, res, next) => {
  if (req.originalUrl === '/api/webhooks/stripe') {
    next(); // Skip JSON parsing for webhook route
  } else {
    express.json({ limit: '10mb' })(req, res, next);
  }
});
app.use(express.urlencoded({ limit: '10mb', extended: true })); // This handles Twilio's form-encoded POST requests

// Initialize OpenAI - API key from environment variable
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error('❌ ERROR: OPENAI_API_KEY environment variable is required');
  console.error('Please set OPENAI_API_KEY in your .env file');
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

console.log('✅ OpenAI API key loaded successfully');

// Initialize Supabase client
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wvspwskluqkqeniwtoqf.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ ERROR: SUPABASE_SERVICE_KEY environment variable is required');
  console.error('Please set SUPABASE_SERVICE_KEY in your .env file');
  console.warn('⚠️  NOTE: Do NOT use the anon key here. Use the service_role key for backend operations.');
  process.exit(1);
}

// Check if we're using service role key (should start with eyJ and contain "service_role" in payload)
if (SUPABASE_SERVICE_KEY.includes('anon')) {
  console.warn('⚠️  WARNING: Detected anon key. For backend operations, use SUPABASE_SERVICE_KEY (service_role key) instead.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

console.log('✅ Supabase client initialized');

// Initialize Twilio
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_API_KEY = process.env.TWILIO_API_KEY;
const TWILIO_API_SECRET = process.env.TWILIO_API_SECRET;
const TWILIO_APP_SID = process.env.TWILIO_APP_SID;

if (TWILIO_ACCOUNT_SID && TWILIO_API_KEY && TWILIO_API_SECRET) {
  console.log('✅ Twilio credentials loaded successfully');
} else {
  console.warn('⚠️ Twilio credentials not configured. Voice calling will not work.');
}

// Initialize Stripe
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
let stripe = null;

if (STRIPE_SECRET_KEY) {
  stripe = new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: '2024-11-20.acacia',
  });
  console.log('✅ Stripe initialized successfully');
} else {
  console.warn('⚠️ Stripe secret key not configured. Payment processing will not work.');
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, join(__dirname, 'uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + '.png');
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Ensure uploads directory exists
const uploadsDir = join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

/**
 * Route to process images with OpenAI Vision API
 * POST /api/process-image
 * Body: FormData with 'image' file and optional 'prompt' text
 * Headers: Authorization: Bearer <token>
 */
app.post('/api/process-image', strictLimiter, requireUser(), upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image file provided' });
    }

    const user = req.user;

    // Track usage and check limits
    try {
      await incrementAndCheckUsage(user, supabase);
    } catch (usageError) {
      // Clean up file before returning error
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(429).json({
        success: false,
        error: usageError.message || 'Daily query limit exceeded'
      });
    }

    const prompt = req.body.prompt || 'Analyze this image and provide a detailed description.';

    // Read the uploaded image
    const imageBuffer = fs.readFileSync(req.file.path);
    const base64Image = imageBuffer.toString('base64');

    // Call OpenAI Vision API
    const response = await openai.chat.completions.create({
      model: "gpt-5-mini-2025-08-07",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${base64Image}`,
              },
            },
          ],
        },
      ],
      max_completion_tokens: 4000,
    });

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    // Extract the response text
    const analysis = response.choices[0]?.message?.content || 'No analysis available';

    res.json({
      success: true,
      analysis: analysis,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error processing image:', error);
    
    // Clean up file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    // If it's a usage error, return 429
    if (error.message && error.message.includes('limit')) {
      return res.status(429).json({
        success: false,
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process image'
    });
  }
});

/**
 * Route to process whiteboard/text images with specific analysis
 * POST /api/analyze-whiteboard
 * Body: FormData with 'image' file
 * Headers: Authorization: Bearer <token>
 */
app.post('/api/analyze-whiteboard', strictLimiter, requireUser(), upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image file provided' });
    }

    const user = req.user;

    // Track usage and check limits
    try {
      await incrementAndCheckUsage(user, supabase);
    } catch (usageError) {
      // Clean up file before returning error
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(429).json({
        success: false,
        error: usageError.message || 'Daily query limit exceeded'
      });
    }

    // Read the uploaded image
    const imageBuffer = fs.readFileSync(req.file.path);
    const base64Image = imageBuffer.toString('base64');

    // Get custom prompt from request body, or use default
    const customPrompt = req.body.prompt;
    
    // Enhanced prompt that encourages LaTeX formatting
    let basePrompt = `This is a whiteboard/drawing image from a study session. Please provide a detailed, step-by-step solution.

IMPORTANT FORMATTING REQUIREMENTS:
- Use LaTeX syntax for all mathematical expressions:
  * Inline math: \\(...\\) for expressions within sentences (e.g., \\(f(x) = 5x + b\\))
  * Block/display math: \\[...\\] for equations on their own lines (e.g., \\[m = \\frac{2-1}{-\\tfrac{18}{5}-(-\\tfrac{19}{5})}\\])
  * Fractions: Use \\tfrac{numerator}{denominator} for inline fractions or \\frac{numerator}{denominator} for display
  * Answers: Wrap final answers in \\boxed{...} (e.g., \\boxed{h(x)=5x+7})
  * Use proper LaTeX commands: \\Longrightarrow for arrows, \\quad for spacing

- Structure your response with:
  * Clear step-by-step headings (Step 1, Step 2, etc.)
  * Proper spacing between paragraphs
  * Block equations for major calculations
  * Boxed final answers

- Format example:
  **Step 1.** Compute the slope \\(m\\). Use the first two points:
  \\[
  m = \\frac{1-0}{-\\tfrac{19}{5}-(-4)} = \\frac{1}{-\\tfrac{19}{5} + \\tfrac{20}{5}} = \\frac{1}{\\tfrac{1}{5}} = 5.
  \\]
  
  Answer: \\boxed{h(x)=5x+7}

Now provide a detailed solution:`;
    
    const prompt = customPrompt 
      ? `${customPrompt}\n\n${basePrompt}` 
      : basePrompt;

    const response = await openai.chat.completions.create({
      model: "gpt-5-mini-2025-08-07",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${base64Image}`,
              },
            },
          ],
        },
      ],
      max_completion_tokens: 4000,
    });

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    // Extract the response text
    const analysis = response.choices[0]?.message?.content || 'No analysis available';

    // Extract token usage if available
    const tokenUsage = response.usage ? {
      prompt_tokens: response.usage.prompt_tokens || 0,
      completion_tokens: response.usage.completion_tokens || 0,
      total_tokens: response.usage.total_tokens || 0
    } : null;

    res.json({
      success: true,
      analysis: analysis,
      topics: extractTopics(analysis),
      timestamp: new Date().toISOString(),
      tokenUsage: tokenUsage
    });

  } catch (error) {
    console.error('Error analyzing whiteboard:', error);
    
    // Clean up file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    // If it's a usage or feature error, return appropriate status
    if (error.message && (error.message.includes('limit') || error.message.includes('subscription'))) {
      return res.status(error.message.includes('limit') ? 429 : 403).json({
        success: false,
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to analyze whiteboard'
    });
  }
});

/**
 * Route to extract text from images (OCR-like functionality)
 * POST /api/extract-text
 * Body: FormData with 'image' file
 * Headers: Authorization: Bearer <token>
 */
app.post('/api/extract-text', requireUser(), upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image file provided' });
    }

    const user = req.user;

    // Track usage and check limits
    try {
      await incrementAndCheckUsage(user, supabase);
    } catch (usageError) {
      // Clean up file before returning error
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(429).json({
        success: false,
        error: usageError.message || 'Daily query limit exceeded'
      });
    }

    // Read the uploaded image
    const imageBuffer = fs.readFileSync(req.file.path);
    const base64Image = imageBuffer.toString('base64');

    // Call OpenAI Vision API for text extraction
    const response = await openai.chat.completions.create({
      model: "gpt-5-mini-2025-08-07",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Extract all visible text from this image. Include equations, formulas, notes, and any written content. Format the output as clear, readable text." },
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${base64Image}`,
              },
            },
          ],
        },
      ],
      max_completion_tokens: 4000,
    });

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    // Extract the text
    const extractedText = response.choices[0]?.message?.content || 'No text found';

    res.json({
      success: true,
      text: extractedText,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error extracting text:', error);
    
    // Clean up file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    // If it's a usage error, return 429
    if (error.message && error.message.includes('limit')) {
      return res.status(429).json({
        success: false,
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to extract text'
    });
  }
});

/**
 * Route to generate a practice question from whiteboard image
 * POST /api/generate-question
 * Body: JSON with 'image' (base64) and 'instructions'
 * Headers: Authorization: Bearer <token>
 */
app.post('/api/generate-question', strictLimiter, requireUser(), async (req, res) => {
  try {
    const user = req.user;
    const { image, instructions, context } = req.body;
    
    if (!image) {
      console.warn('[generate-question] Missing image in request body');
      return res.status(400).json({ success: false, error: 'No image provided' });
    }

    // Validate instructions if provided (optional field)
    let validatedInstructions = '';
    if (instructions && typeof instructions === 'string') {
      const instructionsValidation = validateInput(contentSchema, instructions);
      if (!instructionsValidation.success) {
        return res.status(400).json({ 
          success: false, 
          error: `Invalid instructions: ${instructionsValidation.error}` 
        });
      }
      validatedInstructions = instructionsValidation.data;
    }

    // Validate context if provided (optional field)
    let validatedContext = '';
    if (context && typeof context === 'string') {
      const contextValidation = validateInput(contentSchema, context);
      if (!contextValidation.success) {
        return res.status(400).json({ 
          success: false, 
          error: `Invalid context: ${contextValidation.error}` 
        });
      }
      validatedContext = contextValidation.data;
    }

    // Track usage and check limits
    try {
      await incrementAndCheckUsage(user, supabase);
    } catch (usageError) {
      return res.status(429).json({
        success: false,
        error: usageError.message || 'Daily query limit exceeded'
      });
    }

    const baseInstructions = validatedInstructions || [
      'You are given a screenshot of a whiteboard from a study session.',
      'Create ONE new, related practice problem based strictly on the topics and context visible in the screenshot.',
      'Rules:',
      '- Write the problem in plain English using only standard keyboard characters (ASCII).',
      '- Do NOT use LaTeX, markdown, emojis, or special symbols.',
      '- If math is needed, write fractions as a/b (e.g., 19/5) and sqrt(x) for roots.',
      '- Output ONLY the concrete problem statement: no solution, no hints, no steps, no meta-instructions.',
      '- Do not include phrases like "Create a problem", "State the question", or any directives—just the finalized problem text.',
      '- Make it self-contained and solvable without referencing the screenshot.',
    ].join(' ');

    const contextSnippet = validatedContext;
    const prompt = contextSnippet
      ? `${baseInstructions}\n\nAdditional context from a worked solution (do NOT copy it, just use as guidance for topic and difficulty):\n${contextSnippet.substring(0, 2000)}`
      : baseInstructions;

    console.log('[generate-question] Request received', {
      imageLength: typeof image === 'string' ? image.length : null,
      promptLength: prompt.length,
      hasContext: !!contextSnippet,
    });

    // Primary attempt: Vision completion with image
    const response = await openai.chat.completions.create({
      model: "gpt-5-mini-2025-08-07",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: image,
              },
            },
          ],
        },
      ],
      max_completion_tokens: 4000,
    });

    // Debug: log full primary response (without API key)
    try {
      console.log('[generate-question] Primary OpenAI response raw:', JSON.stringify(response, null, 2));
    } catch (e) {
      console.warn('[generate-question] Failed to stringify primary response', e);
    }

    const choice = response?.choices?.[0]?.message?.content;
    console.log('[generate-question] OpenAI response meta', {
      choices: Array.isArray(response?.choices) ? response.choices.length : 0,
      hasContent: !!choice,
    });

    if (choice && choice.trim()) {
      const question = choice.trim();
      return res.json({ success: true, question, timestamp: new Date().toISOString() });
    }

    // Fallback #1: Extract text from image
    console.warn('[generate-question] No content from primary call; attempting text extraction');
    const extractResp = await openai.chat.completions.create({
      model: "gpt-5-mini-2025-08-07",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Extract the key text and topics from this image. Return plain text only." },
            { type: "image_url", image_url: { url: image } },
          ],
        },
      ],
      max_completion_tokens: 4000,
    });
    // Debug: log extraction response
    try {
      console.log('[generate-question] Extract OpenAI response raw:', JSON.stringify(extractResp, null, 2));
    } catch (e) {
      console.warn('[generate-question] Failed to stringify extract response', e);
    }

    const extracted = extractResp?.choices?.[0]?.message?.content || '';
    console.log('[generate-question] Extracted text length', extracted.length);

    // Fallback #2: Generate from extracted text (text-only)
    const textOnlyPrompt = [
      'Create ONE new, related practice problem based on the following notes.',
      'Write in plain English using only standard keyboard characters (ASCII).',
      'No LaTeX/markdown/symbols/emojis. Fractions as a/b, sqrt(x) allowed.',
      'Output ONLY the problem statement, self-contained and solvable.',
      'Notes:',
      extracted.substring(0, 4000),
      contextSnippet ? '\nAdditional context from a worked solution (do NOT copy it):\n' + contextSnippet.substring(0, 2000) : ''
    ].join('\n');

    const textOnlyResp = await openai.chat.completions.create({
      model: "gpt-5-mini-2025-08-07",
      messages: [
        { role: "user", content: textOnlyPrompt },
      ],
      max_completion_tokens: 600,
    });
    // Debug: log text-only generation response
    try {
      console.log('[generate-question] Text-only OpenAI response raw:', JSON.stringify(textOnlyResp, null, 2));
    } catch (e) {
      console.warn('[generate-question] Failed to stringify text-only response', e);
    }

    const textOnlyChoice = textOnlyResp?.choices?.[0]?.message?.content || '';
    console.log('[generate-question] Text-only generation content length', textOnlyChoice.length);

    if (textOnlyChoice && textOnlyChoice.trim()) {
      const question = textOnlyChoice.trim();
      return res.json({ success: true, question, timestamp: new Date().toISOString() });
    }

    // Fallback: if text-only generation is empty but we have extracted text,
    // return the extracted question/statement as the practice question.
    if (extracted && extracted.trim()) {
      console.warn('[generate-question] Using extracted text as fallback practice question');
      const question = extracted.trim();
      return res.json({ success: true, question, timestamp: new Date().toISOString() });
    }

    console.warn('[generate-question] All attempts returned empty content');
    return res.status(200).json({ success: false, error: 'NoContent' });

  } catch (error) {
    console.error('Error generating question:', error);

    // If it's a usage error, return 429
    if (error.message && error.message.includes('limit')) {
      return res.status(429).json({
        success: false,
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate question'
    });
  }
});

/**
 * Route to rewrite content into detailed plain-English steps
 * POST /api/rewrite-steps
 * Body: JSON { content: string, instructions?: string }
 * Headers: Authorization: Bearer <token>
 */
app.post('/api/rewrite-steps', strictLimiter, requireUser(), async (req, res) => {
  try {
    const user = req.user;
    const { content, instructions } = req.body || {};
    
    // Validate content (required)
    const contentValidation = validateInput(contentSchema, content);
    if (!contentValidation.success) {
      return res.status(400).json({ 
        success: false, 
        error: contentValidation.error || 'Invalid content' 
      });
    }
    const validatedContent = contentValidation.data;

    // Validate instructions if provided (optional)
    let validatedInstructions = '';
    if (instructions && typeof instructions === 'string') {
      const instructionsValidation = validateInput(titleSchema, instructions);
      if (!instructionsValidation.success) {
        return res.status(400).json({ 
          success: false, 
          error: `Invalid instructions: ${instructionsValidation.error}` 
        });
      }
      validatedInstructions = instructionsValidation.data;
    }

    // Track usage and check limits
    try {
      await incrementAndCheckUsage(user, supabase);
    } catch (usageError) {
      return res.status(429).json({
        success: false,
        error: usageError.message || 'Daily query limit exceeded'
      });
    }

    const prompt = [
      validatedInstructions || 'Rewrite the solution as clear, numbered steps.',
      'Formatting requirements:',
      '- Number each step: Step 1., Step 2., etc.',
      '- Use LaTeX for all mathematical expressions (inline \(...\), display \[...\], and \boxed{} for final answers where appropriate).',
      '- Keep prose concise but complete; maintain any important explanations.',
      'Content to rewrite:',
      validatedContent.substring(0, 8000),
    ].join('\n');

    const response = await openai.chat.completions.create({
      model: 'gpt-5-mini-2025-08-07',
      messages: [
        { role: 'user', content: prompt },
      ],
      max_completion_tokens: 1200,
    });

    const steps = (response?.choices?.[0]?.message?.content || '').trim();
    if (!steps) {
      console.warn('[rewrite-steps] Empty response from OpenAI');
      return res.status(200).json({ success: true, steps: 'Step 1: No actionable steps found.' });
    }

    res.json({ success: true, steps, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error rewriting steps:', error);
    
    // If it's a usage error, return 429
    if (error.message && error.message.includes('limit')) {
      return res.status(429).json({
        success: false,
        error: error.message
      });
    }

    res.status(500).json({ success: false, error: error.message || 'Failed to rewrite steps' });
  }
});

/**
 * TwiML endpoint for handling voice calls
 * POST /api/twilio/voice
 * This endpoint is called by Twilio when routing calls
 */
app.post('/api/twilio/voice', (req, res) => {
  try {
    // Twilio sends form-encoded data, so we need to parse it from req.body
    const To = req.body.To || req.body.to;
    const From = req.body.From || req.body.from;
    const CallSid = req.body.CallSid || req.body.CallSid;
    
    console.log('═══════════════════════════════════════════════════════');
    console.log('[Twilio Voice] 📞📞📞 RECEIVED TWiML REQUEST 📞📞📞');
    console.log('[Twilio Voice] Request details:', { 
      To, 
      From, 
      CallSid,
      body: req.body,
      headers: req.headers['content-type'],
      method: req.method,
      url: req.url,
      ip: req.ip
    });
    console.log('[Twilio Voice] Full request body:', JSON.stringify(req.body, null, 2));
    console.log('═══════════════════════════════════════════════════════');
    
    // Get the TwiML response object
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();
    
    // For browser-to-browser calls, we use <Dial> with <Client>
    // The "To" parameter contains the user ID (identity) we want to call
    if (To) {
      // Dial the client using their identity (user ID)
      const dial = response.dial({
        callerId: From, // The caller's identity
      });
      dial.client(To); // The recipient's identity (user ID)
      console.log('[Twilio Voice] Dialing client:', To, 'from:', From);
    } else {
      // Fallback if no "To" parameter
      console.warn('[Twilio Voice] No "To" parameter provided. Request body:', req.body);
      response.say('No recipient specified');
    }
    
    const twimlResponse = response.toString();
    console.log('[Twilio Voice] ✅ Sending TwiML response:');
    console.log('[Twilio Voice] TwiML:', twimlResponse);
    console.log('[Twilio Voice] Response will dial client:', To);
    console.log('═══════════════════════════════════════════════════════');
    
    // Set content type and send TwiML response
    res.type('text/xml');
    res.send(twimlResponse);
  } catch (error) {
    console.error('[Twilio Voice] Error generating TwiML:', error);
    console.error('[Twilio Voice] Error stack:', error.stack);
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();
    response.say('An error occurred while processing the call');
    res.type('text/xml');
    res.send(response.toString());
  }
});

/**
 * Route to moderate content using OpenAI Moderation API
 * POST /api/moderate-content
 * Body: { text: string, contentType: 'post' | 'reply', image?: string (base64) }
 */
app.post('/api/moderate-content', async (req, res) => {
  try {
    const { text, contentType, image } = req.body;

    // Validate text content (required)
    const textValidation = validateInput(contentSchema, text);
    if (!textValidation.success) {
      return res.status(400).json({
        success: false,
        error: textValidation.error || 'Text content is required'
      });
    }
    const validatedText = textValidation.data;

    // Validate contentType using enum
    if (!contentType || !['post', 'reply'].includes(contentType)) {
      return res.status(400).json({
        success: false,
        error: 'Content type must be "post" or "reply"'
      });
    }

    // Prepare input for moderation - can be text only or text + image
    let moderationInput;
    if (image && typeof image === 'string') {
      // If image is provided, use vision model to analyze both text and image
      // For image moderation, we need to use the chat completions API with vision
      // since the moderation API doesn't directly support images
      // We'll extract text from the image and combine with the text content
      try {
        // Use vision API to describe the image for moderation purposes
        const visionResponse = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: "Describe this image in detail, including any text, objects, people, or content visible. Be thorough and explicit." },
                {
                  type: "image_url",
                  image_url: {
                    url: image.startsWith('data:') ? image : `data:image/png;base64,${image}`,
                  },
                },
              ],
            },
          ],
          max_tokens: 500,
        });
        
        const imageDescription = visionResponse.choices[0]?.message?.content || '';
        // Combine text and image description for moderation
        moderationInput = `${validatedText}\n\nImage content: ${imageDescription}`;
      } catch (visionError) {
        console.error('[Moderation] Error analyzing image with vision API:', visionError);
        // Fallback to text-only moderation if vision fails
        moderationInput = validatedText;
      }
    } else {
      moderationInput = validatedText;
    }

    // Call OpenAI Moderation API
    const moderation = await openai.moderations.create({
      model: "omni-moderation-latest",
      input: moderationInput,
    });

    const result = moderation.results[0];
    
    // Categories to block: inappropriate content including slurs, hate speech, harassment, violence, and NSFW
    const blockedCategories = {
      sexual: result.categories.sexual,
      'sexual/minors': result.categories['sexual/minors'],
      hate: result.categories.hate, // Blocks slurs and hate speech
      'hate/threatening': result.categories['hate/threatening'],
      harassment: result.categories.harassment,
      'harassment/threatening': result.categories['harassment/threatening'],
      violence: result.categories.violence,
      'violence/graphic': result.categories['violence/graphic'],
      'self-harm': result.categories['self-harm'],
      'self-harm/intent': result.categories['self-harm/intent'],
      'self-harm/instructions': result.categories['self-harm/instructions'],
    };

    // Check if any blocked categories are flagged
    const isBlocked = 
      blockedCategories.sexual || 
      blockedCategories['sexual/minors'] ||
      blockedCategories.hate ||
      blockedCategories['hate/threatening'] ||
      blockedCategories.harassment ||
      blockedCategories['harassment/threatening'] ||
      blockedCategories.violence ||
      blockedCategories['violence/graphic'] ||
      blockedCategories['self-harm'] ||
      blockedCategories['self-harm/intent'] ||
      blockedCategories['self-harm/instructions'];

    // Build reason if blocked
    let reason = null;
    if (isBlocked) {
      const reasons = [];
      if (blockedCategories.sexual) {
        reasons.push('inappropriate sexual content');
      }
      if (blockedCategories['sexual/minors']) {
        reasons.push('content involving minors');
      }
      if (blockedCategories.hate || blockedCategories['hate/threatening']) {
        reasons.push('hate speech or slurs');
      }
      if (blockedCategories.harassment || blockedCategories['harassment/threatening']) {
        reasons.push('harassment');
      }
      if (blockedCategories.violence || blockedCategories['violence/graphic']) {
        reasons.push('violent content');
      }
      if (blockedCategories['self-harm'] || blockedCategories['self-harm/intent'] || blockedCategories['self-harm/instructions']) {
        reasons.push('self-harm content');
      }
      reason = reasons.join(', ');
    }

    // Log moderation attempt for audit
    console.log('[Moderation] Content checked:', {
      contentType,
      textLength: validatedText.length,
      hasImage: !!image,
      isBlocked,
      reason,
      categories: {
        sexual: result.categories.sexual,
        'sexual/minors': result.categories['sexual/minors'],
        hate: result.categories.hate,
        'hate/threatening': result.categories['hate/threatening'],
        harassment: result.categories.harassment,
        'harassment/threatening': result.categories['harassment/threatening'],
        violence: result.categories.violence,
        'violence/graphic': result.categories['violence/graphic'],
        'self-harm': result.categories['self-harm'],
        flagged: result.flagged
      }
    });

    res.json({
      success: true,
      blocked: isBlocked,
      reason: reason || undefined,
      categories: {
        sexual: result.categories.sexual,
        'sexual/minors': result.categories['sexual/minors'],
        hate: result.categories.hate,
        'hate/threatening': result.categories['hate/threatening'],
        harassment: result.categories.harassment,
        'harassment/threatening': result.categories['harassment/threatening'],
        violence: result.categories.violence,
        'violence/graphic': result.categories['violence/graphic'],
        'self-harm': result.categories['self-harm'],
        'self-harm/intent': result.categories['self-harm/intent'],
        'self-harm/instructions': result.categories['self-harm/instructions'],
        flagged: result.flagged
      }
    });

  } catch (error) {
    console.error('[Moderation] Error checking content:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to moderate content'
    });
  }
});

/**
 * Route to generate Twilio access token for voice calls
 * POST /api/twilio/token
 * Body: { userId: string }
 */
app.post('/api/twilio/token', async (req, res) => {
  try {
    const { userId } = req.body;

    // Validate UUID format
    const validation = validateInput(uuidSchema, userId);
    if (!validation.success) {
      return res.status(400).json({ 
        success: false, 
        error: validation.error || 'Invalid user ID format' 
      });
    }

    const validatedUserId = validation.data;

    if (!TWILIO_ACCOUNT_SID || !TWILIO_API_KEY || !TWILIO_API_SECRET || !TWILIO_APP_SID) {
      return res.status(500).json({ 
        success: false, 
        error: 'Twilio is not configured. Please set up Twilio credentials.' 
      });
    }

    // Create access token
    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    // Create a voice grant
    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: TWILIO_APP_SID,
      incomingAllow: true, // Allow incoming calls
    });

    // Create an access token
    const token = new AccessToken(
      TWILIO_ACCOUNT_SID,
      TWILIO_API_KEY,
      TWILIO_API_SECRET,
      { identity: validatedUserId, ttl: 3600 } // Token expires in 1 hour
    );

    token.addGrant(voiceGrant);

    // Serialize the token to a JWT string
    const jwt = token.toJwt();

    res.json({
      success: true,
      token: jwt,
      identity: validatedUserId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error generating Twilio token:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate access token'
    });
  }
});

/**
 * Route to get user's subscription status and usage
 * GET /api/user/subscription
 * Headers: Authorization: Bearer <token>
 */
app.get('/api/user/subscription', requireUser(), async (req, res) => {
  try {
    const user = req.user;
    const config = getPlanConfig(user);
    const usageToday = await getUsageToday(user, supabase);

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        plan: user.plan,
        plan_expires_at: user.plan_expires_at,
      },
      usage: {
        today: usageToday,
        limit: config.maxDailyQueries,
        remaining: Number.isFinite(config.maxDailyQueries) 
          ? Math.max(0, config.maxDailyQueries - usageToday)
          : Infinity,
      },
      features: {
        canUploadTextbookPDFs: config.canUploadTextbookPDFs,
        maxPagesPerPDF: config.maxPagesPerPDF,
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching subscription status:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch subscription status'
    });
  }
});

/**
 * Route to get comprehensive subscription details
 * GET /api/user/subscription-details
 * Headers: Authorization: Bearer <token>
 */
app.get('/api/user/subscription-details', requireUser(), async (req, res) => {
  try {
    const user = req.user;
    
    // Get current plan from profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('plan, plan_expires_at, knowledge_points')
      .eq('id', user.id)
      .single();

    // Get KP redemptions
    const { data: redemptions } = await supabase
      .from('subscription_redemptions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    // Get Stripe subscriptions if Stripe is configured
    let stripeSubscriptions = [];
    let stripePayments = [];
    
    if (stripe) {
      try {
        // Find customer by email
        const customers = await stripe.customers.list({
          email: user.email,
          limit: 1,
        });

        if (customers.data.length > 0) {
          const customer = customers.data[0];
          
          // Get subscriptions
          const subscriptions = await stripe.subscriptions.list({
            customer: customer.id,
            status: 'all',
            limit: 100,
          });

          stripeSubscriptions = await Promise.all(
            subscriptions.data.map(async (sub) => {
              // Get payment intents/invoices for this subscription
              const invoices = await stripe.invoices.list({
                subscription: sub.id,
                limit: 100,
              });

              return {
                id: sub.id,
                status: sub.status,
                plan: sub.metadata?.plan || 'unknown',
                current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
                current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
                cancel_at_period_end: sub.cancel_at_period_end,
                canceled_at: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
                created: new Date(sub.created * 1000).toISOString(),
                items: sub.items.data.map(item => ({
                  price_id: item.price.id,
                  amount: item.price.unit_amount / 100, // Convert from cents
                  currency: item.price.currency,
                  interval: item.price.recurring?.interval,
                })),
                invoices: invoices.data.map(inv => ({
                  id: inv.id,
                  amount_paid: inv.amount_paid / 100,
                  currency: inv.currency,
                  status: inv.status,
                  created: new Date(inv.created * 1000).toISOString(),
                  paid_at: inv.status_transitions.paid_at ? new Date(inv.status_transitions.paid_at * 1000).toISOString() : null,
                  period_start: inv.period_start ? new Date(inv.period_start * 1000).toISOString() : null,
                  period_end: inv.period_end ? new Date(inv.period_end * 1000).toISOString() : null,
                })),
              };
            })
          );

          // Get all payment intents for this customer
          const paymentIntents = await stripe.paymentIntents.list({
            customer: customer.id,
            limit: 100,
          });

          stripePayments = paymentIntents.data
            .filter(pi => pi.status === 'succeeded')
            .map(pi => ({
              id: pi.id,
              amount: pi.amount / 100,
              currency: pi.currency,
              status: pi.status,
              created: new Date(pi.created * 1000).toISOString(),
              description: pi.description,
            }));
        }
      } catch (stripeError) {
        console.warn('Error fetching Stripe data:', stripeError.message);
        // Continue without Stripe data
      }
    }

    // Determine effective plan
    const now = new Date();
    const expiresAt = profile?.plan_expires_at ? new Date(profile.plan_expires_at) : null;
    const isExpired = expiresAt && expiresAt < now;
    const effectivePlan = isExpired ? 'free' : (profile?.plan || 'free');

    // Get active KP redemption
    const activeRedemption = redemptions?.find(
      r => r.is_active && new Date(r.expires_at) > now
    );

    // Get active Stripe subscription
    const activeStripeSub = stripeSubscriptions.find(
      s => s.status === 'active' && new Date(s.current_period_end) > now
    );

    res.json({
      success: true,
      currentPlan: {
        plan: effectivePlan,
        plan_expires_at: profile?.plan_expires_at,
        isExpired,
        source: activeStripeSub ? 'stripe' : (activeRedemption ? 'kp' : 'free'),
      },
      knowledgePoints: profile?.knowledge_points || 0,
      kpRedemptions: redemptions?.map(r => ({
        id: r.id,
        subscription_type: r.subscription_type,
        knowledge_points_spent: r.knowledge_points_spent,
        expires_at: r.expires_at,
        created_at: r.created_at,
        is_active: r.is_active,
        isExpired: new Date(r.expires_at) < now,
      })) || [],
      stripeSubscriptions: stripeSubscriptions,
      stripePayments: stripePayments,
      nextBilling: activeStripeSub ? activeStripeSub.current_period_end : null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching subscription details:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch subscription details'
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'MarkIt backend server is running',
    timestamp: new Date().toISOString()
  });
});

// Helper function to extract topics from analysis
function extractTopics(analysis) {
  const lines = analysis.split('\n');
  const topics = [];
  
  for (const line of lines) {
    if (line.includes('**') || line.match(/^\d+\./)) {
      topics.push(line.replace(/[*#]/g, '').trim());
    }
  }
  
  return topics.length > 0 ? topics : [analysis.substring(0, 200)];
}

/**
 * Create Stripe Checkout Session for subscription
 * POST /api/create-checkout-session
 * Body: { plan: 'plus' | 'pro' }
 */
app.post('/api/create-checkout-session', strictLimiter, requireUser(), async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ error: 'Stripe not configured' });
  }

  try {
    const user = await getUserFromRequest(req);
    const { plan } = req.body;

    // Validate plan type using schema
    const planValidation = validateInput(planTypeSchema, plan);
    if (!planValidation.success) {
      return res.status(400).json({ 
        error: planValidation.error || 'Invalid plan. Must be "plus" or "pro"' 
      });
    }

    const validatedPlan = planValidation.data;

    // Price IDs from Stripe
    const priceIds = {
      plus: 'price_1Ska9MBb5yZzWKrB2cqyoY2W', // $7/month
      pro: 'price_1Ska9QBb5yZzWKrBeUn4nJH1',  // $15/month
    };

    const priceId = priceIds[validatedPlan];

    if (!priceId) {
      return res.status(400).json({ error: 'Price not found for plan' });
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/app?subscription=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/pricing?subscription=cancelled`,
      customer_email: user.email,
      metadata: {
        user_id: user.id,
        plan: validatedPlan,
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          plan: validatedPlan,
        },
      },
    });

    res.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: error.message || 'Failed to create checkout session' });
  }
});

/**
 * Cancel Stripe subscription
 * POST /api/cancel-subscription
 * Headers: Authorization: Bearer <token>
 * Body: { subscriptionId: string }
 */
app.post('/api/cancel-subscription', requireUser(), async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ 
      success: false,
      error: 'Stripe not configured' 
    });
  }

  try {
    const user = await getUserFromRequest(req);
    const { subscriptionId } = req.body;

    if (!subscriptionId) {
      return res.status(400).json({ 
        success: false,
        error: 'Subscription ID is required' 
      });
    }

    // Verify the subscription belongs to the user
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    // Get customer by email to verify ownership
    const customers = await stripe.customers.list({
      email: user.email,
      limit: 1,
    });

    if (customers.data.length === 0 || subscription.customer !== customers.data[0].id) {
      return res.status(403).json({ 
        success: false,
        error: 'Subscription does not belong to this user' 
      });
    }

    // Cancel the subscription at period end (recommended approach)
    const canceledSubscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });

    res.json({
      success: true,
      message: 'Subscription will be canceled at the end of the current billing period',
      subscription: {
        id: canceledSubscription.id,
        status: canceledSubscription.status,
        cancel_at_period_end: canceledSubscription.cancel_at_period_end,
        current_period_end: new Date(canceledSubscription.current_period_end * 1000).toISOString(),
      },
    });
  } catch (error) {
    console.error('Error canceling subscription:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to cancel subscription' 
    });
  }
});

/**
 * Reactivate canceled Stripe subscription
 * POST /api/reactivate-subscription
 * Headers: Authorization: Bearer <token>
 * Body: { subscriptionId: string }
 */
app.post('/api/reactivate-subscription', requireUser(), async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ 
      success: false,
      error: 'Stripe not configured' 
    });
  }

  try {
    const user = await getUserFromRequest(req);
    const { subscriptionId } = req.body;

    if (!subscriptionId) {
      return res.status(400).json({ 
        success: false,
        error: 'Subscription ID is required' 
      });
    }

    // Verify the subscription belongs to the user
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    // Get customer by email to verify ownership
    const customers = await stripe.customers.list({
      email: user.email,
      limit: 1,
    });

    if (customers.data.length === 0 || subscription.customer !== customers.data[0].id) {
      return res.status(403).json({ 
        success: false,
        error: 'Subscription does not belong to this user' 
      });
    }

    // Reactivate the subscription
    const reactivatedSubscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    });

    res.json({
      success: true,
      message: 'Subscription has been reactivated',
      subscription: {
        id: reactivatedSubscription.id,
        status: reactivatedSubscription.status,
        cancel_at_period_end: reactivatedSubscription.cancel_at_period_end,
        current_period_end: new Date(reactivatedSubscription.current_period_end * 1000).toISOString(),
      },
    });
  } catch (error) {
    console.error('Error reactivating subscription:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to reactivate subscription' 
    });
  }
});

/**
 * Stripe webhook handler for subscription events
 * POST /api/webhooks/stripe
 */
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ error: 'Stripe not configured' });
  }

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.warn('⚠️ STRIPE_WEBHOOK_SECRET not set. Webhook verification disabled.');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.user_id;
        const plan = session.metadata?.plan;

        if (userId && plan) {
          // Validate UUID and plan type from Stripe metadata
          const userIdValidation = validateInput(uuidSchema, userId);
          const planValidation = validateInput(planTypeSchema, plan);
          
          if (!userIdValidation.success || !planValidation.success) {
            console.error('Invalid user_id or plan in Stripe webhook:', {
              userIdError: userIdValidation.error,
              planError: planValidation.error
            });
            break;
          }

          const validatedUserId = userIdValidation.data;
          const validatedPlan = planValidation.data;

          // Calculate expiration date (1 month from now)
          const expiresAt = new Date();
          expiresAt.setMonth(expiresAt.getMonth() + 1);

          // Update user's plan in database
          // Note: This will be synced with KP redemptions by the sync_user_plan function if it exists
          const { error } = await supabase
            .from('profiles')
            .update({
              plan: validatedPlan,
              plan_expires_at: expiresAt.toISOString(),
            })
            .eq('id', validatedUserId);
          
          // Sync plan to ensure KP redemptions and Stripe subscriptions work together
          // This ensures the user gets the highest plan with latest expiration
          try {
            await supabase.rpc('sync_user_plan', { p_user_id: validatedUserId });
          } catch (syncError) {
            // If sync function doesn't exist yet, that's okay - the update above will work
            console.warn('[Stripe Webhook] Could not sync plan (function may not exist yet):', syncError.message);
          }

          if (error) {
            console.error('Error updating user plan:', error);
          } else {
            console.log(`✅ Updated user ${validatedUserId} to ${validatedPlan} plan`);
          }

          // Send invoice to customer email
          if (stripe && session.subscription) {
            try {
              // Get the subscription to find the invoice
              const subscription = await stripe.subscriptions.retrieve(session.subscription);
              
              // Get the latest invoice for this subscription
              const invoices = await stripe.invoices.list({
                subscription: subscription.id,
                limit: 1,
              });

              if (invoices.data.length > 0) {
                const invoice = invoices.data[0];
                
                // Send the invoice via email
                // Stripe will automatically send it to the customer's email
                await stripe.invoices.sendInvoice(invoice.id);
                
                console.log(`✅ Invoice ${invoice.id} sent to customer email for subscription ${subscription.id}`);
              } else {
                console.warn(`⚠️ No invoice found for subscription ${subscription.id}`);
              }
            } catch (invoiceError) {
              // Log error but don't fail the webhook - plan update is more important
              console.error('Error sending invoice email:', invoiceError.message);
            }
          }
        }
        break;
      }

      case 'invoice.paid': {
        // Send invoice email when payment is successful (for renewals and initial payments)
        const invoice = event.data.object;
        
        if (stripe && invoice.subscription && invoice.status === 'paid' && invoice.amount_paid > 0) {
          try {
            // Only send if invoice hasn't been sent yet (check status)
            // Stripe automatically sends some invoices, but we ensure it's sent here
            if (invoice.status === 'paid') {
              await stripe.invoices.sendInvoice(invoice.id);
              console.log(`✅ Invoice ${invoice.id} sent to customer email after successful payment (amount: ${invoice.amount_paid / 100} ${invoice.currency})`);
            }
          } catch (invoiceError) {
            // Invoice might already be sent - that's okay
            if (invoiceError.code !== 'invoice_already_sent') {
              console.warn('Error sending invoice email (may already be sent):', invoiceError.message);
            }
          }
        }
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const userId = subscription.metadata?.user_id;
        const plan = subscription.metadata?.plan;

        if (event.type === 'customer.subscription.deleted' || subscription.status !== 'active') {
          // Subscription cancelled or expired - downgrade to free
          if (userId) {
            // Validate UUID from Stripe metadata
            const userIdValidation = validateInput(uuidSchema, userId);
            if (!userIdValidation.success) {
              console.error('Invalid user_id in Stripe webhook:', userIdValidation.error);
              break;
            }
            const validatedUserId = userIdValidation.data;

            const { error } = await supabase
              .from('profiles')
              .update({
                plan: 'free',
                plan_expires_at: null,
              })
              .eq('id', validatedUserId);

            if (error) {
              console.error('Error downgrading user plan:', error);
            } else {
              console.log(`✅ Downgraded user ${validatedUserId} to free plan`);
            }
          }
        } else if (userId && plan) {
          // Subscription updated - extend expiration
          // Validate UUID and plan type from Stripe metadata
          const userIdValidation = validateInput(uuidSchema, userId);
          const planValidation = validateInput(planTypeSchema, plan);
          
          if (!userIdValidation.success || !planValidation.success) {
            console.error('Invalid user_id or plan in Stripe webhook:', {
              userIdError: userIdValidation.error,
              planError: planValidation.error
            });
            break;
          }

          const validatedUserId = userIdValidation.data;
          const validatedPlan = planValidation.data;
          const currentPeriodEnd = new Date(subscription.current_period_end * 1000);
          
          const { error } = await supabase
            .from('profiles')
            .update({
              plan: validatedPlan,
              plan_expires_at: currentPeriodEnd.toISOString(),
            })
            .eq('id', validatedUserId);
          
          // Sync plan to ensure KP redemptions and Stripe subscriptions work together
          try {
            await supabase.rpc('sync_user_plan', { p_user_id: validatedUserId });
          } catch (syncError) {
            // If sync function doesn't exist yet, that's okay - the update above will work
            console.warn('[Stripe Webhook] Could not sync plan (function may not exist yet):', syncError.message);
          }

          if (error) {
            console.error('Error updating user plan:', error);
          } else {
            console.log(`✅ Updated user ${validatedUserId} ${validatedPlan} plan expiration`);
          }

          // Send invoice for subscription renewal (if payment was successful)
          // Note: invoice.paid event will also handle this, but this ensures it's sent
          if (stripe && subscription.id) {
            try {
              // Get the latest invoice for this subscription
              const invoices = await stripe.invoices.list({
                subscription: subscription.id,
                limit: 1,
              });

              if (invoices.data.length > 0) {
                const invoice = invoices.data[0];
                // Only send if invoice is paid and not already sent
                if (invoice.status === 'paid' && invoice.amount_paid > 0) {
                  try {
                    await stripe.invoices.sendInvoice(invoice.id);
                    console.log(`✅ Renewal invoice ${invoice.id} sent to customer email`);
                  } catch (sendError) {
                    // Invoice might already be sent - that's okay
                    if (sendError.code !== 'invoice_already_sent') {
                      console.warn('Error sending renewal invoice email:', sendError.message);
                    }
                  }
                }
              }
            } catch (invoiceError) {
              console.warn('Error retrieving renewal invoice:', invoiceError.message);
            }
          }
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ============================
// Global Error Handler
// ============================
// This should be the last middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  
  // Don't expose internal error details in production
  const errorResponse = {
    success: false,
    error: isProduction ? 'Internal server error' : err.message,
  };
  
  // Add stack trace only in development
  if (!isProduction) {
    errorResponse.stack = err.stack;
  }
  
  res.status(err.status || 500).json(errorResponse);
});

// ============================
// 404 Handler
// ============================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// ============================
// Process Error Handlers
// ============================
// Catch unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  // In production, you might want to send this to an error tracking service
  // Don't exit the process - let it continue running
});

// Catch uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  // In production, you might want to send this to an error tracking service
  // For uncaught exceptions, it's generally recommended to exit and let the process manager restart
  if (isProduction) {
    console.error('Process will exit due to uncaught exception in production');
    process.exit(1);
  }
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('📴 SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('📴 SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 MarkIt backend server running on port ${PORT}`);
  console.log(`📁 Upload directory: ${uploadsDir}`);
  console.log(`🔒 Security middleware enabled: helmet, cors, rate-limiting`);
  console.log(`🌍 Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
  if (isProduction) {
    console.log(`🌐 Frontend origin: ${process.env.FRONTEND_ORIGIN || 'NOT SET!'}`);
  }
});

export default app;

