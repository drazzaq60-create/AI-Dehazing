// Create test-minimal.js in backend folder
const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ test: 'OK', time: new Date() }));
});

server.listen(3000, '0.0.0.0', () => {
  console.log('✅ Minimal test server on port 3000');
  console.log('📡 Local: http://localhost:3000');
  console.log('📡 Network: http://192.168.18.21:3000');
});
