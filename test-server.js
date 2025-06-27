import fetch from 'node-fetch';

async function testMcpServer() {
  try {
    console.log('🧪 Testing MCP Server Health...\n');
    
    // Test health endpoint
    const healthResponse = await fetch('http://localhost:3001/health');
    const healthData = await healthResponse.json();
    
    console.log('✅ Health Check Response:');
    console.log(JSON.stringify(healthData, null, 2));
    console.log('\n📊 Server Status:', healthData.status);
    console.log('🕐 Server Timestamp:', healthData.timestamp);
    console.log('📈 Active Sessions:', healthData.activeSessions);
    
  } catch (error) {
    console.error('❌ Error testing MCP server:', error);
  }
}

testMcpServer();
