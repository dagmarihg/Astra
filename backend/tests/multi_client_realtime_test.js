const io = require('socket.io-client');

function startClient(name) {
  return new Promise((resolve) => {
    const socket = io('http://localhost:3000', { reconnection: false });
    socket.on('connect', () => {
      console.log(`${name}: connected`);
      // send token if provided via env
      const token = process.env.ADMIN_TOKEN || null;
      socket.emit('join_admin', { token });
    });
    socket.onAny((event, payload) => {
      console.log(`${name}: event`, event, payload);
    });
    socket.on('joined', () => resolve(socket));
    socket.on('error', (err) => {
      console.error(`${name}: socket error`, err);
      resolve(socket);
    });
  });
}

(async () => {
  const c1 = await startClient('client1');
  const c2 = await startClient('client2');
  console.log('Two clients connected and joined. Waiting for events...');
  setTimeout(() => {
    c1.close();
    c2.close();
    process.exit(0);
  }, 5000);
})();
