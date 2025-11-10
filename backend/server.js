import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import OpenAI from 'openai';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

const OPENAI_API_KEY = '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';

// Middleware
app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ limit: '25mb', extended: true }));

// Initialize OpenAI with hardcoded key
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

console.log('✅ OpenAI API key loaded successfully');

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
 */
app.post('/api/process-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
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
 */
app.post('/api/analyze-whiteboard', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
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

    res.json({
      success: true,
      analysis: analysis,
      topics: extractTopics(analysis),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error analyzing whiteboard:', error);
    
    // Clean up file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
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
 */
app.post('/api/extract-text', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
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
 */
app.post('/api/generate-question', async (req, res) => {
  try {
    const { image, instructions } = req.body;
    
    if (!image) {
      console.warn('[generate-question] Missing image in request body');
      return res.status(400).json({ success: false, error: 'No image provided' });
    }

    const prompt = (instructions || '').trim() || [
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

    console.log('[generate-question] Request received', {
      imageLength: typeof image === 'string' ? image.length : null,
      promptLength: prompt.length,
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
      max_completion_tokens: 600,
    });

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
      max_completion_tokens: 2000,
    });
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
    ].join('\n');

    const textOnlyResp = await openai.chat.completions.create({
      model: "gpt-5-mini-2025-08-07",
      messages: [
        { role: "user", content: textOnlyPrompt },
      ],
      max_completion_tokens: 600,
    });
    const textOnlyChoice = textOnlyResp?.choices?.[0]?.message?.content || '';
    console.log('[generate-question] Text-only generation content length', textOnlyChoice.length);

    if (textOnlyChoice && textOnlyChoice.trim()) {
      const question = textOnlyChoice.trim();
      return res.json({ success: true, question, timestamp: new Date().toISOString() });
    }

    console.warn('[generate-question] All attempts returned empty content');
    return res.status(200).json({ success: false, error: 'NoContent' });

  } catch (error) {
    console.error('Error generating question:', error);

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
 */
app.post('/api/rewrite-steps', async (req, res) => {
  try {
    const { content, instructions } = req.body || {};
    if (!content || typeof content !== 'string') {
      console.warn('[rewrite-steps] Missing or invalid content');
      return res.status(400).json({ success: false, error: 'Missing content' });
    }

    const prompt = [
      (instructions || '').trim() || 'Rewrite the solution as clear, numbered steps.',
      'Formatting requirements:',
      '- Number each step: Step 1., Step 2., etc.',
      '- Use LaTeX for all mathematical expressions (inline \(...\), display \[...\], and \boxed{} for final answers where appropriate).',
      '- Keep prose concise but complete; maintain any important explanations.',
      'Content to rewrite:',
      content.substring(0, 8000),
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
    res.status(500).json({ success: false, error: error.message || 'Failed to rewrite steps' });
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

// Start server
app.listen(PORT, () => {
  console.log(`🚀 MarkIt backend server running on http://localhost:${PORT}`);
  console.log(`📁 Upload directory: ${uploadsDir}`);
});

export default app;

