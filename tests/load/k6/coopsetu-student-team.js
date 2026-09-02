import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m', target: 25 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.LOAD_BASE_URL || 'http://localhost:3000';
const EMAIL = __ENV.LOAD_STUDENT_EMAIL;
const PASSWORD = __ENV.LOAD_STUDENT_PASSWORD;

export function setup() {
  if (!EMAIL || !PASSWORD) {
    console.error('LOAD_STUDENT_EMAIL and LOAD_STUDENT_PASSWORD are required');
    return { headers: { 'Content-Type': 'application/json' } };
  }
  
  const loginRes = http.post(`${BASE_URL}/api/v1/auth/login`, JSON.stringify({
    identifier: EMAIL,
    password: PASSWORD
  }), {
    headers: { 'Content-Type': 'application/json' }
  });

  if (loginRes.status !== 200) {
    console.error(`Login failed with status ${loginRes.status}`);
    return { headers: { 'Content-Type': 'application/json' } };
  }

  let cookieString = '';
  for (const name in loginRes.cookies) {
    if (loginRes.cookies[name] && loginRes.cookies[name].length > 0) {
      cookieString += `${name}=${loginRes.cookies[name][0].value}; `;
    }
  }

  return { 
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookieString
    }
  };
}

export default function runTest(data) {
  const reqHeaders = data.headers || { 'Content-Type': 'application/json' };
  
  const routes = [
    { path: '/dashboard', name: 'student dashboard SSR' },
    { path: '/api/v1/student-teams/overview', name: 'student team overview api' },
    { path: '/api/v1/student-teams/invalid-join/join-code', name: 'join-code invalid attempt api' },
    { path: '/api/v1/notifications', name: 'notifications api' }
  ];

  for (const route of routes) {
    const res = http.get(`${BASE_URL}${route.path}`, { headers: reqHeaders });
    
    check(res, {
      [`${route.name} no internal error`]: (r) => r.status < 500,
    });
    
    sleep(1);
  }
}

