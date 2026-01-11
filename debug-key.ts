import dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), './.env') });

const KEY = process.env.OPENROUTER_API_KEY;

async function test() {
    console.log('Testing Key:', KEY?.substring(0, 10) + '...' + KEY?.substring(KEY.length - 5));

    const response = await fetch('https://openrouter.ai/api/v1/auth/key', {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${KEY}`,
        }
    });

    const data = await response.json();
    console.log('Response Status:', response.status);
    console.log('Response Body:', JSON.stringify(data, null, 2));
}

test();
