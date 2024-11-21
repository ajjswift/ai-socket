import { Server } from "socket.io";
import express from "express";
import http from "http"; // Import the http module
import cors from "cors";
import getRedisClient from './redis';

const app = express();

// Use CORS middleware
app.use(cors({
  methods: ['GET', 'POST'],
  credentials: true,
}));

// Create an HTTP server and pass it to Socket.IO
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    credentials: true,
  },
});

const connectionMap = {};

io.on('connection', async (socket) => {
  socket.emit('welcome', 'Please validate.');

  socket.on('validate', async (m) => {
    try {
      console.log('Received validation message:', m);

      const { roomCode, appKey, clientId, username } = m;

      if (!username || !appKey || !clientId) {
        console.log('Invalid data received, disconnecting.');
        socket.disconnect();
        return;
      }

      if (!connectionMap[appKey]) {
        connectionMap[appKey] = {};
      }

      const redisClient = await getRedisClient();
      const roomInfo = await redisClient.get(clientId);

      if (!roomInfo) {
        console.log('Room information not found, disconnecting.');
        socket.disconnect();
        return;
      }

      const currentConnections = connectionMap[appKey];

      // Notify other users in the room
      for (const [key, connection] of Object.entries(currentConnections)) {
        if (connection.clientId !== clientId) {
          connection.socket.emit('user-joined', JSON.stringify({ username, clientId }));
        }
      }

      // Register the new connection
      connectionMap[appKey][clientId] = {
        socket,
        clientId,
        username,
      };

      // Emit the validated response
      const sanitizedUsers = Object.values(connectionMap[appKey]).map(({ clientId, username }) => ({
        clientId,
        username,
      }));

      socket.emit(`validated-${clientId}`, { currentMembers: sanitizedUsers });

    } catch (error) {
      console.error('Error during validation:', error);
      socket.disconnect();
    }
  });

  socket.on('disconnect', () => {
    try {
      for (const appKey in connectionMap) {
        const userConnections = connectionMap[appKey];
        for (const clientId in userConnections) {
          if (userConnections[clientId].socket.id === socket.id) {
            console.log(`User ${clientId} disconnected.`);

            for (const [key, connection] of Object.entries(userConnections)) {
              if (connection.clientId !== clientId) {
                connection.socket.emit('user-left', JSON.stringify({ username: userConnections[clientId].username, clientId: userConnections[clientId].clientId }));
              }
            }

            delete userConnections[clientId];
            break;
          }


        }
      }
    } catch (error) {
      console.error('Error during disconnect cleanup:', error);
    }
  });
});

// Health check endpoints
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.get('/', (req, res) => {
  res.status(200).send('OK');
});

server.listen(4566, () => {
  console.log('Server started on port 4566');
});