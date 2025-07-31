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

// Real-time data interfaces - simplified
export interface TimeData {
  currentTime: string;
  date: string;
  timestamp: string;
}

@Injectable({
  providedIn: 'root'
})
export class McpService {
  private client: Client | null = null;
  private transport: StreamableHTTPClientTransport | SSEClientTransport | null = null;
  private eventSource: EventSource | null = null;
  private isConnectedSubject = new BehaviorSubject<boolean>(false);
  private messagesSubject = new BehaviorSubject<ChatMessage[]>([]);
  private availableToolsSubject = new BehaviorSubject<AvailableTool[]>([]);
  private availableResourcesSubject = new BehaviorSubject<AvailableResource[]>([]);
  private availablePromptsSubject = new BehaviorSubject<AvailablePrompt[]>([]);
  
  // Simplified real-time data subject
  private timeDataSubject = new BehaviorSubject<TimeData | null>(null);

  public isConnected$ = this.isConnectedSubject.asObservable();
  public messages$ = this.messagesSubject.asObservable();
  public availableTools$ = this.availableToolsSubject.asObservable();
  public availableResources$ = this.availableResourcesSubject.asObservable();
  public availablePrompts$ = this.availablePromptsSubject.asObservable();
  
  // Simplified real-time data observable
  public timeData$ = this.timeDataSubject.asObservable();

  // private serverUrl = 'http://localhost:3001/mcp';

  constructor() {
    this.addMessage({
      content: '**Welcome to MCP Chatbot! 🤖**\n\n' +
               'Simple demo with real-time server updates.\n\n' +
               '**Features:**\n' +
               '• ⏰ **Live Time Updates** - Server sends time every 6 seconds\n' +
               '• 🧮 **Calculator** - Try "calculate 5 + 3"\n' +
               '• 🌤️ **Weather** - Ask "weather in Paris"\n\n' +
               '**Watch for automatic time updates! ⏰**',
      sender: 'assistant',
      type: 'text'
    });
    
    // Initialize simple SSE connection
    this.initializeSSE();
  }

  private initializeSSE(): void {
    try {
      this.eventSource = new EventSource('http://localhost:3001/sse');
      
      this.eventSource.onopen = () => {
        console.log('SSE connection established');
        this.addMessage({
          content: '**⏰ Live Time Updates Connected!**\n\nServer will send current time every 6 seconds.',
          sender: 'assistant',
          type: 'text'
        });
      };
      
      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleSSEMessage(data);
        } catch (error) {
          console.error('Error parsing SSE message:', error);
        }
      };
      
      // Handle simple time updates from server
      this.eventSource.addEventListener('time-update', (event: any) => {
        try {
          const timeData = JSON.parse(event.data);
          this.timeDataSubject.next(timeData);
          this.addMessage({
            content: `⏰ **${timeData.message}**\n\n📅 Date: ${timeData.date}\n🕐 Time: ${timeData.currentTime}\n📡 *Sent from server via SSE*`,
            sender: 'assistant',
            type: 'tool-result'
          });
        } catch (error) {
          console.error('Error handling time update:', error);
        }
      });
      
