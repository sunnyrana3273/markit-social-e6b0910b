const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const config = require('../config');
const { authenticateUser } = require('../middleware/auth');

const router = express.Router();
const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);

// Get all documents for the authenticated user
router.get('/', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const { data, error } = await supabase
      .from('uploaded_files')
      .select('*')
      .eq('clerk_user_id', userId)
      .eq('mode', 'document')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      documents: data || []
    });

  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({
      error: 'Failed to fetch documents',
      message: error.message
    });
  }
});

// Get a specific document by ID
router.get('/:id', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const documentId = req.params.id;
    
    const { data, error } = await supabase
      .from('uploaded_files')
      .select('*')
      .eq('id', documentId)
      .eq('clerk_user_id', userId)
      .eq('mode', 'document')
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({
        error: 'Document not found',
        message: 'The requested document was not found or you do not have access to it'
      });
    }

    res.json({
      success: true,
      document: data
    });

  } catch (error) {
    console.error('Get document error:', error);
    res.status(500).json({
      error: 'Failed to fetch document',
      message: error.message
    });
  }
});

// Download a document
router.get('/:id/download', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const documentId = req.params.id;
    
    // Get document metadata
    const { data: document, error: docError } = await supabase
      .from('uploaded_files')
      .select('*')
      .eq('id', documentId)
      .eq('clerk_user_id', userId)
      .eq('mode', 'document')
      .single();

    if (docError) throw docError;

    if (!document) {
      return res.status(404).json({
        error: 'Document not found',
        message: 'The requested document was not found or you do not have access to it'
      });
    }

    // Download file from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(`${userId}/${document.file_name}`);

    if (downloadError) throw downloadError;

    // Convert blob to buffer
    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${document.file_name}"`);
    res.setHeader('Content-Length', buffer.length);

    res.send(buffer);

  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({
      error: 'Failed to download document',
      message: error.message
    });
  }
});

// Delete a document
router.delete('/:id', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const documentId = req.params.id;
    
    // Get document metadata first
    const { data: document, error: docError } = await supabase
      .from('uploaded_files')
      .select('*')
      .eq('id', documentId)
      .eq('clerk_user_id', userId)
      .eq('mode', 'document')
      .single();

    if (docError) throw docError;

    if (!document) {
      return res.status(404).json({
        error: 'Document not found',
        message: 'The requested document was not found or you do not have access to it'
      });
    }

    // Delete from Supabase Storage
    const { error: storageError } = await supabase.storage
      .from('documents')
      .remove([`${userId}/${document.file_name}`]);

    if (storageError) {
      console.error('Storage deletion error:', storageError);
      // Continue with database deletion even if storage deletion fails
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from('uploaded_files')
      .delete()
      .eq('id', documentId)
      .eq('clerk_user_id', userId);

    if (deleteError) throw deleteError;

    res.json({
      success: true,
      message: 'Document deleted successfully'
    });

  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({
      error: 'Failed to delete document',
      message: error.message
    });
  }
});

// Update document metadata (e.g., rename)
router.patch('/:id', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const documentId = req.params.id;
    const { originalName } = req.body;
    
    if (!originalName || originalName.trim() === '') {
      return res.status(400).json({
        error: 'Invalid name',
        message: 'Document name cannot be empty'
      });
    }

    const { data, error } = await supabase
      .from('uploaded_files')
      .update({ 
        file_name: originalName.trim(),
        updated_at: new Date().toISOString()
      })
      .eq('id', documentId)
      .eq('clerk_user_id', userId)
      .select()
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({
        error: 'Document not found',
        message: 'The requested document was not found or you do not have access to it'
      });
    }

    res.json({
      success: true,
      message: 'Document updated successfully',
      document: data
    });

  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({
      error: 'Failed to update document',
      message: error.message
    });
  }
});

module.exports = router;

