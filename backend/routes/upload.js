const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { createClient } = require('@supabase/supabase-js');

const config = require('../config');
const { authenticateUser } = require('../middleware/auth');

const router = express.Router();
const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// File filter for PDFs only
const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: config.upload.maxFileSize,
    files: 1
  }
});

// Upload single PDF file
router.post('/pdf', authenticateUser, upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded',
        message: 'Please select a PDF file to upload'
      });
    }

    const userId = req.user.id;
    const fileInfo = {
      id: uuidv4(),
      userId: userId,
      originalName: req.file.originalname,
      fileName: req.file.filename,
      filePath: req.file.path,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      uploadedAt: new Date().toISOString()
    };

    // Store file metadata in Supabase
    const { data, error } = await supabase
      .from('uploaded_files')
      .insert([{
        clerk_user_id: userId,
        file_name: fileInfo.originalName,
        file_path: fileInfo.filePath,
        file_size: fileInfo.fileSize,
        file_type: fileInfo.mimeType,
        mode: 'document'
      }])
      .select()
      .single();

    if (error) {
      // Clean up uploaded file if database insert fails
      fs.unlinkSync(req.file.path);
      throw error;
    }

    // Upload file to Supabase Storage
    const fileBuffer = fs.readFileSync(req.file.path);
    const { error: storageError } = await supabase.storage
      .from('documents')
      .upload(`${userId}/${fileInfo.fileName}`, fileBuffer, {
        contentType: 'application/pdf',
        upsert: false
      });

    if (storageError) {
      // Clean up local file and database record if storage upload fails
      fs.unlinkSync(req.file.path);
      await supabase.from('uploaded_files').delete().eq('id', data.id);
      throw storageError;
    }

    // Clean up local file after successful storage upload
    fs.unlinkSync(req.file.path);

    res.status(201).json({
      success: true,
      message: 'Document uploaded successfully',
      document: {
        id: data.id,
        originalName: data.file_name,
        fileSize: data.file_size,
        uploadedAt: data.created_at
      }
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      error: 'Upload failed',
      message: error.message || 'Failed to upload document'
    });
  }
});

// Get upload progress (for future implementation with chunked uploads)
router.get('/progress/:uploadId', authenticateUser, (req, res) => {
  // Placeholder for upload progress tracking
  res.json({
    uploadId: req.params.uploadId,
    progress: 100,
    status: 'completed'
  });
});

module.exports = router;

