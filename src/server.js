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

const players = { one: 0,
  oneStarted: false,
  two: 0,
  twoStarted: false,
  three: 0,
  threeStarted: false,
  four: 0,
  fourStarted: false };

const users = {};
users.room1 = {};
users.room2 = {};
users.room3 = {};
users.room4 = {};


const readyUsers = {};
readyUsers.room1 = {};
readyUsers.room2 = {};
readyUsers.room3 = {};
readyUsers.room4 = {};

const guesses = {};
guesses.room1 = {};
guesses.room2 = {};
guesses.room3 = {};
guesses.room4 = {};

let doneGuesses = 0;

const words = ['Running', 'Swimming', 'Jumping', 'Dancing', 'Fighting', 'Dabbing', 'Singing', 'Climbing', 'Exercising', 'Killing', 'Cooking',
  'Cleaning', 'Shooting', 'Sliding', 'Sneaking', 'Eating', 'Drinking', 'Chocking', 'Dating', 'Wave-Dashing'];

const onJoin = (sock) => {
  const socket = sock;


  socket.on('join', (data) => {
    if (data.name === '') {
      socket.name = 'Blank';
    } else {
      socket.name = data.name;
    }
    socket.room = data.room;

    for (let i = 0; i < Object.keys(users[socket.room]).length; i++) {
      if (users[socket.room][socket.name]) {
        socket.name += Object.keys(users[socket.room]).length;
      }
    }

    socket.emit('updateUsername', socket.name);

    users[socket.room][socket.name] = { name: socket.name, room: data.room, points: 0 };

    if (data.room === 'room1') players.one++;
    else if (data.room === 'room2') players.two++;
    else if (data.room === 'room3') players.three++;
    else players.four++;

    socket.join(data.room);

    io.sockets.in(data.room).emit('roomWait', users[socket.room]);
  });
};

const checkRooms = (sock, key) => {
  const socket = sock;
  let gameStart = false;

  if (socket.room === 'room1') {
    if (key >= players.one) {
      gameStart = true;
    }
  } else if (socket.room === 'room2') {
    if (key >= players.two) {
      gameStart = true;
    }
  } else if (socket.room === 'room3') {
    if (key >= players.three) {
      gameStart = true;
    }
  } else if (socket.room === 'room4') {
    if (key >= players.four) {
      gameStart = true;
    }
  }
  if (gameStart) return true;
  return false;
};

const onUpdate = (sock) => {
  const socket = sock;

  socket.on('drawGif', (data) => {
    readyUsers[socket.room][socket.name] = users[socket.room][socket.name];
    readyUsers[socket.room][socket.name].gif = data;

    const keys = Object.keys(readyUsers[socket.room]);
    if (checkRooms(socket, keys.length)) {
      io.sockets.in(socket.room).emit('displayGif', readyUsers[socket.room]);
      delete readyUsers[socket.room][keys[0]];
    }
  });

  socket.on('gameReady', () => {
    if (socket.room === 'room1') players.oneStarted = true;
    else if (socket.room === 'room2') players.twoStarted = true;
    else if (socket.room === 'room3') players.threeStarted = true;
    else players.fourStarted = true;

    const keys = Object.keys(users[socket.room]);
    for (let i = 0; i < keys.length; i++) {
      users[socket.room][keys[i]].word = words[Math.floor(Math.random() * 19)];
    }
    io.sockets.in(socket.room).emit('activateStart', users[socket.room]);
  });

  socket.on('enterGuess', (data) => {
    guesses[socket.room][socket.name] = { guess: data, name: socket.name };

    if (checkRooms(socket, Object.keys(guesses[socket.room]).length)) {
      io.sockets.in(socket.room).emit('displayGuess', guesses[socket.room]);
      guesses[socket.room] = {};
    }
  });

  socket.on('doneGuessing', (data) => {
    if (data.points > 40) {
      users[socket.room][socket.name].points += data.points;
      users[socket.room][data.drawler].points += data.points;
    } else {
      users[socket.room][data.drawler].points += data.points;
    }
    doneGuesses++;

    if (checkRooms(socket, doneGuesses + 1)) {
      io.sockets.in(socket.room).emit('pointUpdate', users[socket.room]);
      if (Object.keys(readyUsers[socket.room]).length > 0) {
        io.sockets.in(socket.room).emit('displayGif', readyUsers[socket.room]);
        delete readyUsers[socket.room][Object.keys(readyUsers[socket.room])[0]];
      } else {
        io.sockets.in(socket.room).emit('finalScreen', users[socket.room]);
      }
      doneGuesses = 0;
    }
  });
};

const onDisconnect = (sock) => {
  const socket = sock;

  socket.on('endGame', () => {
    if (socket.room === 'room1') players.oneStarted = false;
    else if (socket.room === 'room2') players.twoStarted = false;
    else if (socket.room === 'room3') players.threeStarted = false;
    else players.fourStarted = false;
  });

  socket.on('disconnect', () => {
    console.log('left');
    socket.leave(socket.room);
    if (users[socket.room]) {
        delete users[socket.room][socket.name];
        if (socket.room === 'room1') players.one--;
        else if (socket.room === 'room2') players.two--;
        else if (socket.room === 'room3') players.three--;
        else players.four--;
    }
  });
};

io.sockets.on('connection', (socket) => {
  console.log('started');
  socket.emit('players', players);
  onJoin(socket);
  onUpdate(socket);
  onDisconnect(socket);
});
console.log('Websocket server started');
