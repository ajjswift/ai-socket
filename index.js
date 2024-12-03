import { Server } from "socket.io";
import express from "express";
import http from "http"; // Import the http module
import cors from "cors";
import getRedisClient from './redis';
import { decrypt } from "./encrypt";
import bcrypt from 'bcryptjs';

import { handleValidation } from "./validation";
import { broadcast } from "./broadcast";

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

export const connectionMap = {};

io.on('connection', async (socket) => {
  socket.emit('welcome', 'Please validate.');

  socket.on('validate', (m) => handleValidation(m, socket));


  socket.on('rejoin', async (m) => {
    const {clientId, appKey, clientSecret} = m
    if (!clientId || !appKey || !clientSecret) {
      console.log('Invalid params')
      socket.disconnect();
    }

    let decryptedSecret = decrypt(clientSecret);

    const redisClient = await getRedisClient();
    let clientInfo = await redisClient.get(clientId);

    if (!clientInfo) {
      console.log('Invalid client info.')
      socket.disconnect();
    }

    clientInfo = JSON.parse(clientInfo);

    let secretsMatch = await bcrypt.compare(decryptedSecret, clientInfo.secret);


    let roomInfo = await redisClient.get(clientInfo.roomCode)
      if (!roomInfo) {
        console.log("Room no longer exists")
        socket.disconnect();
      }

      roomInfo = JSON.parse(roomInfo);

    if (!secretsMatch) {
      console.log('Unauthorised.')
    }
    try {
      const currentConnections = connectionMap[appKey];

        
      const sanitizedUsers = Object.entries(currentConnections)
        .map(([clientId, { username, colour, active, score }]) => ({ clientId, username, colour, active, score }))
        .filter((u) => u.active === true);


      socket.emit(`rejoin-${clientId}`, {
        roomName: roomInfo.name,
        currentMembers: sanitizedUsers,
        yourScore: currentConnections[clientId].score
      })
      broadcast({
        event: 'user-joined',
        message: {currentMembers: sanitizedUsers},
        appKey: appKey,
        clientId: clientId,
        includeUser: false
      })
      connectionMap[appKey][clientId].active = true; 
      console.log(`User ${clientId} rejoined.`)
    }
    catch (e) {
      console.log('User needs to validate, not rejoin.')
      socket.emit(`revalidate-${clientId}`);
    }
  });


  socket.on('increment-score', async (m) => {
    const {clientId, appKey, score} = m;
    connectionMap[appKey][clientId].score = score;

    const currentConnections = connectionMap[appKey];
    const sanitizedUsers = Object.entries(currentConnections)
      .map(([clientId, { username, colour, active, score }]) => ({ clientId, username, colour, active, score }))
      .filter((u) => u.active === true);
      
    console.log('incrementing score')
    console.log(sanitizedUsers)

    socket.emit('score-updated', {currentMembers: sanitizedUsers});
    broadcast({
      event: 'score-updated',
      message: {currentMembers: sanitizedUsers},
      appKey: appKey,
      clientId: clientId,
      includeUser: false
    })
  });

  socket.on('disconnect', async (m) => {
    for (const appKey in connectionMap) {
      const userConnections = connectionMap[appKey];
  
      for (const clientId in userConnections) {
        const connection = userConnections[clientId];
  
        if (connection.socket.id === socket.id) {
          console.log(`User ${clientId} disconnected.`);

          const sanitizedUsers = Object.values(userConnections)
          .map(({ clientId, username, colour }) => ({ clientId, username, colour }))
          .filter((u) => u.active === true);
          broadcast({
            event: 'user-left',
            message: {currentMembers: sanitizedUsers},
            appKey: appKey,
            clientId: clientId,
            includeUser: false
          })
  
          // Set user active to be false.
          userConnections[clientId].active = false;
          break;
        }
      }
    }
  })
  
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