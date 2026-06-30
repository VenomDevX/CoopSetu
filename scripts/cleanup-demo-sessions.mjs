import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const API_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const CRON_SECRET = process.env.CRON_SECRET || '';

async function cleanup() {
  console.log('Running demo session cleanup...');
  
  try {
    const res = await fetch(`${API_URL}/api/v1/demo/cleanup`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
      },
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('Cleanup failed:', data);
      process.exit(1);
    }

    console.log('Cleanup successful:', data);
  } catch (err) {
    console.error('Error invoking cleanup:', err);
    process.exit(1);
  }
}

cleanup();
