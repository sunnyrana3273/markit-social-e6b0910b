#!/bin/bash

echo "🛑 Stopping any running dev server..."
# Kill any process running on port 8080
lsof -ti:8080 | xargs kill -9 2>/dev/null || true

echo "🧹 Clearing Vite cache..."
rm -rf node_modules/.vite

echo "🔄 Starting dev server..."
npm run dev

