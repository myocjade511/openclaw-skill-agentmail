#!/bin/bash
# AgentMail Skill Installer for OpenClaw

set -e

echo "📧 AgentMail Skill Installer"
echo "============================"
echo ""

# Check if OpenClaw skills directory exists
SKILLS_DIR="${HOME}/.openclaw/skills"
if [ ! -d "$SKILLS_DIR" ]; then
    echo "❌ OpenClaw skills directory not found at: $SKILLS_DIR"
    echo "   Please ensure OpenClaw is installed correctly."
    exit 1
fi

echo "✓ Found OpenClaw skills directory: $SKILLS_DIR"

# Check if skill already exists
if [ -d "$SKILLS_DIR/agentmail" ]; then
    echo ""
    echo "⚠️  AgentMail skill already exists!"
    read -p "   Do you want to overwrite it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "   Installation cancelled."
        exit 0
    fi
    echo "   Removing existing skill..."
    rm -rf "$SKILLS_DIR/agentmail"
fi

# Create skill directory
echo ""
echo "📦 Installing AgentMail skill..."
mkdir -p "$SKILLS_DIR/agentmail"

# Copy files
cp -r SKILL.md README.md package.json scripts vercel.json index.html api "$SKILLS_DIR/agentmail/"

# Install dependencies
echo "📥 Installing dependencies..."
cd "$SKILLS_DIR/agentmail"
npm install --silent

echo ""
echo "✅ AgentMail skill installed successfully!"
echo ""
echo "Next steps:"
echo "  1. Get your API key from https://agentmail.to"
echo "  2. Set it in your environment:"
echo "     export AGENTMAIL_API_KEY='your_api_key_here'"
echo "  3. Or create a .env.agentmail file in your workspace"
echo ""
echo "Usage:"
echo "  /agentmail inbox create my-inbox"
echo "  /agentmail send my-inbox@agentmail.to recipient@example.com 'Hello'"
echo ""
echo "⚠️  Important: When sending emails, use 'text' parameter, NOT 'body'!"
echo ""
