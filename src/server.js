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

// Object contatinng the number of players in each room and if each game has been running
const players = { one: 0,
  oneStarted: false,
  two: 0,
  twoStarted: false,
  three: 0,
  threeStarted: false,
  four: 0,
  fourStarted: false };

// User object with subobject s for each room
const users = {};
users.room1 = {};
users.room2 = {};
users.room3 = {};
users.room4 = {};

// Users objects which are ready to present gif split into subojects for each room
const readyUsers = {};
readyUsers.room1 = {};
readyUsers.room2 = {};
readyUsers.room3 = {};
readyUsers.room4 = {};

// List of guesses split into each room
const guesses = {};
guesses.room1 = {};
guesses.room2 = {};
guesses.room3 = {};
guesses.room4 = {};

// Counts up till everryone has submitted a guess
let doneGuesses = 0;

// List of randomly grabbed words for each player
const words = ['Running', 'Swimming', 'Jumping', 'Dancing', 'Fighting', 'Dabbing', 'Singing', 'Climbing', 'Exercising', 'Killing', 'Cooking',
  'Cleaning', 'Shooting', 'Sliding', 'Sneaking', 'Eating', 'Drinking', 'Chocking', 'Dating', 'Wave-Dashing'];

const onJoin = (sock) => {
  const socket = sock;


  socket.on('join', (data) => {
    // If the user gave no name, there name is blank
    if (data.name === '') {
      socket.name = 'Blank';
    } else {
      socket.name = data.name;
    }
    socket.room = data.room;

    // Loops through and checks if a username already exisxts in that room,
    // if they do, they add a number to make them uniuqe
    for (let i = 0; i < Object.keys(users[socket.room]).length; i++) {
      if (users[socket.room][socket.name]) {
        socket.name += Object.keys(users[socket.room]).length;
      }
    }

    // Tells the user what there username actually is
    socket.emit('updateUsername', socket.name);

    // Create the object with room, name and point total
    users[socket.room][socket.name] = { name: socket.name, room: data.room, points: 0 };

    // Increase player count in appropriate rooms
    if (data.room === 'room1') players.one++;
    else if (data.room === 'room2') players.two++;
    else if (data.room === 'room3') players.three++;
    else players.four++;

    // Join the room
    socket.join(data.room);

    // Emit out to other clients so people know you've joined
    io.sockets.in(data.room).emit('roomWait', users[socket.room]);
  });
};

// Method used to check a finished state
// Takes in socket and a key, which should be the total number of actions needed
const checkRooms = (sock, key) => {
  const socket = sock;

// First it figures out which room the socket is in, then it figures out
// whether the number of actions are eqaul to or grater than the number of players in the room
  if (socket.room === 'room1') {
    if (key >= players.one) {
      return true;
    }
  } else if (socket.room === 'room2') {
    if (key >= players.two) {
      return true;
    }
  } else if (socket.room === 'room3') {
    if (key >= players.three) {
      return true;
    }
  } else if (socket.room === 'room4') {
    if (key >= players.four) {
      return true;
    }
  }
  return false;
};

const onUpdate = (sock) => {
  const socket = sock;

  socket.on('drawGif', (data) => {
    // Once a user has submitted their gif,
    // add them to the appropriate room in the ready users array
    readyUsers[socket.room][socket.name] = users[socket.room][socket.name];
    // Also add thier gif data
    readyUsers[socket.room][socket.name].gif = data;

    // Get the keys for the number of elements in readyUser
    const keys = Object.keys(readyUsers[socket.room]);
    // If everyone has submimtted a response
    if (checkRooms(socket, keys.length)) {
      // pass in all the data and delete the first index,
     // this way when we pass it again on the 3 left will be there
      io.sockets.in(socket.room).emit('displayGif', readyUsers[socket.room]);
      delete readyUsers[socket.room][keys[0]];
    }
  });

  socket.on('gameReady', () => {
    // When players start the game put the room down as started
    if (socket.room === 'room1') players.oneStarted = true;
    else if (socket.room === 'room2') players.twoStarted = true;
    else if (socket.room === 'room3') players.threeStarted = true;
    else players.fourStarted = true;

    const keys = Object.keys(users[socket.room]);
    for (let i = 0; i < keys.length; i++) {
      // Grab a random word from the list to use as their prompt
      users[socket.room][keys[i]].word = words[Math.floor(Math.random() * 19)];
    }
    // pass in the users list to prepare for the intial draw phased
    io.sockets.in(socket.room).emit('activateStart', users[socket.room]);
  });

  socket.on('enterGuess', (data) => {
    // When a player submits a guess, add it to the list
    guesses[socket.room][socket.name] = { guess: data, name: socket.name };

    // Once all gueses have been submitted show them to the players and then empty the guesses array
    if (checkRooms(socket, Object.keys(guesses[socket.room]).length)) {
      io.sockets.in(socket.room).emit('displayGuess', guesses[socket.room]);
      guesses[socket.room] = {};
    }
  });
  socket.on('doneGuessing', (data) => {
    // Simple check, if the points scored was over 40 then the user
    // got it right and it's given to both the guesser and drawler
    if (data.points > 40) {
      users[socket.room][socket.name].points += data.points;
      users[socket.room][data.drawler].points += data.points;
    // Otherwise its just to the person who made the original guess
    } else {
      users[socket.room][data.drawler].points += data.points;
    }
    // Increase guess count by one
    doneGuesses++;

    // If all but one guess has been done (which means we've finished since one
    // player is sitting out per roudn, we ready to move on)
    if (checkRooms(socket, doneGuesses + 1)) {
     // update the players on their point totals
      io.sockets.in(socket.room).emit('pointUpdate', users[socket.room]);

      // If there are still readyUsers left, so gifs that still need to be shown, pass that back
      // into the original function and then delete the first element again, shriking it more
      if (Object.keys(readyUsers[socket.room]).length > 0) {
        io.sockets.in(socket.room).emit('displayGif', readyUsers[socket.room]);
        delete readyUsers[socket.room][Object.keys(readyUsers[socket.room])[0]];
      } else {
        // Otherwise the game has ended, proceeed to the final screen
        io.sockets.in(socket.room).emit('finalScreen', users[socket.room]);
      }
      // Either way reset done guesses
      doneGuesses = 0;
    }
  });
};

const onDisconnect = (sock) => {
  const socket = sock;

 // Remove the started flags from the room
  socket.on('endGame', () => {
    if (socket.room === 'room1') players.oneStarted = false;
    else if (socket.room === 'room2') players.twoStarted = false;
    else if (socket.room === 'room3') players.threeStarted = false;
    else players.fourStarted = false;
  });

  // Full discconnect, leave the room, print out to console.
// delete from the array if possible and subtract from room totals
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
