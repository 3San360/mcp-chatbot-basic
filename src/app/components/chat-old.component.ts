import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { McpService, ChatMessage, AvailableTool, TimeData } from '../services/mcp.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="chat-container">
      <div class="chat-header">
        <h2>🤖 MCP Chatbot with Real-time Data</h2>
        <div class="connection-status">
          <span [class]="isConnected ? 'connected' : 'disconnected'">
            {{ isConnected ? '🟢 Connected' : '🔴 Disconnected' }}
          </span>
          <button 
            (click)="toggleConnection()" 
            [disabled]="isConnecting"
            class="connection-btn">
            {{ isConnecting ? 'Connecting...' : (isConnected ? 'Disconnect' : 'Connect') }}
          </button>
        </div>
      </div>

      <!-- Real-time Data Dashboard -->
      <div class="realtime-dashboard" *ngIf="isConnected">
        <div class="data-card weather-card" *ngIf="currentWeather">
          <h4>🌤️ Weather</h4>
          <div class="data-content">
            <span class="temp">{{ currentWeather.temp }}°C</span>
            <span class="condition">{{ currentWeather.condition }}</span>
            <div class="details">
              <small>💨 {{ currentWeather.windSpeed }} km/h | 💧 {{ currentWeather.humidity }}% | 📊 {{ currentWeather.pressure }} hPa</small>
            </div>
          </div>
        </div>

        <div class="data-card crypto-card" *ngIf="currentCrypto?.length">
          <h4>💰 Crypto Prices</h4>
          <div class="crypto-list">
            <div *ngFor="let crypto of currentCrypto.slice(0, 3)" class="crypto-item">
              <span class="symbol">{{ crypto.symbol }}</span>
              <span class="price">\${{ crypto.price.toFixed(2) }}</span>
              <span class="change" [class.positive]="crypto.change > 0" [class.negative]="crypto.change < 0">
                {{ crypto.change > 0 ? '+' : '' }}{{ crypto.change.toFixed(2) }}%
              </span>
            </div>
          </div>
        </div>

        <div class="data-card news-card" *ngIf="currentNews?.length">
          <h4>📰 Latest News</h4>
          <div class="news-item" *ngIf="currentNews[0]">
            <strong>{{ currentNews[0].title }}</strong>
            <small>{{ currentNews[0].category }} • {{ formatDate(currentNews[0].publishedAt) }}</small>
          </div>
        </div>
      </div>

      <!-- <div class="chat-sidebar" [class.hidden]="!showSidebar">
        <h3>Available Tools</h3>
        <div class="tools-list">
          <div *ngFor="let tool of availableTools" class="tool-item" (click)="selectTool(tool)">
            <strong>{{ tool.title || tool.name }}</strong>
            <small>{{ tool.description }}</small>
          </div>
        </div>
        
        <h3>Available Resources</h3>
        <div class="resources-list">
          <div *ngFor="let resource of availableResources" class="resource-item">
            <strong>{{ resource.name || resource.uri }}</strong>
            <small>{{ resource.description }}</small>
          </div>
        </div>
      </div> -->

      <div class="chat-main" [class.full-width]="!showSidebar">
        <div class="chat-messages" #messagesContainer>
          <div *ngFor="let message of messages" 
               class="message" 
               [class.user-message]="message.sender === 'user'"
               [class.assistant-message]="message.sender === 'assistant'"
               [class.error-message]="message.type === 'error'"
               [class.sse-demo-message]="isSSEDemoMessage(message)">
            <div class="message-content">
              <div class="message-text" [innerHTML]="formatMessage(message.content)"></div>
              <div class="message-time">{{ formatTime(message.timestamp) }}</div>
            </div>
          </div>
        </div>

        <div class="chat-input-container">
          <div class="quick-actions">
            <button (click)="sendQuickMessage('What can you do?')" class="quick-btn">Help</button>
            <button (click)="sendQuickMessage('Calculate 15 + 27')" class="quick-btn">Calculator</button>
            <button (click)="sendQuickMessage('Weather in Paris')" class="quick-btn">Weather</button>
            <button (click)="sendQuickMessage('Show crypto prices')" class="quick-btn">Crypto</button>
            <button (click)="sendQuickMessage('Latest tech news')" class="quick-btn">News</button>
            <button (click)="clearChat()" class="quick-btn danger">Clear</button>
            <button (click)="toggleSidebar()" class="quick-btn">{{ showSidebar ? 'Hide' : 'Show' }} Tools</button>
          </div>
          
          <div class="input-row">
            <input 
              type="text" 
              [(ngModel)]="currentMessage" 
              (keyup.enter)="sendMessage()"
              [disabled]="!isConnected || isSending"
              placeholder="Type your message... (try 'calculate 5 + 3' or 'weather in London')"
              class="message-input">
            <button 
              (click)="sendMessage()" 
              [disabled]="!isConnected || !currentMessage.trim() || isSending"
              class="send-btn">
              {{ isSending ? 'Sending...' : 'Send' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .chat-container {
      display: flex;
      flex-direction: column;
      height: 100vh;
      max-width: 1400px;
      margin: 0 auto;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      overflow: hidden;
      background: white;
    }

    .realtime-dashboard {
      display: flex;
      gap: 1rem;
      padding: 1rem;
      background: #f8f9fa;
      border-bottom: 1px solid #e0e0e0;
      flex-wrap: wrap;
    }

    .data-card {
      flex: 1;
      min-width: 200px;
      background: white;
      border-radius: 8px;
      padding: 1rem;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      border-left: 4px solid;
    }

    .weather-card {
      border-left-color: #ff9800;
    }

    .crypto-card {
      border-left-color: #4caf50;
    }

    .news-card {
      border-left-color: #2196f3;
    }

    .data-card h4 {
      margin: 0 0 0.5rem 0;
      font-size: 0.9rem;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .data-content {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .temp {
      font-size: 1.5rem;
      font-weight: bold;
      color: #ff9800;
    }

    .condition {
      font-size: 1rem;
      color: #666;
    }

    .details {
      margin-top: 0.5rem;
    }

    .crypto-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .crypto-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.25rem 0;
    }

    .symbol {
      font-weight: bold;
      color: #333;
    }

    .price {
      font-weight: bold;
      color: #4caf50;
    }

    .change {
      font-size: 0.9rem;
      padding: 0.1rem 0.3rem;
      border-radius: 3px;
    }

    .change.positive {
      background: #e8f5e8;
      color: #4caf50;
    }

    .change.negative {
      background: #ffeaea;
      color: #f44336;
    }

    .news-item {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .news-item strong {
      font-size: 0.9rem;
      line-height: 1.3;
      color: #333;
    }

    .news-item small {
      color: #666;
      font-size: 0.8rem;
    }

    .chat-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .chat-header h2 {
      margin: 0;
      font-size: 1.5rem;
    }

    .connection-status {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .connected {
      color: #4caf50;
      font-weight: bold;
    }

    .disconnected {
      color: #f44336;
      font-weight: bold;
    }

    .connection-btn {
      padding: 0.5rem 1rem;
      border: none;
      border-radius: 4px;
      background: rgba(255,255,255,0.2);
      color: white;
      cursor: pointer;
      transition: background 0.3s;
    }

    .connection-btn:hover:not(:disabled) {
      background: rgba(255,255,255,0.3);
    }

    .connection-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .chat-main {
      display: flex;
      flex-direction: column;
      flex: 1;
      transition: all 0.3s ease;
    }

    .chat-main.full-width {
      width: 100%;
    }

    .chat-sidebar {
      position: fixed;
      right: 0;
      top: 80px;
      width: 300px;
      height: calc(100vh - 80px);
      background: #f8f9fa;
      border-left: 1px solid #e0e0e0;
      padding: 1rem;
      overflow-y: auto;
      transition: transform 0.3s ease;
      z-index: 1000;
    }

    .chat-sidebar.hidden {
      transform: translateX(100%);
    }

    .chat-sidebar h3 {
      margin: 0 0 0.5rem 0;
      color: #333;
      font-size: 1.1rem;
      border-bottom: 2px solid #667eea;
      padding-bottom: 0.5rem;
    }

    .tools-list, .resources-list {
      margin-bottom: 2rem;
    }

    .tool-item, .resource-item {
      padding: 0.75rem;
      margin-bottom: 0.5rem;
      background: white;
      border-radius: 6px;
      border-left: 4px solid #667eea;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .tool-item strong, .resource-item strong {
      display: block;
      color: #333;
      margin-bottom: 0.25rem;
    }

    .tool-item small, .resource-item small {
      color: #666;
      font-size: 0.875rem;
    }

    .chat-messages {
      flex: 1;
      padding: 1rem;
      overflow-y: auto;
      background: #f8f9fa;
    }

    .message {
      margin-bottom: 1rem;
      display: flex;
    }

    .user-message {
      justify-content: flex-end;
    }

    .assistant-message {
      justify-content: flex-start;
    }

    .error-message .message-content {
      background: #ffebee !important;
      border-left: 4px solid #f44336 !important;
    }

    .sse-demo-message .message-content {
      background: linear-gradient(135deg, #00c851 0%, #007e33 100%) !important;
      color: white !important;
      border: none !important;
      box-shadow: 0 4px 12px rgba(0, 200, 81, 0.3) !important;
      animation: pulse-sse 2s ease-in-out;
    }

    @keyframes pulse-sse {
      0% { transform: scale(1); box-shadow: 0 4px 12px rgba(0, 200, 81, 0.3); }
      50% { transform: scale(1.02); box-shadow: 0 6px 16px rgba(0, 200, 81, 0.5); }
      100% { transform: scale(1); box-shadow: 0 4px 12px rgba(0, 200, 81, 0.3); }
    }

    .sse-demo-message .message-time {
      color: rgba(255, 255, 255, 0.8) !important;
    }

    .message-content {
      max-width: 70%;
      padding: 1rem;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    .user-message .message-content {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .assistant-message .message-content {
      background: white;
      border: 1px solid #e0e0e0;
    }

    .message-text {
      line-height: 1.6;
      white-space: pre-wrap;
      word-wrap: break-word;
    }

    .message-time {
      font-size: 0.75rem;
      opacity: 0.7;
      margin-top: 0.5rem;
      text-align: right;
    }

    .chat-input-container {
      padding: 1rem;
      background: white;
      border-top: 1px solid #e0e0e0;
    }

    .quick-actions {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1rem;
      flex-wrap: wrap;
    }

    .quick-btn {
      padding: 0.5rem 1rem;
      border: 1px solid #667eea;
      border-radius: 20px;
      background: white;
      color: #667eea;
      cursor: pointer;
      font-size: 0.875rem;
      transition: all 0.3s;
    }

    .quick-btn:hover {
      background: #667eea;
      color: white;
    }

    .quick-btn.danger {
      border-color: #f44336;
      color: #f44336;
    }

    .quick-btn.danger:hover {
      background: #f44336;
      color: white;
    }

    .input-row {
      display: flex;
      gap: 0.5rem;
    }

    .message-input {
      flex: 1;
      padding: 1rem;
      border: 1px solid #e0e0e0;
      border-radius: 25px;
      font-size: 1rem;
      outline: none;
      transition: border-color 0.3s;
    }

    .message-input:focus {
      border-color: #667eea;
    }

    .message-input:disabled {
      background: #f5f5f5;
      cursor: not-allowed;
    }

    .send-btn {
      padding: 1rem 2rem;
      border: none;
      border-radius: 25px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      cursor: pointer;
      font-size: 1rem;
      transition: opacity 0.3s;
    }

    .send-btn:hover:not(:disabled) {
      opacity: 0.9;
    }

    .send-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    @media (max-width: 768px) {
      .chat-sidebar {
        width: 100%;
        top: 0;
        height: 100vh;
      }
      
      .message-content {
        max-width: 90%;
      }
      
      .quick-actions {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 0.5rem;
      }
    }

    /* Real-time Data Dashboard Styles */
    .realtime-dashboard {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1rem;
      padding: 1rem;
      background: #f1f3f5;
      border-radius: 8px;
      margin-bottom: 1rem;
    }

    .data-card {
      background: white;
      padding: 1rem;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .weather-card {
      border-left: 4px solid #2196F3;
    }

    .crypto-card {
      border-left: 4px solid #4CAF50;
    }

    .news-card {
      border-left: 4px solid #FF9800;
    }

    .data-content {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .temp {
      font-size: 2rem;
      font-weight: bold;
    }

    .condition {
      font-size: 1rem;
      color: #666;
    }

    .details {
      font-size: 0.875rem;
      color: #999;
    }

    .crypto-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .crypto-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .symbol {
      font-weight: bold;
      color: #333;
    }

    .price {
      font-size: 1.125rem;
      color: #4CAF50;
    }

    .change {
      font-size: 0.875rem;
      padding: 0.25rem 0.5rem;
      border-radius: 12px;
    }

    .change.positive {
      background: rgba(76, 175, 80, 0.1);
      color: #4CAF50;
    }

    .change.negative {
      background: rgba(244, 67, 54, 0.1);
      color: #F44336;
    }

    .news-item {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .news-item strong {
      color: #333;
    }

    .news-item small {
      color: #666;
      font-size: 0.875rem;
    }
  `]
})
export class ChatComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;
  
  messages: ChatMessage[] = [];
  availableTools: AvailableTool[] = [];
  availableResources: AvailableResource[] = [];
  currentMessage = '';
  isConnected = false;
  isConnecting = false;
  isSending = false;
  showSidebar = true;
  
  // Real-time data properties
  currentWeather: WeatherData | null = null;
  currentCrypto: CryptoData[] = [];
  currentNews: NewsArticle[] = [];
  
  private subscriptions: Subscription[] = [];
  private shouldScrollToBottom = false;

  constructor(private mcpService: McpService) {}

  ngOnInit(): void {
    // Subscribe to service observables
    this.subscriptions.push(
      this.mcpService.isConnected$.subscribe((connected: boolean) => {
        this.isConnected = connected;
        this.isConnecting = false;
      }),
      
      this.mcpService.messages$.subscribe((messages: ChatMessage[]) => {
        this.messages = messages;
        this.shouldScrollToBottom = true;
      }),
      
      this.mcpService.availableTools$.subscribe((tools: AvailableTool[]) => {
        this.availableTools = tools;
      }),
      
      this.mcpService.availableResources$.subscribe((resources: AvailableResource[]) => {
        this.availableResources = resources;
      }),
      
      // Subscribe to real-time data
      this.mcpService.weatherData$.subscribe((weather: WeatherData | null) => {
        this.currentWeather = weather;
      }),
      
      this.mcpService.cryptoData$.subscribe((crypto: CryptoData[]) => {
        this.currentCrypto = crypto;
      }),
      
      this.mcpService.newsData$.subscribe((news: NewsArticle[]) => {
        this.currentNews = news;
      })
    );

    // Auto-connect on component init
    this.connectToServer();
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  async toggleConnection(): Promise<void> {
    if (this.isConnected) {
      await this.mcpService.disconnect();
    } else {
      await this.connectToServer();
    }
  }

  private async connectToServer(): Promise<void> {
    this.isConnecting = true;
    try {
      await this.mcpService.connect();
    } catch (error) {
      console.error('Connection failed:', error);
    } finally {
      this.isConnecting = false;
    }
  }

  async sendMessage(): Promise<void> {
    if (!this.currentMessage.trim() || !this.isConnected || this.isSending) {
      return;
    }

    const message = this.currentMessage.trim();
    this.currentMessage = '';
    this.isSending = true;

    try {
      await this.mcpService.sendMessage(message);
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      this.isSending = false;
    }
  }

  sendQuickMessage(message: string): void {
    this.currentMessage = message;
    this.sendMessage();
  }

  clearChat(): void {
    this.mcpService.clearMessages();
  }

  toggleSidebar(): void {
    this.showSidebar = !this.showSidebar;
  }

  isSSEDemoMessage(message: ChatMessage): boolean {
    return message.content.includes('SSE Demo Message') || 
           message.content.includes('SSE Connection Established') ||
           message.content.includes('Live from server every 10 seconds');
  }

  formatMessage(content: string): string {
    // Convert newlines to <br> tags and handle basic formatting
    return content
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>');
  }

  formatTime(timestamp: Date): string {
    return timestamp.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }

  formatDate(dateString: string): string {
    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    };
    return new Date(dateString).toLocaleString([], options);
  }

  private scrollToBottom(): void {
    try {
      const container = this.messagesContainer.nativeElement;
      container.scrollTop = container.scrollHeight;
    } catch (err) {
      console.error('Error scrolling to bottom:', err);
    }
  }

  selectTool(tool: AvailableTool): void {
    // Implement tool selection logic
    console.log('Tool selected:', tool);
  }
}
