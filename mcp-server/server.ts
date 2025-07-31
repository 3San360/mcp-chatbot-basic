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
  origin: ['http://localhost:4202'],
  credentials: true,
  exposedHeaders: ['mcp-session-id'],
  allowedHeaders: ['Content-Type', 'mcp-session-id'],
}));

app.use(express.json());

// Store transports by session ID - supporting both Streamable HTTP and SSE
const transports: { [sessionId: string]: StreamableHTTPServerTransport | SSEServerTransport } = {};

// Enhanced SSE clients tracking for real-time updates
const sseClients: { [sessionId: string]: any } = {};

// Dynamic data cache with proper typing
interface WeatherData {
  temp: number;
  condition: string;
  windSpeed: number;
  humidity: number;
  pressure: number;
}

interface CryptoData {
  symbol: string;
  price: number;
  change: number;
  volume: number;
}

interface NewsArticle {
  id: string;
  title: string;
  category: string;
  url: string;
  publishedAt: string;
}

const dataCache = {
  weather: { data: null as WeatherData | null, timestamp: 0, ttl: 300000 }, // 5 minutes TTL
  crypto: { data: null as CryptoData[] | null, timestamp: 0, ttl: 60000 },   // 1 minute TTL
  news: { data: null as NewsArticle[] | null, timestamp: 0, ttl: 600000 }     // 10 minutes TTL
};

