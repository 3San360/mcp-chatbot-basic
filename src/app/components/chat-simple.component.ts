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
        <h2>🤖 MCP Chatbot with Live Time Updates</h2>
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

      <!-- Simple Time Display -->
      <div class="time-display" *ngIf="currentTime">
        <div class="time-card">
          <h4>⏰ Live Server Time</h4>
          <div class="time-content">
            <span class="time">{{ currentTime.currentTime }}</span>
            <span class="date">{{ currentTime.date }}</span>
            <small>📡 Updated every 6 seconds via SSE</small>
          </div>
        </div>
      </div>

      <div class="chat-main">
        <div class="chat-messages" #messagesContainer>
          <div *ngFor="let message of messages" 
               class="message" 
               [class.user-message]="message.sender === 'user'"
               [class.assistant-message]="message.sender === 'assistant'"
               [class.error-message]="message.type === 'error'"
               [class.time-update-message]="isTimeUpdateMessage(message)">
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
            <button (click)="clearChat()" class="quick-btn danger">Clear</button>
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
      max-width: 900px;
      margin: 0 auto;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      overflow: hidden;
      background: white;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }

    .chat-header {
      padding: 1rem;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .chat-header h2 {
      margin: 0;
      font-size: 1.25rem;
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
      background: rgba(255,255,255,0.2);
      border: 1px solid rgba(255,255,255,0.3);
      color: white;
      padding: 0.5rem 1rem;
      border-radius: 20px;
      cursor: pointer;
      transition: all 0.3s;
    }

    .connection-btn:hover:not(:disabled) {
      background: rgba(255,255,255,0.3);
    }

    .connection-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .time-display {
      padding: 1rem;
      background: #f8f9fa;
      border-bottom: 1px solid #e0e0e0;
    }

    .time-card {
      background: white;
      padding: 1rem;
      border-radius: 8px;
      text-align: center;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .time-card h4 {
      margin: 0 0 0.5rem 0;
      color: #333;
    }

    .time-content {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .time {
      font-size: 1.5rem;
      font-weight: bold;
      color: #667eea;
    }

    .date {
      font-size: 1rem;
      color: #666;
    }

    .time-content small {
      color: #999;
      font-size: 0.875rem;
    }

    .chat-main {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
    }

    .chat-messages {
      flex: 1;
      padding: 1rem;
      overflow-y: auto;
      background: #f8f9fa;
      max-height: 500px;
    }

    .chat-messages::-webkit-scrollbar {
      width: 8px;
    }

    .chat-messages::-webkit-scrollbar-track {
      background: #f1f1f1;
      border-radius: 4px;
    }

    .chat-messages::-webkit-scrollbar-thumb {
      background: #c1c1c1;
      border-radius: 4px;
    }

    .chat-messages::-webkit-scrollbar-thumb:hover {
      background: #a1a1a1;
    }

    .message {
      margin-bottom: 1rem;
      display: flex;
      animation: slideIn 0.3s ease-out;
    }

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
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

    .time-update-message .message-content {
      background: linear-gradient(135deg, #4caf50 0%, #45a049 100%) !important;
      color: white !important;
      border: none !important;
      box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3) !important;
      animation: pulse-time 1.5s ease-in-out;
    }

    @keyframes pulse-time {
      0% { transform: scale(1); box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3); }
      50% { transform: scale(1.02); box-shadow: 0 6px 16px rgba(76, 175, 80, 0.5); }
      100% { transform: scale(1); box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3); }
    }

    .time-update-message .message-time {
      color: rgba(255, 255, 255, 0.8) !important;
    }

    .message-content {
      max-width: 75%;
      padding: 1rem;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      word-wrap: break-word;
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
      padding: 0.75rem;
      border: 1px solid #ddd;
      border-radius: 25px;
      outline: none;
      font-size: 1rem;
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
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 25px;
      cursor: pointer;
      font-size: 1rem;
      transition: all 0.3s;
    }

    .send-btn:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    }

    .send-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    /* Responsive design */
    @media (max-width: 768px) {
      .chat-container {
        height: 100vh;
        border-radius: 0;
      }

      .message-content {
        max-width: 85%;
      }

      .quick-actions {
        justify-content: center;
      }

      .time-content {
        align-items: center;
      }
    }
  `]
})
export class ChatComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;

  messages: ChatMessage[] = [];
  currentMessage = '';
  isConnected = false;
  isConnecting = false;
  isSending = false;
  
  availableTools: AvailableTool[] = [];
  currentTime: TimeData | null = null;

  private subscriptions: Subscription[] = [];

  constructor(private mcpService: McpService) {}

  ngOnInit(): void {
    // Subscribe to messages
    this.subscriptions.push(
      this.mcpService.messages$.subscribe((messages: ChatMessage[]) => {
        this.messages = messages;
      })
    );

    // Subscribe to connection status
    this.subscriptions.push(
      this.mcpService.isConnected$.subscribe((connected: boolean) => {
        this.isConnected = connected;
        this.isConnecting = false;
      })
    );

    // Subscribe to available tools
    this.subscriptions.push(
      this.mcpService.availableTools$.subscribe((tools: AvailableTool[]) => {
        this.availableTools = tools;
      })
    );

    // Subscribe to time data
    this.subscriptions.push(
      this.mcpService.timeData$.subscribe((timeData: TimeData | null) => {
        this.currentTime = timeData;
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  ngAfterViewChecked(): void {
    this.scrollToBottom();
  }

  async toggleConnection(): Promise<void> {
    if (this.isConnected) {
      await this.mcpService.disconnect();
    } else {
      this.isConnecting = true;
      try {
        await this.mcpService.connect();
      } catch (error) {
        console.error('Connection failed:', error);
        this.isConnecting = false;
      }
    }
  }

  async sendMessage(): Promise<void> {
    if (!this.currentMessage.trim() || this.isSending) return;

    this.isSending = true;
    try {
      await this.mcpService.sendMessage(this.currentMessage);
      this.currentMessage = '';
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      this.isSending = false;
    }
  }

  async sendQuickMessage(message: string): Promise<void> {
    this.currentMessage = message;
    await this.sendMessage();
  }

  clearChat(): void {
    this.mcpService.clearMessages();
  }

  isTimeUpdateMessage(message: ChatMessage): boolean {
    return message.content.includes('Server Time Update') || 
           message.content.includes('Sent from server via SSE');
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
      // Ignore errors
    }
  }
}
