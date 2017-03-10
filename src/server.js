const http = require('http');
const fs = require('fs');
const socketio = require('socket.io');

const port = process.env.PORT || process.env.NODE_PORT || 3000;

const index = fs.readFileSync(`${__dirname}/../client/client.html`);

const onRequest = (request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/html' });
  response.write(index);
  response.end(0);
};

const app = http.createServer(onRequest).listen(port);

console.log(`Listening on 127.0.0.1 ${port}`);

const io = socketio(app);

const players = { one: 0, two: 0, three: 0, four: 0 };

const onJoin = (sock) => {
  const socket = sock;

  socket.on('join', (data) => {
    if (data.room === 'room1') players.one++;
    else if (data.room === 'room2') players.two++;
    else if (data.room === 'room3') players.three++;
    else players.four++;
      
    socket.join(data.room);
  });
};

const onDraw = (sock) => {
  const socket = sock;

  socket.on('drawGif', (data) => {
    
    io.sockets.in(data[1].room).emit('displayGif', data);
  });
};

io.sockets.on('connection', (socket) => {
  console.log('started');
  socket.emit('players', players);
  onJoin(socket);
  onDraw(socket);
});
console.log('Websocket server started');
