
import { createClient } from 'redis';

require('dotenv').config();

let client = null;

export default async function getRedisClient() {
    if (client === null) {
        client = createClient({
            url: process.env.REDIS_URL
        });

        client.on('error', err => console.error('Redis Client Error:', err));
        
        await client.connect();
    }

    return client;
}