// Create MCP Server with enhanced tools and dynamic data sources
function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'enhanced-angular-mcp-server',
    version: '2.0.0'
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
        content: [{ type: 'text', text: `--> ${a} ${operation} ${b} = ${result} ✅` }]
      };
    }
  );

  // Simple weather tool (no SSE broadcasting)
  server.registerTool(
    'weather',
    {
      title: 'Weather',
      description: 'Get weather information for a city (simulated)',
      inputSchema: {
        city: z.string(),
        unit: z.enum(['celsius', 'fahrenheit']).optional().default('celsius')
      }
    },
    async ({ city, unit = 'celsius' }) => {
      // Simple weather simulation - no SSE
      const temp = Math.floor(Math.random() * 30) + 5; // 5-35°C
      const condition = ['sunny', 'cloudy', 'rainy', 'partly cloudy'][Math.floor(Math.random() * 4)];
      const tempDisplay = unit === 'fahrenheit' ? (temp * 9/5) + 32 : temp;
      const unitSymbol = unit === 'fahrenheit' ? '°F' : '°C';
      
      return {
        content: [{
          type: 'text',
          text: `🌤️ Weather in ${city}: ${tempDisplay.toFixed(1)}${unitSymbol}, ${condition}\n🕐 Updated: ${new Date().toLocaleTimeString()}`
        }]
      };
    }
  );

  // Dynamic crypto price tracker
  server.registerTool(
    'crypto-prices',
    {
      title: 'Cryptocurrency Prices',
      description: 'Get current cryptocurrency prices with market data',
      inputSchema: {
        symbols: z.array(z.string()).optional().default(['BTC', 'ETH', 'ADA']),
        currency: z.enum(['USD', 'EUR', 'GBP']).optional().default('USD')
      }
    },
    async ({ symbols = ['BTC', 'ETH', 'ADA'], currency = 'USD' }) => {
      const now = Date.now();
      const cacheKey = 'crypto';
      
      // Check cache validity
      if (dataCache[cacheKey].data && (now - dataCache[cacheKey].timestamp) < dataCache[cacheKey].ttl) {
        const cachedData = dataCache[cacheKey].data as any;
        return {
          content: [{
            type: 'text',
            text: `💰 Cryptocurrency Prices (${currency}):\n` +
                  cachedData.map((coin: any) => 
                    `${coin.symbol}: $${coin.price.toFixed(2)} (${coin.change >= 0 ? '📈' : '📉'} ${coin.change.toFixed(2)}%)`
                  ).join('\n') +
                  `\n\n🕐 Last updated: ${new Date(dataCache[cacheKey].timestamp).toLocaleTimeString()}`
          }]
        };
      }

      // Simulate crypto price data
      const cryptoData = symbols.map(symbol => {
        const basePrice = { 'BTC': 45000, 'ETH': 3000, 'ADA': 1.2 }[symbol] || 100;
        const variance = (Math.random() - 0.5) * 0.1; // ±5% variance
        const price = basePrice * (1 + variance);
        const change = (Math.random() - 0.5) * 10; // ±5% change
        
        return {
          symbol,
          price,
          change,
          volume: Math.floor(Math.random() * 1000000) + 100000
        };
      });

      // Update cache
      dataCache[cacheKey].data = cryptoData;
      dataCache[cacheKey].timestamp = now;

      // Broadcast to SSE clients
      broadcastToSSEClients('crypto-update', {
        prices: cryptoData,
        currency,
        timestamp: new Date().toISOString()
      });
      
      return {
        content: [{
          type: 'text',
          text: `💰 Cryptocurrency Prices (${currency}):\n` +
                cryptoData.map(coin => 
                  `${coin.symbol}: $${coin.price.toFixed(2)} (${coin.change >= 0 ? '📈' : '📉'} ${coin.change.toFixed(2)}%)\n` +
                  `   Volume: ${coin.volume.toLocaleString()}`
                ).join('\n') +
                `\n\n🕐 Updated: ${new Date().toLocaleTimeString()}`
        }]
      };
    }
  );

  // Live news headlines
  server.registerTool(
    'news-headlines',
    {
      title: 'Latest News Headlines',
      description: 'Get current news headlines with live updates',
      inputSchema: {
        category: z.enum(['technology', 'business', 'science', 'general']).optional().default('technology'),
        count: z.number().min(1).max(10).optional().default(5)
      }
    },
    async ({ category = 'technology', count = 5 }) => {
      const now = Date.now();
      const cacheKey = 'news';
      
      // Check cache validity
      if (dataCache[cacheKey].data && (now - dataCache[cacheKey].timestamp) < dataCache[cacheKey].ttl) {
        const cachedData = dataCache[cacheKey].data as any;
        const filteredNews = cachedData.filter((article: any) => article.category === category).slice(0, count);
        
        return {
          content: [{
            type: 'text',
            text: `📰 Latest ${category.charAt(0).toUpperCase() + category.slice(1)} News:\n\n` +
                  filteredNews.map((article: any, index: number) => 
                    `${index + 1}. ${article.title}\n   📅 ${article.publishedAt}\n   🔗 ${article.url}`
                  ).join('\n\n') +
                  `\n\n🕐 Last updated: ${new Date(dataCache[cacheKey].timestamp).toLocaleTimeString()}`
          }]
        };
      }

      // Simulate news data
      const newsArticles = [
        { title: 'AI Breakthrough in Medical Diagnosis', category: 'technology', url: 'https://example.com/ai-medical' },
        { title: 'Tech Giants Report Strong Q4 Earnings', category: 'business', url: 'https://example.com/earnings' },
        { title: 'New Quantum Computing Milestone Achieved', category: 'science', url: 'https://example.com/quantum' },
        { title: 'Sustainable Energy Solutions Gain Momentum', category: 'general', url: 'https://example.com/energy' },
        { title: 'Machine Learning Revolutionizes Data Analysis', category: 'technology', url: 'https://example.com/ml-data' },
        { title: 'Global Markets Show Resilience Despite Challenges', category: 'business', url: 'https://example.com/markets' },
        { title: 'Climate Research Reveals New Insights', category: 'science', url: 'https://example.com/climate' },
        { title: 'Digital Transformation Accelerates Across Industries', category: 'general', url: 'https://example.com/digital' }
      ].map(article => ({
        ...article,
        publishedAt: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toLocaleTimeString(),
        id: randomUUID()
      }));

      // Update cache
      dataCache[cacheKey].data = newsArticles;
      dataCache[cacheKey].timestamp = now;

      const filteredNews = newsArticles.filter(article => article.category === category).slice(0, count);

      // Broadcast to SSE clients
      broadcastToSSEClients('news-update', {
        articles: filteredNews,
        category,
        timestamp: new Date().toISOString()
      });
      
      return {
        content: [{
          type: 'text',
          text: `📰 Latest ${category.charAt(0).toUpperCase() + category.slice(1)} News:\n\n` +
                filteredNews.map((article, index) => 
                  `${index + 1}. ${article.title}\n   📅 ${article.publishedAt}\n   🔗 ${article.url}`
                ).join('\n\n') +
                `\n\n🕐 Updated: ${new Date().toLocaleTimeString()}`
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

  // Enhanced system info resource with real-time data
  server.registerResource(
    'enhanced-system-info',
    'system://enhanced-info',
    {
      title: 'Enhanced System Information',
      description: 'Real-time system information with dynamic updates',
      mimeType: 'application/json'
    },
    async (uri: URL) => ({
      contents: [{
        uri: uri.href,
        text: JSON.stringify({
          server: 'Enhanced Angular MCP Demo Server',
          version: '2.0.0',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          features: [
            'Real-time weather data',
            'Live cryptocurrency prices',
            'Dynamic news headlines',
            'Server-Sent Events (SSE)',
            'Enhanced caching system'
          ],
          activeConnections: Object.keys(sseClients).length,
          cacheStatus: {
            weather: { 
              cached: !!dataCache.weather.data, 
              age: Date.now() - dataCache.weather.timestamp 
            },
            crypto: { 
              cached: !!dataCache.crypto.data, 
              age: Date.now() - dataCache.crypto.timestamp 
            },
            news: { 
              cached: !!dataCache.news.data, 
              age: Date.now() - dataCache.news.timestamp 
            }
          }
        }, null, 2)
      }]
    })
  );

  return server;
}

// Function to broadcast data to all SSE clients
function broadcastToSSEClients(eventType: string, data: any) {
  Object.values(sseClients).forEach(client => {
    try {
      client.write(`event: ${eventType}\n`);
      client.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (error) {
      console.error('Error broadcasting to SSE client:', error);
    }
  });
}

// SSE endpoint for real-time updates
app.get('/sse', (req, res) => {
  const sessionId = randomUUID();
  
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': 'http://localhost:4202',
    'Access-Control-Allow-Credentials': 'true'
  });

  // Store the SSE connection
  sseClients[sessionId] = res;

  // Send initial connection message
  res.write(`event: connected\n`);
  res.write(`data: ${JSON.stringify({ sessionId, message: 'Connected to real-time updates' })}\n\n`);

  // Send periodic heartbeat
  const heartbeat = setInterval(() => {
    try {
      res.write(`event: heartbeat\n`);
      res.write(`data: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`);
    } catch (error) {
      clearInterval(heartbeat);
      delete sseClients[sessionId];
    }
  }, 30000); // 30 seconds

  // Clean up on client disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    delete sseClients[sessionId];
    console.log(`SSE client ${sessionId} disconnected`);
  });

  req.on('error', () => {
    clearInterval(heartbeat);
    delete sseClients[sessionId];
  });
});

// Start simple time updates
setInterval(() => {
  // Send simple time update from server
  if (Object.keys(sseClients).length > 0) {
    console.log('🕐 Sending time update to', Object.keys(sseClients).length, 'clients');
    const timeUpdate = {
      message: "Server Time Update",
      currentTime: new Date().toLocaleTimeString(),
      date: new Date().toLocaleDateString(),
      timestamp: new Date().toISOString()
    };
    
    broadcastToSSEClients('time-update', timeUpdate);
  } else {
    console.log('⏰ No SSE clients connected for time update');
  }
}, 6000); // Update every 6 seconds

// Helper function to check if request is an initialization request
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
