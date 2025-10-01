#!/bin/bash

echo "🚀 Setting up MarkIt Backend..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cat > .env << EOF
# Supabase Configuration
SUPABASE_URL=your_supabase_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# Server Configuration
PORT=8081
NODE_ENV=development

# File Upload Configuration
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=application/pdf
UPLOAD_PATH=./uploads
EOF
    echo "⚠️  Please update the .env file with your Supabase credentials"
fi

# Create uploads directory
mkdir -p uploads

echo "✅ Backend setup complete!"
echo ""
echo "Next steps:"
echo "1. Update the .env file with your Supabase credentials"
echo "2. Run the Supabase migration to create the user_documents table"
echo "3. Start the server with: npm run dev"
echo ""
echo "The server will run on http://localhost:8081"
