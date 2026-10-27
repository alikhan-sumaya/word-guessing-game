const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

app.use(express.static("public"));

const words = [
  { word: "PLANET", hint: "A large object that orbits a star." },
  { word: "BANANA", hint: "A long, yellow fruit." },
  { word: "PYTHON", hint: "A programming language named after a comedy group." },
  { word: "GUITAR", hint: "A musical instrument with strings." },
  { word: "CASTLE", hint: "A fortified building where royalty may live." },
  { word: "ROCKET", hint: "A vehicle that can travel into space." },
  { word: "PUZZLE", hint: "A game or problem that tests your thinking." },
  { word: "OCEANS", hint: "Large bodies of salt water." },
  { word: "WINDOW", hint: "You can look through it to see outside." },
  { word: "GARDEN", hint: "A place where flowers and plants grow." },
  { word: "JUNGLE", hint: "A dense tropical forest." },
  { word: "CAMERA", hint: "A device used to take photographs." },
  { word: "PLANES", hint: "Flying vehicles that carry people." },
  { word: "CHEESE", hint: "A food commonly made from milk." },
  { word: "SILVER", hint: "A shiny precious metal." }
];

const rooms = new Map();
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function makeRoomCode() {
  let code;
  do {
    code = crypto.randomBytes(3).toString("hex").toUpperCase();
  } while (rooms.has(code));
  return code;
}

function cleanName(name) {
  return String(name || "Player").trim().replace(/[<>]/g, "").slice(0, 18) || "Player";
}

function publicState(room) {
  return {
    code: room.code,
    players: [...room.players.values()].map(p => ({
      id: p.id, name: p.name, score: p.score, connected: p.connected
    })),
    round: room.round,
    maxRounds: room.maxRounds,
    maskedWord: room.word.split("").map((c, i) => room.revealed.has(i) ? c : "_").join(" "),
    hint: room.hint,
    guessedLetters: [...room.guessedLetters].sort(),
    status: room.status,
    message: room.message,
    winner: room.winner,
    secondsLeft: room.secondsLeft
  };
}

function broadcast(room) {
  io.to(room.code).emit("state", publicState(room));
}

function finishRound(room, message) {
  if (room.timer) clearInterval(room.timer);
  room.timer = null;
  room.status = "round-over";
  room.message = message;
  room.secondsLeft = 0;
  broadcast(room);
  setTimeout(() => {
    if (!rooms.has(room.code)) return;
    if (room.round >= room.maxRounds) {
      const players = [...room.players.values()].sort((a, b) => b.score - a.score);
      room.winner = players.length && players[0].score > 0
        ? `${players[0].name} wins with ${players[0].score} point(s)!`
        : "Game over! It's a tie or nobody scored.";
      room.status = "game-over";
      room.message = room.winner;
      broadcast(room);
    } else {
      startRound(room);
    }
  }, 3500);
}

function startRound(room) {
  if (room.timer) clearInterval(room.timer);
  const entry = words[Math.floor(Math.random() * words.length)];
  room.word = entry.word;
  room.hint = entry.hint;
  room.revealed = new Set();
  room.guessedLetters = new Set();
  room.round += 1;
  room.status = "playing";
  room.message = "Guess a letter, or try the whole word!";
  room.secondsLeft = 60;
  room.winner = "";
  broadcast(room);
  room.timer = setInterval(() => {
    room.secondsLeft -= 1;
    if (room.secondsLeft <= 0) {
      finishRound(room, `Time's up! The word was ${room.word}.`);
    } else {
      broadcast(room);
    }
  }, 1000);
}

function createRoom(socket, name) {
  const code = makeRoomCode();
  const room = {
    code, players: new Map(), round: 0, maxRounds: 5, word: "", hint: "",
    revealed: new Set(), guessedLetters: new Set(), status: "waiting",
    message: "Waiting for another player to join.", winner: "", secondsLeft: 60,
    timer: null
  };
  rooms.set(code, room);
  room.players.set(socket.id, { id: socket.id, name: cleanName(name), score: 0, connected: true });
  socket.join(code);
  socket.data.roomCode = code;
  socket.emit("joined", { code, host: true });
  broadcast(room);
}

io.on("connection", socket => {
  socket.on("create-room", ({ name } = {}) => createRoom(socket, name));

  socket.on("join-room", ({ code, name } = {}) => {
    code = String(code || "").trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) return socket.emit("error-message", "Room not found. Check the code and try again.");
    if (room.status !== "waiting") return socket.emit("error-message", "This game has already started.");
    if (room.players.size >= 8) return socket.emit("error-message", "This room is full (maximum 8 players).");
    if ([...room.players.values()].some(p => p.name.toLowerCase() === cleanName(name).toLowerCase())) {
      return socket.emit("error-message", "That name is already in this room. Choose another name.");
    }
    room.players.set(socket.id, { id: socket.id, name: cleanName(name), score: 0, connected: true });
    socket.join(code);
    socket.data.roomCode = code;
    socket.emit("joined", { code, host: false });
    room.message = `${cleanName(name)} joined. The host can start the game.`;
    broadcast(room);
  });

  socket.on("start-game", () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return;
    if ([...room.players.keys()][0] !== socket.id) return socket.emit("error-message", "Only the host can start the game.");
    if (room.players.size < 2) return socket.emit("error-message", "At least 2 players are needed to start.");
    if (room.status !== "waiting") return;
    startRound(room);
  });

  socket.on("guess", ({ guess } = {}) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.status !== "playing") return;
    const player = room.players.get(socket.id);
    if (!player) return;
    guess = String(guess || "").trim().toUpperCase().replace(/[^A-Z]/g, "");
    if (!guess) return;
    if (guess.length === 1) {
      if (room.guessedLetters.has(guess)) return socket.emit("error-message", "That letter has already been guessed.");
      room.guessedLetters.add(guess);
      const indexes = [];
      [...room.word].forEach((letter, i) => { if (letter === guess) indexes.push(i); });
      if (indexes.length) {
        indexes.forEach(i => room.revealed.add(i));
        player.score += indexes.length;
        room.message = `${player.name} found ${indexes.length} ${indexes.length === 1 ? "letter" : "letters"}!`;
      } else {
        room.message = `${player.name} guessed ${guess}. No match!`;
      }
      if (room.revealed.size === room.word.length) {
        player.score += 3;
        return finishRound(room, `${player.name} completed the word and earned 3 bonus points! The word was ${room.word}.`);
      }
      broadcast(room);
    } else {
      if (guess === room.word) {
        player.score += 5;
        room.revealed = new Set([...room.word].map((_, i) => i));
        return finishRound(room, `${player.name} guessed the full word and earned 5 bonus points! The word was ${room.word}.`);
      }
      room.message = `${player.name} tried a word, but it wasn't correct.`;
      broadcast(room);
    }
  });

  socket.on("disconnect", () => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room) return;
    const player = room.players.get(socket.id);
    if (player) {
      player.connected = false;
      room.message = `${player.name} disconnected.`;
      broadcast(room);
    }
    if ([...room.players.values()].every(p => !p.connected)) {
      if (room.timer) clearInterval(room.timer);
      setTimeout(() => rooms.delete(code), 60000);
    }
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Word Guessing Multiplayer running on port ${PORT}`);
});
