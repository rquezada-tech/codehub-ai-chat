#!/bin/bash
set -e

echo "🚀 Starting Ollama server..."
echo "📦 Checking for mistral:7b-instruct-q4_0 model..."

# Check if model exists, if not pull it
if ! ollama list | grep -q "mistral.*7b-instruct-q4_0"; then
    echo "⬇️  Downloading mistral:7b-instruct-q4_0 (this may take a few minutes)..."
    ollama pull mistral:7b-instruct-q4_0
    echo "✅ Model downloaded successfully!"
else
    echo "✅ Model already exists, starting server..."
fi

# Start Ollama
exec ollama serve
