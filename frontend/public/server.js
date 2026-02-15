const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3001;

const server = http.createServer((req, res) => {
  // Route handling
  let filePath = req.url;
  
  if (filePath === '/') {
    filePath = '/index.html';
  } else if (filePath === '/admin') {
    filePath = '/admin.html';
  } else if (filePath === '/dashboard') {
    filePath = '/dashboard.html';
  }
  
  // Prevent directory traversal
  filePath = path.join(__dirname, filePath);
  if (!filePath.startsWith(path.join(__dirname))) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  // Read and serve file
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath);
    const contentType = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
    }[ext] || 'text/plain';

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Astra frontend listening on http://localhost:${PORT}`);
});