      this.eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
      };
      
    } catch (error) {
      console.error('Error initializing SSE:', error);
    }
  }

  private handleSSEMessage(data: any): void {
    // Handle general SSE messages
    console.log('SSE message received:', data);
  }

  async connect(): Promise<void> {
    try {
      
      // First, test if the server is reachable
      const healthCheck = await fetch('http://localhost:3001/health');
      if (!healthCheck.ok) {
        throw new Error('Server is not reachable. Please make sure the MCP server is running.');
      }

      // For now, let's use a simple approach without the complex MCP client
      // This will allow us to demonstrate the SSE functionality
      this.isConnectedSubject.next(true);
      
      this.addMessage({
        content: '**🎉 Connected to MCP server!**\n\n' +
                 '⏰ Time updates will start automatically every 6 seconds.\n\n' +
                 '*(Simplified demo mode)*',
        sender: 'assistant',
        type: 'text'
      });

      // Load simplified tools
      this.availableToolsSubject.next([
        { name: 'calculator', title: 'Calculator', description: 'Perform basic arithmetic operations' },
        { name: 'weather', title: 'Weather', description: 'Get weather information' }
      ]);

    } catch (error) {
      console.error('Connection failed:', error);
      this.addMessage({
        content: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        sender: 'assistant',
        type: 'error'
      });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.client) {
        await this.client.close();
        this.client = null;
      }
      
      if (this.transport) {
        await this.transport.close();
        this.transport = null;
      }
      
      if (this.eventSource) {
        this.eventSource.close();
        this.eventSource = null;
      }
      
      this.isConnectedSubject.next(false);
      this.addMessage({
        content: 'Disconnected from MCP server',
        sender: 'assistant',
        type: 'text'
      });
    } catch (error) {
      console.error('Disconnect failed:', error);
    }
  }

  // private async loadCapabilities(): Promise<void> {
  //   if (!this.client) return;

  //   try {
  //     // Load available tools
  //     const toolsResult = await this.client.listTools();
  //     this.availableToolsSubject.next(toolsResult.tools || []);

  //     // Load available resources
  //     const resourcesResult = await this.client.listResources();
  //     this.availableResourcesSubject.next(resourcesResult.resources || []);

  //     // Load available prompts
  //     const promptsResult = await this.client.listPrompts();
  //     this.availablePromptsSubject.next(promptsResult.prompts || []);

  //   } catch (error) {
  //     console.error('Error loading capabilities:', error);
  //   }
  // }

  async sendMessage(content: string): Promise<void> {
    if (!this.isConnectedSubject.value) {
      this.addMessage({
        content: 'Please connect to the MCP server first',
        sender: 'assistant',
        type: 'error'
      });
      return;
    }

    // Add user message
    this.addMessage({
      content,
      sender: 'user',
      type: 'text'
    });

    try {
      // Parse user input to determine which tool to call
      const lowerContent = content.toLowerCase();
      
      if (lowerContent.includes('calculate') || lowerContent.includes('math')) {
        // Try to extract numbers and operation
        const numbers = content.match(/\d+/g);
        if (numbers && numbers.length >= 2) {
          let operation = 'add';
          if (lowerContent.includes('subtract') || lowerContent.includes('-')) operation = 'subtract';
          if (lowerContent.includes('multiply') || lowerContent.includes('*') || lowerContent.includes('×')) operation = 'multiply';
          if (lowerContent.includes('divide') || lowerContent.includes('/') || lowerContent.includes('÷')) operation = 'divide';
          
          await this.callTool('calculator', {
            operation,
            a: parseInt(numbers[0]),
            b: parseInt(numbers[1])
          });
        } else {
          this.addMessage({
            content: 'Please provide two numbers for calculation. Example: "Calculate 5 + 3"',
            sender: 'assistant',
            type: 'text'
          });
        }
      } else if (lowerContent.includes('weather')) {
        // Extract city name or use default
        const cityMatch = content.match(/weather in (\w+)/i);
        const city = cityMatch ? cityMatch[1] : 'London';
        await this.callTool('weather', { city });
      } else {
        // General response
        this.addMessage({
          content: `I received your message: "${content}". Try asking me to:\n` +
                   `• Calculate something (e.g., "Calculate 15 + 27")\n` +
                   `• Get weather (e.g., "Weather in Paris")\n` +
                   `• Watch for automatic time updates! ⏰`,
          sender: 'assistant',
          type: 'text'
        });
      }

    } catch (error) {
      console.error('Error sending message:', error);
      this.addMessage({
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        sender: 'assistant',
        type: 'error'
      });
    }
  }

  async callTool(name: string, args: any = {}): Promise<any> {
    if (!this.isConnectedSubject.value) {
      throw new Error('Not connected to MCP server');
    }

    try {
      // Use the REST API endpoints instead of MCP client
      const response = await fetch('http://localhost:3001/api/tools/call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, arguments: args })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      this.addMessage({
        content: `Tool "${name}" result: ${result.content[0]?.text || JSON.stringify(result, null, 2)}`,
        sender: 'assistant',
        type: 'tool-result'
      });

      return result;
    } catch (error) {
      console.error('Tool call failed:', error);
      this.addMessage({
        content: `Tool "${name}" failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        sender: 'assistant',
        type: 'error'
      });
      throw error;
    }
  }

  async readResource(uri: string): Promise<any> {
    if (!this.client) {
      throw new Error('Not connected to MCP server');
    }

    try {
      const result = await this.client.readResource({ uri });
      
      this.addMessage({
        content: `Resource "${uri}" content: ${JSON.stringify(result.contents, null, 2)}`,
        sender: 'assistant',
        type: 'tool-result'
      });

      return result;
    } catch (error) {
      console.error('Resource read failed:', error);
      this.addMessage({
        content: `Resource read failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        sender: 'assistant',
        type: 'error'
      });
      throw error;
    }
  }

  async getPrompt(name: string, args: any = {}): Promise<any> {
    if (!this.client) {
      throw new Error('Not connected to MCP server');
    }

    try {
      const result = await this.client.getPrompt({ name, arguments: args });
      
      this.addMessage({
        content: `Prompt "${name}" result: ${JSON.stringify(result, null, 2)}`,
        sender: 'assistant',
        type: 'tool-result'
      });

      return result;
    } catch (error) {
      console.error('Prompt get failed:', error);
      this.addMessage({
        content: `Prompt get failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        sender: 'assistant',
        type: 'error'
      });
      throw error;
    }
  }

  private addMessage(message: Omit<ChatMessage, 'id' | 'timestamp'>): void {
    const newMessage: ChatMessage = {
      ...message,
      id: this.generateId(),
      timestamp: new Date()
    };

    const currentMessages = this.messagesSubject.value;
    this.messagesSubject.next([...currentMessages, newMessage]);
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  clearMessages(): void {
    this.messagesSubject.next([]);
  }

  // Helper method for getting current time data
  getCurrentTimeData(): TimeData | null {
    return this.timeDataSubject.value;
  }
}
