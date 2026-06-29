const fetch = require('node-fetch');

async function test() {
  // Let's test the endpoint locally by sending an empty request, just to see what error it returns.
  // It should return 401 Unauthorized because we don't have a session.
  const res = await fetch('http://localhost:3001/api/v1/projects');
  console.log(res.status, await res.text());
}
test();
