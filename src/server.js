const http = require('http');
const fs = require('fs');
var url = require('url');
var query = require('querystring');
const socketio = require('socket.io');

const port = process.env.PORT || process.env.NODE_PORT || 3000;

const index = fs.readFileSync(`${__dirname}/../client/client.html`);
const rooms = fs.readFileSync(`${__dirname}/../client/rooms.html`);

const onRequest = (request, response) => {
    let parsedURL = url.parse(request.url);
    let params = query.parse(parsedURL.query);
    console.dir(parsedURL.pathname);
    console.dir(params);
  
    if (parsedURL.pathname === "/game") {
        response.writeHead(200, {'Content-Type' : 'text/html'});
        response.write(index);
        repsonse.end(0);
    }
    else {
        response.writeHead(200, { 'Content-Type': 'text/html' });
        response.write(rooms);
        response.end(0);
    }
};

const app = http.createServer(onRequest).listen(port);

console.log(`Listening on 127.0.0.1 ${port}`);

const io = socketio(app);

const onJoin = (sock) => {
  const socket = sock;

  socket.on('join', () => {
    socket.join('room1');
  });
};

const onDraw = (sock) => {
  const socket = sock;

  socket.on('drawGif', (data) => {
    io.sockets.in('room1').emit('displayGif', data);
  });
};

io.sockets.on('connection', (socket) => {
  console.log('started');
  onJoin(socket);
  onDraw(socket);
});
console.log('Websocket server started');
