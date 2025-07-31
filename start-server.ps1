#!/usr/bin/env pwsh

# Navigate to the project directory
Set-Location "c:\Users\Seconize\Seconize_Projects\drc-ui-v3\mcp-test\mcp-chatbot-basic"

# Install dependencies if needed
if (!(Test-Path "node_modules")) {
    Write-Host "Installing dependencies..."
    npm install
}

# Start the server
Write-Host "Starting MCP server..."
node --loader ts-node/esm mcp-server/server.ts
