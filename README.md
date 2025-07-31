# MCP Angular Chatbot

A comprehensive Angular application integrated with Model Context Protocol (MCP) for building intelligent chatbots.

## Features

- 🤖 **MCP Integration**: Full integration with Model Context Protocol SDK
- 💬 **Interactive Chatbot**: Modern chat interface with real-time messaging
- 🔧 **Multiple Tools**: Calculator, weather simulation, text processing
- 📊 **Resources**: System information and dynamic data access
- 🎯 **Prompts**: Reusable prompt templates
- 🔄 **Real-time Updates**: Live connection status and capabilities
- 📱 **Responsive Design**: Mobile-friendly interface
- 🎨 **Modern UI**: Beautiful gradient design with animations

## Architecture

### Frontend (Angular)
- **ChatComponent**: Main chat interface
- **McpService**: Service for MCP client communication
- **Reactive UI**: RxJS observables for real-time updates

### Backend (MCP Server)
- **Express Server**: HTTP server with CORS support
- **MCP Tools**: Calculator, weather, text processing
- **MCP Resources**: System information
- **MCP Prompts**: Chat assistant templates
- **Session Management**: Stateful client connections

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the MCP Server
```bash
npm run server
```
The server will run on `http://localhost:3001`

### 3. Start the Angular App
```bash
npm start
```
The app will run on `http://localhost:4202`

### 4. Development Mode (Both Together)
```bash
npm run dev
```

## Available MCP Tools

### Calculator
- **Purpose**: Perform basic arithmetic operations
- **Usage**: "Calculate 15 + 27" or "5 * 3"
- **Operations**: add, subtract, multiply, divide

### Weather Simulator
- **Purpose**: Get simulated weather information
- **Usage**: "Weather in London" or "Weather in Paris"
- **Features**: Temperature, conditions, unit conversion

### Text Processor
- **Purpose**: Process text with various operations
- **Usage**: "Uppercase hello world" or "Word count this text"
- **Operations**: uppercase, lowercase, reverse, word-count

### System Information
- **Purpose**: Get server system information
- **Usage**: "System info" or "Server info"
- **Data**: Server details, uptime, timestamp

## Chat Examples

Try these example commands:

```
Calculate 25 + 17
Weather in Tokyo
Uppercase make this text bigger
System info
What can you do?
```

## Project Structure

```
mcp/
├── src/
│   ├── app/
│   │   ├── components/
│   │   │   └── chat.component.ts     # Main chat interface
│   │   ├── services/
│   │   │   └── mcp.service.ts        # MCP client service
│   │   ├── app.component.ts          # Root component
│   │   └── app.component.html        # Root template
│   └── main.ts                       # Angular bootstrap
├── mcp-server/
│   └── server.ts                     # MCP server implementation
├── package.json                      # Dependencies and scripts
└── README.md                         # This file
```

## Development

### Adding New Tools

To add a new MCP tool, edit `mcp-server/server.ts`:

```typescript
server.registerTool(
  'my-tool',
  {
    title: 'My Tool',
    description: 'Description of what it does',
    inputSchema: {
      param1: z.string(),
      param2: z.number()
    }
  },
  async ({ param1, param2 }) => {
    // Tool implementation
    return {
      content: [{ type: 'text', text: 'Result' }]
    };
  }
);
```

### Adding New Resources

```typescript
server.registerResource(
  'my-resource',
  'my-resource://data',
  {
    title: 'My Resource',
    description: 'Resource description',
    mimeType: 'application/json'
  },
  async (uri) => ({
    contents: [{
      uri: uri.href,
      text: JSON.stringify({ data: 'value' })
    }]
  })
);
```

## Customization

### Styling
- Edit component styles in `chat.component.ts`
- Modify global styles in `src/styles.scss`

### Server Configuration
- Change server port in `mcp-server/server.ts`
- Update CORS settings for different origins
- Add authentication if needed

### UI Features
- Modify chat interface in `ChatComponent`
- Add new UI components as needed
- Extend `McpService` for additional functionality

## Technical Details

### MCP Integration
- Uses `@modelcontextprotocol/sdk` for client/server communication
- Implements Streamable HTTP transport
- Supports session management and real-time updates

### Angular Features
- Standalone components
- Reactive forms
- RxJS observables
- TypeScript with strict mode

### Communication Flow
1. Angular app connects to MCP server via HTTP
2. User sends message through chat interface
3. McpService processes message and calls appropriate MCP tools
4. Results are displayed in chat interface
5. Available tools/resources are dynamically loaded

## Troubleshooting

### Connection Issues
- Ensure MCP server is running on port 3001
- Check CORS configuration
- Verify network connectivity

### Build Issues
- Run `npm install` to ensure dependencies
- Check TypeScript configuration
- Verify Angular CLI version compatibility

## Future Enhancements

- [ ] Add authentication and authorization
- [ ] Implement custom MCP servers
- [ ] Add file upload/download capabilities
- [ ] Integrate with external APIs
- [ ] Add voice chat support
- [ ] Implement chat history persistence
- [ ] Add user management

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

---

Built with ❤️ using Angular and Model Context Protocol
