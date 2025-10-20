#!/bin/bash

# Markit Social - Whiteboard Setup Script
# This script helps you set up the whiteboard feature

set -e

echo "🎨 Markit Social - Whiteboard Setup"
echo "===================================="
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "⚠️  Supabase CLI not found. Installing..."
    npm install -g supabase
fi

echo "✅ Supabase CLI is installed"
echo ""

# Check if Supabase project is linked
if [ ! -f ".supabase/config.toml" ]; then
    echo "🔗 Linking to Supabase project..."
    echo "Please run: supabase link --project-ref wvspwskluqkqeniwtoqf"
    exit 1
fi

echo "✅ Supabase project is linked"
echo ""

# Apply database migrations
echo "📦 Applying database migrations..."
supabase db push

echo ""
echo "✅ Database migrations applied"
echo ""

# Generate TypeScript types
echo "🔧 Generating TypeScript types..."
supabase gen types typescript --local > src/integrations/supabase/types.gen.ts

echo ""
echo "✅ TypeScript types generated"
echo ""

# Check for required environment variables
echo "🔍 Checking environment variables..."

if [ ! -f ".env.local" ]; then
    echo "⚠️  .env.local not found. Creating from .env.docker..."
    cp .env.docker .env.local
    echo "⚠️  Please edit .env.local with your actual Supabase credentials"
else
    echo "✅ .env.local exists"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env.local with your Supabase credentials"
echo "2. Run 'npm run dev' to start the development server"
echo "3. Navigate to /whiteboard in your browser"
echo ""
echo "📚 See README-WHITEBOARD.md for more details"

