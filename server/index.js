const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

app.get('/', (req, res) => {
  res.send('WebRTC Signaling Server is running');
});

const server = http.createServer(app);
const io = socketIO(server, {
  cors: { origin: '*' }
});

const roomOffers = {}; // store latest offer per room

io.on('connection', socket => {
  console.log('New user connected:', socket.id);

  socket.on('join', (roomId) => {
    socket.join(roomId);
    console.log(`Socket ${socket.id} joined room ${roomId}`);

    // if offer already exists, send it to new joiner
    if (roomOffers[roomId]) {
      socket.emit('offer', roomOffers[roomId]);
    }
  });

  socket.on('offer', ({ roomId, offer }) => {
    roomOffers[roomId] = offer;
    socket.to(roomId).emit('offer', offer);
  });

  socket.on('answer', ({ roomId, answer }) => {
    socket.to(roomId).emit('answer', answer);
  });

  socket.on('candidate', ({ roomId, candidate }) => {
    socket.to(roomId).emit('candidate', candidate);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });

  socket.on('answer', ({ roomId, answer }) => {
  delete roomOffers[roomId]; // clear offer once answered
  socket.to(roomId).emit('answer', answer);
});

});

const PORT = process.env.PORT;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
