require('dotenv').config();

module.exports = {
  // Supabase Configuration
  supabase: {
    url: process.env.SUPABASE_URL || 'your_supabase_url_here',
    anonKey: process.env.SUPABASE_ANON_KEY || 'your_supabase_anon_key_here',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || 'your_supabase_service_role_key_here'
  },
  
  // Server Configuration
  server: {
    port: process.env.PORT || 8081,
    env: process.env.NODE_ENV || 'development'
  },
  
  // File Upload Configuration
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760, // 10MB
    allowedFileTypes: (process.env.ALLOWED_FILE_TYPES || 'application/pdf').split(','),
    uploadPath: process.env.UPLOAD_PATH || './uploads'
  }
};
