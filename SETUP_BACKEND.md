# Backend Setup Instructions

## Quick Start

### 1. Install Backend Dependencies

Navigate to the backend folder and install dependencies:

```bash
cd backend
npm install
```

### 2. Set Up Environment Variables

Create a `.env` file in the `backend` folder:

```bash
# Copy the example file
cp env.example .env

# Then edit .env and add your OpenAI API key
OPENAI_API_KEY=your_openai_api_key_here
PORT=3001
NODE_ENV=development
```

### 3. Start the Backend Server

```bash
# Development mode (auto-restarts on changes)
npm run dev

# Or production mode
npm start
```

The server will run on `http://localhost:3001`

## Using the Backend API

### Available Endpoints

1. **POST `/api/process-image`**
   - General image analysis with custom prompt
   - Body: `multipart/form-data` with `image` file and optional `prompt` text

2. **POST `/api/analyze-whiteboard`** ⭐ (Used by the app)
   - Specific analysis for whiteboard/drawing images
   - Identifies topics, extracts content, suggests what students are studying
   - Body: `multipart/form-data` with `image` file

3. **POST `/api/extract-text`**
   - OCR-like text extraction from images
   - Body: `multipart/form-data` with `image` file

4. **GET `/api/health`**
   - Health check endpoint

### Frontend Integration

The capture panel in the Document Editor already has an "Analyze with AI" button that:
1. Captures the whiteboard scene
2. Sends it to `/api/analyze-whiteboard`
3. Displays the analysis results in the capture panel

## Features

✅ Image upload with multer
✅ OpenAI Vision API integration
✅ Automatic file cleanup
✅ CORS enabled for frontend
✅ Error handling
✅ Health check endpoint

## Getting Your OpenAI API Key

1. Go to https://platform.openai.com/
2. Sign up or log in
3. Navigate to API Keys section
4. Create a new API key
5. Copy and paste it into your `.env` file

## Testing the Backend

You can test the API using curl:

```bash
# Health check
curl http://localhost:3001/api/health

# Test image analysis (replace with your image path)
curl -X POST http://localhost:3001/api/analyze-whiteboard \
  -F "image=@path/to/your/image.png"
```

## Notes

- Make sure the backend is running before using the AI analysis feature
- The backend automatically cleans up uploaded files after processing
- Image files are temporarily stored in `backend/uploads/`
- Maximum file size: 10MB per image











