import express from 'express';
import cors from 'cors';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { randomUUID } from 'crypto';
import { z } from 'zod';

const app = express();
const PORT = 3001;

// Enable CORS for Angular frontend
app.use(cors({
  origin: ['http://localhost:4200'],
  credentials: true,
  exposedHeaders: ['mcp-session-id'],
  allowedHeaders: ['Content-Type', 'mcp-session-id'],
}));

app.use(express.json());

// Store transports by session ID - supporting both Streamable HTTP and SSE
const transports: { [sessionId: string]: StreamableHTTPServerTransport | SSEServerTransport } = {};

// Create MCP Server with various tools and resources
function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'angular-mcp-demo-server',
    version: '1.0.0'
  });

  // Register a simple calculator tool
  server.registerTool(
    'calculator',
    {
      title: 'Calculator',
      description: 'Perform basic arithmetic operations',
      inputSchema: {
        operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
        a: z.number(),
        b: z.number()
      }
    },
    async ({ operation, a, b }) => {
      let result: number;
      switch (operation) {
        case 'add':
          result = a + b;
          break;
        case 'subtract':
          result = a - b;
          break;
        case 'multiply':
          result = a * b;
          break;
        case 'divide':
          if (b === 0) {
            return {
              content: [{ type: 'text', text: 'Error: Division by zero' }],
              isError: true
            };
          }
          result = a / b;
          break;
      }
      return {
        content: [{ type: 'text', text: `${a} ${operation} ${b} = ${result}` }]
      };
    }
  );

  // Register a weather simulation tool
  server.registerTool(
    'weather',
    {
      title: 'Weather Info',
      description: 'Get weather information for a city (simulated)',
      inputSchema: {
        city: z.string(),
        unit: z.enum(['celsius', 'fahrenheit']).optional().default('celsius')
      }
    },
    async ({ city, unit = 'celsius' }) => {
      // Simulate weather data
      const temperature = Math.floor(Math.random() * 30) + 10;
      const conditions = ['sunny', 'cloudy', 'rainy', 'snowy'][Math.floor(Math.random() * 4)];
      const tempDisplay = unit === 'fahrenheit' ? (temperature * 9/5) + 32 : temperature;
      const unitSymbol = unit === 'fahrenheit' ? '°F' : '°C';
      
      return {
        content: [{
          type: 'text',
          text: `Weather in ${city}: ${tempDisplay}${unitSymbol}, ${conditions}`
        }]
      };
    }
  );

  // Register a text processing tool
  server.registerTool(
    'text-processor',
    {
      title: 'Text Processor',
      description: 'Process text with various operations',
      inputSchema: {
        text: z.string(),
        operation: z.enum(['uppercase', 'lowercase', 'reverse', 'word-count'])
      }
    },
    async ({ text, operation }) => {
      let result: string;
      switch (operation) {
        case 'uppercase':
          result = text.toUpperCase();
          break;
        case 'lowercase':
          result = text.toLowerCase();
          break;
        case 'reverse':
          result = text.split('').reverse().join('');
          break;
        case 'word-count':
          const wordCount = text.trim().split(/\s+/).length;
          result = `Word count: ${wordCount}`;
          break;
      }
      return {
        content: [{ type: 'text', text: result }]
      };
    }
  );

  // Register a simple data resource
  server.registerResource(
    'system-info',
    'system://info',
    {
      title: 'System Information',
      description: 'Basic system information',
      mimeType: 'application/json'
    },
    async (uri: URL) => ({
      contents: [{
        uri: uri.href,
        text: JSON.stringify({
          server: 'Angular MCP Demo Server',
          version: '1.0.0',
          timestamp: new Date().toISOString(),
          uptime: process.uptime()
        }, null, 2)
      }]
    })
  );

  // Register a sample prompt
  server.registerPrompt(
    'chat-assistant',
    {
      title: 'Chat Assistant',
      description: 'A helpful chat assistant prompt',
      argsSchema: {
        topic: z.string().optional(),
        tone: z.enum(['friendly', 'professional', 'casual']).optional()
      }
    },
    ({ topic, tone = 'friendly' }) => ({
      messages: [{
        role: 'user' as const,
        content: {
          type: 'text',
          text: `You are a ${tone} chat assistant. ${topic ? `The user wants to discuss: ${topic}` : 'Help the user with their questions.'}`
        }
      }]
    })
  );

  return server;
}

// Helper function to check if request is an initialize request
function isInitializeRequest(body: any): boolean {
  return body && body.method === 'initialize';
}

