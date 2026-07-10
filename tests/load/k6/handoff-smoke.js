import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m', target: 25 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'], // p95 target under 1000ms
    http_req_failed: ['rate<0.01'],    // error rate under 1%
  },
};

const BASE_URL = __ENV.LOAD_BASE_URL || 'http://localhost:3000';

export default function () {
  const routes = [
    { path: '/', name: 'landing' },
    { path: '/login', name: 'login' },
    { path: '/signup', name: 'signup' },
    { path: '/demo', name: 'demo' }
  ];

  for (const route of routes) {
    const res = http.get(`${BASE_URL}${route.path}`);
    
    // Check results safely without exposing response bodies
    check(res, {
      [`${route.name} status is 200`]: (r) => r.status === 200,
    });
    
    // Simulate user reading time
    sleep(1);
  }
}
