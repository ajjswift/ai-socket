import { decrypt } from "./encrypt";
import getRedisClient from "./redis";
import bcrypt from 'bcrypt'
import { connectionMap } from ".";
import { broadcast } from "./broadcast";

export async function handleValidation(m, socket) {
    const {clientId, appKey, clientSecret, username, colour} = m
    console.log({clientId, appKey, clientSecret, username, colour})
    if (!clientId || !appKey || !clientSecret || !username || !colour) {
        console.log('Disconnecting socket.')
        socket.disconnect();
        return;
    }

    console.log('Validating new user.')
  
      let decryptedSecret = decrypt(clientSecret);
  
      const redisClient = await getRedisClient();
      let clientInfo = await redisClient.get(clientId);
  
      if (!clientInfo) {
        console.log('Invalid client info.')
        socket.disconnect();
      }
  
      clientInfo = JSON.parse(clientInfo);
  
      let secretsMatch = await bcrypt.compare(decryptedSecret, clientInfo.secret);

      if (!secretsMatch) {
        console.log('User not authorised.')
        socket.disconnect();
      }

      let roomInfo = await redisClient.get(clientInfo.roomCode)
      if (!roomInfo) {
        console.log("Room no longer exists")
        socket.disconnect();
      }

      roomInfo = JSON.parse(roomInfo);



      if (!connectionMap[roomInfo.appKey]) {
        connectionMap[roomInfo.appKey] = {};
        
      }
      connectionMap[roomInfo.appKey][clientId] = {
        clientId: clientId,
        username: username,
        colour: colour,
        socket: socket,
        active: true
    }
        
    const currentConnections = connectionMap[appKey];

        
    const sanitizedUsers = Object.entries(currentConnections)
        .map(([clientId, { username, colour, active }]) => ({ clientId, username, colour, active }))
        .filter((u) => u.active === true);

        
    broadcast({
        event: 'user-joined',
        message: {currentMembers: sanitizedUsers},
        appKey: appKey,
        clientId: clientId,
        includeUser: false
    })
        
    socket.emit(`validation-${clientId}`, {
        currentMembers: sanitizedUsers,
        roomName: roomInfo.name
    })

    return;
}