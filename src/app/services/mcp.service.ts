import { Injectable } from '@angular/core';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { BehaviorSubject, Observable, from } from 'rxjs';

export interface ChatMessage {
  id: string;
  content: string;
  timestamp: Date;
  sender: 'user' | 'assistant';
  type: 'text' | 'tool-result' | 'error';
}

export interface AvailableTool {
  name: string;
  title?: string;
  description?: string;
  inputSchema?: any;
}

export interface AvailableResource {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
}

export interface AvailablePrompt {
  name: string;
  title?: string;
  description?: string;
  arguments?: any[];
}

@Injectable({
  providedIn: 'root'
})
export class McpService {
  private client: Client | null = null;
  private transport: StreamableHTTPClientTransport | SSEClientTransport | null = null;
  private isConnectedSubject = new BehaviorSubject<boolean>(false);
  private messagesSubject = new BehaviorSubject<ChatMessage[]>([]);
  private availableToolsSubject = new BehaviorSubject<AvailableTool[]>([]);
  private availableResourcesSubject = new BehaviorSubject<AvailableResource[]>([]);
  private availablePromptsSubject = new BehaviorSubject<AvailablePrompt[]>([]);

  public isConnected$ = this.isConnectedSubject.asObservable();
  public messages$ = this.messagesSubject.asObservable();
  public availableTools$ = this.availableToolsSubject.asObservable();
  public availableResources$ = this.availableResourcesSubject.asObservable();
  public availablePrompts$ = this.availablePromptsSubject.asObservable();

  private serverUrl = 'http://localhost:3001/mcp';

  constructor() {
    this.addMessage({
      content: 'Welcome! I\'m your MCP-powered chatbot. Try asking me to use tools like calculator, weather, or text processing!',
      sender: 'assistant',
      type: 'text'
    });
  }

  async connect(): Promise<void> {
    try {
      console.log('Attempting to connect to MCP server...');
      
      // First, test if the server is reachable
      const healthCheck = await fetch('http://localhost:3001/health');
      if (!healthCheck.ok) {
        throw new Error('Server is not reachable');
      }
      
      console.log('Server is reachable, attempting MCP connection...');
      
      // Create a simplified HTTP-based connection approach
      await this.connectSimple();
      
      console.log('Connected successfully!');
      this.isConnectedSubject.next(true);
      
      // Load available tools, resources, and prompts
      await this.loadCapabilities();
      
      this.addMessage({
        content: 'Connected to MCP server! You can now use available tools and resources.',
        sender: 'assistant',
        type: 'text'
      });
    } catch (error) {
      console.error('Failed to connect to MCP server:', error);
      console.error('Error details:', error);
      this.addMessage({
        content: `Failed to connect to MCP server: ${error instanceof Error ? error.message : 'Unknown error'}. Please ensure the server is running on port 3001.`,
        sender: 'assistant',
        type: 'error'
      });
      throw error;
    }
  }