// Handle POST requests for client-to-server communication
app.post('/mcp', async (req, res) => {
  try {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports[sessionId] && transports[sessionId] instanceof StreamableHTTPServerTransport) {
      // Reuse existing Streamable HTTP transport
      transport = transports[sessionId] as StreamableHTTPServerTransport;
    } else if (!sessionId && isInitializeRequest(req.body)) {
      // New initialization request
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sessionId: string) => {
          transports[sessionId] = transport;
          console.log(`New MCP session initialized: ${sessionId}`);
        }
      });

      // Clean up transport when closed
      transport.onclose = () => {
        if (transport.sessionId) {
          delete transports[transport.sessionId];
          console.log(`MCP session closed: ${transport.sessionId}`);
        }
      };

      const server = createMcpServer();
      await server.connect(transport);
    } else {
      // Invalid request
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Bad Request: No valid session ID provided',
        },
        id: null,
      });
      return;
    }

    // Handle the request
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('Error handling MCP request:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
        },
        id: null,
      });
    }
  }
});

// Handle GET requests for SSE transport (legacy/fallback)
app.get('/mcp', async (req, res) => {
  console.log('Received GET request to /mcp (establishing SSE stream)');
  try {
    // Create a new SSE transport for the client
    // The endpoint for POST messages is '/messages'
    const transport = new SSEServerTransport('/messages', res);
    
    // Store the transport by session ID
    const sessionId = transport.sessionId;
    transports[sessionId] = transport;
    
    // Set up onclose handler to clean up transport when closed
    transport.onclose = () => {
      console.log(`SSE transport closed for session ${sessionId}`);
      delete transports[sessionId];
    };
    
    // Connect the transport to the MCP server
    const server = createMcpServer();
    await server.connect(transport);
    
    console.log(`Established SSE stream with session ID: ${sessionId}`);
  } catch (error) {
    console.error('Error establishing SSE stream:', error);
    if (!res.headersSent) {
      res.status(500).send('Error establishing SSE stream');
    }
  }
});

// Handle POST requests for SSE transport messages
app.post('/messages', async (req, res) => {
  console.log('Received POST request to /messages (SSE transport)');
  
  // Extract session ID from URL query parameter
  const sessionId = req.query['sessionId'] as string;
  if (!sessionId) {
    console.error('No session ID provided in request URL');
    res.status(400).send('Missing sessionId parameter');
    return;
  }
  
  const transport = transports[sessionId];
  if (!transport) {
    console.error(`No active transport found for session ID: ${sessionId}`);
    res.status(404).send('Session not found');
    return;
  }
  
  // Only handle this for SSE transports
  if (transport instanceof SSEServerTransport) {
    try {
      await transport.handlePostMessage(req, res, req.body);
    } catch (error) {
      console.error('Error handling SSE request:', error);
      if (!res.headersSent) {
        res.status(500).send('Error handling request');
      }
    }
  } else {
    res.status(400).send('Invalid transport type for this endpoint');
  }
});

// Handle DELETE requests for session termination
app.delete('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send('Invalid or missing session ID');
    return;
  }
  
  const transport = transports[sessionId];
  if (transport instanceof StreamableHTTPServerTransport) {
    await transport.handleRequest(req, res);
  } else {
    // For SSE transports, just close the connection
    await transport.close();
    delete transports[sessionId];
    res.status(200).send('Session terminated');
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    activeSessions: Object.keys(transports).length
  });
});

// Simplified REST API endpoints for direct HTTP communication
app.get('/api/tools', async (req, res) => {
  try {
    const server = createMcpServer();
    // Get tools directly from server capabilities
    const tools = [
      {
        name: 'calculator',
        title: 'Calculator',
        description: 'Perform basic arithmetic operations',
        inputSchema: {
          operation: { type: 'string', enum: ['add', 'subtract', 'multiply', 'divide'] },
          a: { type: 'number' },
          b: { type: 'number' }
        }
      },
      {
        name: 'weather',
        title: 'Weather Info',
        description: 'Get weather information for a city (simulated)',
        inputSchema: {
          city: { type: 'string' },
          unit: { type: 'string', enum: ['celsius', 'fahrenheit'], default: 'celsius' }
        }
      },
      {
        name: 'text-processor',
        title: 'Text Processor',
        description: 'Process text with various operations',
        inputSchema: {
          operation: { type: 'string', enum: ['uppercase', 'lowercase', 'reverse', 'word-count', 'char-count'] },
          text: { type: 'string' }
        }
      }
    ];
    res.json({ tools });
  } catch (error) {
    console.error('Error listing tools:', error);
    res.status(500).json({ error: 'Failed to list tools' });
  }
});

