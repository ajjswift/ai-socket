import { connectionMap } from ".";

export async function broadcast({event, message, appKey, clientId, includeUser = false}) {
    console.log(`BROADCASTING ${event}`)
    const userConnections = connectionMap[appKey];
    Object.values(userConnections).forEach(({ socket: remainingSocket, clientId: loopClientId }) => {
        console.log('to', clientId);
        if (includeUser === false) {
            if (clientId !== loopClientId) {
                remainingSocket.emit(event, message);
            }
        }
        else {
            remainingSocket.emit(event, message);
        }
    });
}