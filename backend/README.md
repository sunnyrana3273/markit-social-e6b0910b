# MarkIt Backend Server

Express backend server for processing images with OpenAI Vision API.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file (copy from `.env.example`):
```bash
cp .env.example .env
```

3. Add your OpenAI API key to `.env`:
```
OPENAI_API_KEY=your_openai_api_key_here
```

## Running the Server

```bash
# Development mode (with nodemon)
npm run dev

# Production mode
npm start
```

Server will run on `http://localhost:3001`

## API Endpoints

### POST `/api/process-image`
Process an image with custom prompt using OpenAI Vision API.

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Body:
  - `image`: Image file
  - `prompt`: (optional) Custom analysis prompt

**Response:**
```json
{
  "success": true,
  "analysis": "Detailed analysis of the image...",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### POST `/api/analyze-whiteboard`
Analyze whiteboard/drawing images from study sessions.

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Body:
  - `image`: Image file (whiteboard/drawing)

**Response:**
```json
{
  "success": true,
  "analysis": "Analysis of the whiteboard content...",
  "topics": ["Topic 1", "Topic 2"],
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### POST `/api/extract-text`
Extract text from images (OCR-like functionality).

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Body:
  - `image`: Image file

**Response:**
```json
{
  "success": true,
  "text": "Extracted text content...",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### GET `/api/health`
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "message": "MarkIt backend server is running",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Usage Example

```javascript
const formData = new FormData();
formData.append('image', imageFile);

const response = await fetch('http://localhost:3001/api/analyze-whiteboard', {
  method: 'POST',
  body: formData
});

const data = await response.json();
console.log(data.analysis);
```

## Environment Variables

- `OPENAI_API_KEY`: Your OpenAI API key
- `PORT`: Server port (default: 3001)
- `NODE_ENV`: Environment mode (development/production)











