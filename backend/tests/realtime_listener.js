const io = require('socket.io-client');

const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('listener: connected');
  socket.emit('join_admin', {});
});

socket.onAny((event, payload) => {
  console.log('listener: event', event, payload);
});

socket.on('disconnect', () => console.log('listener: disconnected'));