app.get('/api/resources', async (req, res) => {
  try {
    const resources = [
      {
        uri: 'system://info',
        name: 'System Information',
        description: 'Get basic system information',
        mimeType: 'application/json'
      }
    ];
    res.json({ resources });
  } catch (error) {
    console.error('Error listing resources:', error);
    res.status(500).json({ error: 'Failed to list resources' });
  }
});

app.get('/api/prompts', async (req, res) => {
  try {
    const prompts = [
      {
        name: 'chat-assistant',
        title: 'Chat Assistant',
        description: 'A helpful chat assistant prompt',
        arguments: [
          { name: 'topic', description: 'The topic to discuss', required: false },
          { name: 'tone', description: 'The tone to use', required: false }
        ]
      }
    ];
    res.json({ prompts });
  } catch (error) {
    console.error('Error listing prompts:', error);
    res.status(500).json({ error: 'Failed to list prompts' });
  }
});

app.post('/api/tools/call', async (req, res) => {
  try {
    const { name, arguments: args } = req.body;
    
    let result;
    
    switch (name) {
      case 'calculator':
        const { operation, a, b } = args;
        let calcResult: number;
        switch (operation) {
          case 'add':
            calcResult = a + b;
            break;
          case 'subtract':
            calcResult = a - b;
            break;
          case 'multiply':
            calcResult = a * b;
            break;
          case 'divide':
            if (b === 0) {
              res.json({
                content: [{ type: 'text', text: 'Error: Division by zero' }],
                isError: true
              });
              return;
            }
            calcResult = a / b;
            break;
          default:
            res.status(400).json({ error: 'Invalid operation' });
            return;
        }
        result = {
          content: [{ type: 'text', text: `${a} ${operation} ${b} = ${calcResult}` }]
        };
        break;
        
      case 'weather':
        const { city, unit = 'celsius' } = args;
        const temp = unit === 'celsius' ? Math.floor(Math.random() * 30) + 10 : Math.floor(Math.random() * 54) + 50;
        const conditions = ['sunny', 'cloudy', 'rainy', 'partly cloudy'];
        const condition = conditions[Math.floor(Math.random() * conditions.length)];
        result = {
          content: [{
            type: 'text',
            text: `Weather in ${city}: ${temp}°${unit === 'celsius' ? 'C' : 'F'}, ${condition}`
          }]
        };
        break;
        
      case 'text-processor':
        const { operation: textOp, text } = args;
        let processedText: string;
        switch (textOp) {
          case 'uppercase':
            processedText = text.toUpperCase();
            break;
          case 'lowercase':
            processedText = text.toLowerCase();
            break;
          case 'reverse':
            processedText = text.split('').reverse().join('');
            break;
          case 'word-count':
            processedText = `Word count: ${text.split(/\s+/).length}`;
            break;
          case 'char-count':
            processedText = `Character count: ${text.length}`;
            break;
          default:
            res.status(400).json({ error: 'Invalid text operation' });
            return;
        }
        result = {
          content: [{ type: 'text', text: processedText }]
        };
        break;
        
      default:
        res.status(400).json({ error: 'Unknown tool' });
        return;
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error calling tool:', error);
    res.status(500).json({ error: 'Failed to call tool' });
  }
});

app.post('/api/resources/read', async (req, res) => {
  try {
    const { uri } = req.body;
    
    if (uri === 'system://info') {
        console.log('Reading system information resource');
      const systemInfo = {
        platform: process.platform,
        nodeVersion: process.version,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        cwd: process.cwd()
      };
      res.json({
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(systemInfo, null, 2)
        }]
      });
    } else {
      res.status(404).json({ error: 'Resource not found' });
    }
  } catch (error) {
    console.error('Error reading resource:', error);
    res.status(500).json({ error: 'Failed to read resource' });
  }
});

app.post('/api/prompts/get', async (req, res) => {
  try {
    const { name, arguments: args = {} } = req.body;
    
    if (name === 'chat-assistant') {
      const { topic, tone = 'friendly' } = args;
      res.json({
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: `You are a ${tone} chat assistant. ${topic ? `The user wants to discuss: ${topic}` : 'Help the user with their questions.'}`
          }
        }]
      });
    } else {
      res.status(404).json({ error: 'Prompt not found' });
    }
  } catch (error) {
    console.error('Error getting prompt:', error);
    res.status(500).json({ error: 'Failed to get prompt' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 MCP Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 MCP Endpoint: http://localhost:${PORT}/mcp`);
});
