import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { McpService, ChatMessage, AvailableTool, AvailableResource } from '../services/mcp.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="chat-container">
      <div class="chat-header">
        <h2>🤖 MCP Chatbot</h2>
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

      <div class="chat-sidebar" [class.hidden]="!showSidebar">
        <h3>Available Tools</h3>
        <div class="tools-list">
          <div *ngFor="let tool of availableTools" class="tool-item">
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
      </div>

      <div class="chat-main" [class.full-width]="!showSidebar">
        <div class="chat-messages" #messagesContainer>
          <div *ngFor="let message of messages" 
               class="message" 
               [class.user-message]="message.sender === 'user'"
               [class.assistant-message]="message.sender === 'assistant'"
               [class.error-message]="message.type === 'error'">
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
            <button (click)="sendQuickMessage('System info')" class="quick-btn">System Info</button>
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
  
  private subscriptions: Subscription[] = [];
  private shouldScrollToBottom = false;

  constructor(private mcpService: McpService) {}

  ngOnInit(): void {
    // Subscribe to service observables
    this.subscriptions.push(
      this.mcpService.isConnected$.subscribe(connected => {
        this.isConnected = connected;
        this.isConnecting = false;
      }),
      
      this.mcpService.messages$.subscribe(messages => {
        this.messages = messages;
        this.shouldScrollToBottom = true;
      }),
      
      this.mcpService.availableTools$.subscribe(tools => {
        this.availableTools = tools;
      }),
      
      this.mcpService.availableResources$.subscribe(resources => {
        this.availableResources = resources;
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

  private scrollToBottom(): void {
    try {
      const container = this.messagesContainer.nativeElement;
      container.scrollTop = container.scrollHeight;
    } catch (err) {
      console.error('Error scrolling to bottom:', err);
    }
  }
}