  private async connectSimple(): Promise<void> {
    // Create a simple HTTP client that directly communicates with the MCP server
    // This bypasses the complex transport layer and uses direct HTTP calls
    this.client = {
      async listTools() {
        const response = await fetch('http://localhost:3001/api/tools', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        if (!response.ok) {
          throw new Error('Failed to list tools');
        }
        return await response.json();
      },
      
      async listResources() {
        const response = await fetch('http://localhost:3001/api/resources', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        if (!response.ok) {
          throw new Error('Failed to list resources');
        }
        return await response.json();
      },
      
      async listPrompts() {
        const response = await fetch('http://localhost:3001/api/prompts', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        if (!response.ok) {
          throw new Error('Failed to list prompts');
        }
        return await response.json();
      },
      
      async callTool(request: {name: string, arguments: any}) {
        const response = await fetch('http://localhost:3001/api/tools/call', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: request.name, arguments: request.arguments }),
        });
        if (!response.ok) {
          throw new Error('Failed to call tool');
        }
        return await response.json();
      },
      
      async readResource(request: {uri: string}) {
        const response = await fetch('http://localhost:3001/api/resources/read', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ uri: request.uri }),
        });
        if (!response.ok) {
          throw new Error('Failed to read resource');
        }
        return await response.json();
      },
      
      async getPrompt(request: {name: string, arguments: any}) {
        const response = await fetch('http://localhost:3001/api/prompts/get', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: request.name, arguments: request.arguments }),
        });
        if (!response.ok) {
          throw new Error('Failed to get prompt');
        }
        return await response.json();
      },
      
      close() {
        // No-op for HTTP client
        return Promise.resolve();
      }
    } as any;
  }

  async disconnect(): Promise<void> {
    if (this.client && this.transport) {
      await this.client.close();
      this.client = null;
      this.transport = null;
      this.isConnectedSubject.next(false);
      this.addMessage({
        content: 'Disconnected from MCP server.',
        sender: 'assistant',
        type: 'text'
      });
    }
  }

  private async loadCapabilities(): Promise<void> {
    if (!this.client) return;

    try {
      console.log('Loading capabilities...');
      
      // Load tools
      console.log('Loading tools...');
      const toolsResult = await this.client.listTools();
      console.log('Tools loaded:', toolsResult);
      const tools: AvailableTool[] = toolsResult.tools.map(tool => ({
        name: tool.name,
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema
      }));
      this.availableToolsSubject.next(tools);

      // Load resources
      console.log('Loading resources...');
      const resourcesResult = await this.client.listResources();
      console.log('Resources loaded:', resourcesResult);
      const resources: AvailableResource[] = resourcesResult.resources.map(resource => ({
        uri: resource.uri,
        name: resource.name,
        description: resource.description,
        mimeType: resource.mimeType
      }));
      this.availableResourcesSubject.next(resources);

      // Load prompts
      console.log('Loading prompts...');
      const promptsResult = await this.client.listPrompts();
      console.log('Prompts loaded:', promptsResult);
      const prompts: AvailablePrompt[] = promptsResult.prompts.map(prompt => ({
        name: prompt.name,
        title: prompt.title,
        description: prompt.description,
        arguments: prompt.arguments
      }));
      this.availablePromptsSubject.next(prompts);
      
      console.log('All capabilities loaded successfully');
    } catch (error) {
      console.error('Failed to load capabilities:', error);
    }
  }

  async sendMessage(content: string): Promise<void> {
    if (!this.client) {
      throw new Error('Not connected to MCP server');
    }

    // Add user message
    this.addMessage({
      content,
      sender: 'user',
      type: 'text'
    });

    try {
      // Simple AI-like processing to determine if we should call tools
      const response = await this.processMessage(content);
      this.addMessage({
        content: response,
        sender: 'assistant',
        type: 'text'
      });
    } catch (error) {
      console.error('Error processing message:', error);
      this.addMessage({
        content: 'Sorry, I encountered an error while processing your message.',
        sender: 'assistant',
        type: 'error'
      });
    }
  }

  private async processMessage(content: string): Promise<string> {
    if (!this.client) throw new Error('Not connected');

    const lowerContent = content.toLowerCase();

    // Calculator tool
    if (lowerContent.includes('calculate') || lowerContent.includes('math') || /\d+\s*[\+\-\*\/]\s*\d+/.test(lowerContent)) {
      return await this.handleCalculator(content);
    }

    // Weather tool
    if (lowerContent.includes('weather')) {
      return await this.handleWeather(content);
    }

    // Text processing
    if (lowerContent.includes('uppercase') || lowerContent.includes('lowercase') || 
        lowerContent.includes('reverse') || lowerContent.includes('word count')) {
      return await this.handleTextProcessing(content);
    }

    // System info resource
    if (lowerContent.includes('system') || lowerContent.includes('server info')) {
      return await this.handleSystemInfo();
    }

    // List capabilities
    if (lowerContent.includes('what can you do') || lowerContent.includes('help') || lowerContent.includes('capabilities')) {
      return this.getCapabilitiesHelp();
    }

    // Default response
    return `I received your message: "${content}". I can help with calculations, weather info, text processing, and more. Try asking "what can you do?" to see my capabilities!`;
  }

  private async handleCalculator(content: string): Promise<string> {
    try {
      // Extract numbers and operation from content
      const mathMatch = content.match(/(\d+(?:\.\d+)?)\s*([\+\-\*\/])\s*(\d+(?:\.\d+)?)/);
      if (!mathMatch) {
        return 'Please provide a calculation in the format "number operation number" (e.g., "5 + 3")';
      }

      const a = parseFloat(mathMatch[1]);
      const opSymbol = mathMatch[2];
      const b = parseFloat(mathMatch[3]);

      const operationMap: { [key: string]: string } = {
        '+': 'add',
        '-': 'subtract',
        '*': 'multiply',
        '/': 'divide'
      };

      const operation = operationMap[opSymbol];
      if (!operation) {
        return 'Unsupported operation. Use +, -, *, or /';
      }

      const result = await this.client!.callTool({
        name: 'calculator',
        arguments: { operation, a, b }
      });

      const content_result = result.content as any[];
      return content_result[0]?.type === 'text' ? content_result[0].text : 'Calculation completed';
    } catch (error) {
      return `Calculator error: ${error}`;
    }
  }

  private async handleWeather(content: string): Promise<string> {
    try {
      // Extract city from content (simple approach)
      const cityMatch = content.match(/weather\s+(?:in\s+|for\s+)?([a-zA-Z\s]+?)(?:\s|$|[.!?])/i);
      const city = cityMatch ? cityMatch[1].trim() : 'New York';
      
      const result = await this.client!.callTool({
        name: 'weather',
        arguments: { city, unit: 'celsius' }
      });

      const content_result = result.content as any[];
      return content_result[0]?.type === 'text' ? content_result[0].text : 'Weather info retrieved';
    } catch (error) {
      return `Weather error: ${error}`;
    }
  }

  private async handleTextProcessing(content: string): Promise<string> {
    try {
      let operation: string;
      let text: string;

      if (content.toLowerCase().includes('uppercase')) {
        operation = 'uppercase';
        text = content.replace(/uppercase/gi, '').trim();
      } else if (content.toLowerCase().includes('lowercase')) {
        operation = 'lowercase';
        text = content.replace(/lowercase/gi, '').trim();
      } else if (content.toLowerCase().includes('reverse')) {
        operation = 'reverse';
        text = content.replace(/reverse/gi, '').trim();
      } else if (content.toLowerCase().includes('word count')) {
        operation = 'word-count';
        text = content.replace(/word count/gi, '').trim();
      } else {
        return 'Please specify the text processing operation: uppercase, lowercase, reverse, or word count';
      }

      if (!text) {
        return 'Please provide text to process';
      }

      const result = await this.client!.callTool({
        name: 'text-processor',
        arguments: { text, operation }
      });

      const content_result = result.content as any[];
      return content_result[0]?.type === 'text' ? content_result[0].text : 'Text processed';
    } catch (error) {
      return `Text processing error: ${error}`;
    }
  }

  private async handleSystemInfo(): Promise<string> {
    try {
      const result = await this.client!.readResource({
        uri: 'system://info'
      });

      const contents = result.contents as any[];
      return contents[0]?.text || 'System info retrieved';
    } catch (error) {
      return `System info error: ${error}`;
    }
  }

  private getCapabilitiesHelp(): string {
    const tools = this.availableToolsSubject.value;
    const resources = this.availableResourcesSubject.value;
    
    let help = 'Here\'s what I can do:\n\n**Tools:**\n';
    tools.forEach(tool => {
      help += `• ${tool.title || tool.name}: ${tool.description}\n`;
    });
    
    help += '\n**Resources:**\n';
    resources.forEach(resource => {
      help += `• ${resource.name || resource.uri}: ${resource.description}\n`;
    });

    help += '\n**Examples:**\n';
    help += '• "Calculate 15 + 27"\n';
    help += '• "Weather in London"\n';
    help += '• "Uppercase hello world"\n';
    help += '• "System info"\n';

    return help;
  }

  private addMessage(message: Omit<ChatMessage, 'id' | 'timestamp'>): void {
    const newMessage: ChatMessage = {
      ...message,
      id: crypto.randomUUID(),
      timestamp: new Date()
    };
    
    const currentMessages = this.messagesSubject.value;
    this.messagesSubject.next([...currentMessages, newMessage]);
  }

  getMessages(): ChatMessage[] {
    return this.messagesSubject.value;
  }

  clearMessages(): void {
    this.messagesSubject.next([]);
  }
}
