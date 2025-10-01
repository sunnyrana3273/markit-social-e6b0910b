# MarkIt Backend API

Backend API server for the MarkIt social learning platform, providing document upload and management functionality.

## Features

- **PDF Document Upload**: Secure file upload with validation
- **User Authentication**: JWT-based authentication with Supabase
- **File Storage**: Integration with Supabase Storage
- **Document Management**: CRUD operations for user documents
- **Security**: Rate limiting, CORS, and file type validation

## Setup

1. **Install Dependencies**
   ```bash
   cd backend
   npm install
   ```

2. **Environment Configuration**
   Create a `.env` file in the backend directory with the following variables:
   ```
   SUPABASE_URL=your_supabase_url_here
   SUPABASE_ANON_KEY=your_supabase_anon_key_here
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
   PORT=8081
   NODE_ENV=development
   MAX_FILE_SIZE=10485760
   ALLOWED_FILE_TYPES=application/pdf
   UPLOAD_PATH=./uploads
   ```

3. **Database Setup**
   Create the following table in your Supabase database:
   ```sql
   CREATE TABLE user_documents (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
     original_name TEXT NOT NULL,
     file_name TEXT NOT NULL,
     file_path TEXT,
     file_size BIGINT NOT NULL,
     mime_type TEXT NOT NULL,
     uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   -- Create storage bucket for documents
   INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false);

   -- Create RLS policies
   ALTER TABLE user_documents ENABLE ROW LEVEL SECURITY;

   CREATE POLICY "Users can view their own documents" ON user_documents
     FOR SELECT USING (auth.uid() = user_id);

   CREATE POLICY "Users can insert their own documents" ON user_documents
     FOR INSERT WITH CHECK (auth.uid() = user_id);

   CREATE POLICY "Users can update their own documents" ON user_documents
     FOR UPDATE USING (auth.uid() = user_id);

   CREATE POLICY "Users can delete their own documents" ON user_documents
     FOR DELETE USING (auth.uid() = user_id);
   ```

4. **Start the Server**
   ```bash
   # Development mode with auto-reload
   npm run dev
   
   # Production mode
   npm start
   ```

## API Endpoints

### Authentication
All protected endpoints require a Bearer token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

### Upload Endpoints

#### Upload PDF Document
- **POST** `/api/upload/pdf`
- **Content-Type**: `multipart/form-data`
- **Body**: Form data with `document` field containing the PDF file
- **Response**: Document metadata

#### Get Upload Progress
- **GET** `/api/upload/progress/:uploadId`
- **Response**: Upload progress information

### Document Management

#### Get User Documents
- **GET** `/api/documents`
- **Response**: Array of user's documents

#### Get Specific Document
- **GET** `/api/documents/:id`
- **Response**: Document metadata

#### Download Document
- **GET** `/api/documents/:id/download`
- **Response**: PDF file download

#### Update Document
- **PATCH** `/api/documents/:id`
- **Body**: `{ "originalName": "new_name.pdf" }`
- **Response**: Updated document metadata

#### Delete Document
- **DELETE** `/api/documents/:id`
- **Response**: Success confirmation

### Health Check
- **GET** `/api/health`
- **Response**: Server status and configuration

## File Upload Configuration

- **Maximum file size**: 10MB (configurable)
- **Allowed file types**: PDF only
- **Storage**: Local temporary storage + Supabase Storage
- **Security**: File type validation, size limits, user authentication

## Error Handling

The API returns consistent error responses:
```json
{
  "error": "Error type",
  "message": "Human-readable error message"
}
```

Common HTTP status codes:
- `200`: Success
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `404`: Not Found
- `413`: File Too Large
- `500`: Internal Server Error

## Development

### Project Structure
```
backend/
├── config.js              # Configuration management
├── server.js              # Main server file
├── package.json           # Dependencies and scripts
├── routes/
│   ├── upload.js          # File upload endpoints
│   └── documents.js       # Document management endpoints
├── middleware/
│   └── auth.js            # Authentication middleware
├── uploads/               # Temporary file storage
└── README.md              # This file
```

### Adding New Features

1. Create new route files in the `routes/` directory
2. Add middleware in the `middleware/` directory
3. Update `server.js` to include new routes
4. Add appropriate error handling and validation

## Security Considerations

- All file uploads are validated for type and size
- User authentication is required for all document operations
- Files are stored securely in Supabase Storage
- Rate limiting prevents abuse
- CORS is configured for specific origins
- Helmet.js provides additional security headers
