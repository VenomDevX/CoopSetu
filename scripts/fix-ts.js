const fs = require('fs');

const files = [
  'app/api/v1/demo/cleanup/route.ts',
  'app/api/v1/demo/reset/route.ts',
  'app/api/v1/demo/switch-role/route.ts',
  'app/api/v1/demo/status/route.ts',
  'app/api/v1/demo/exit/route.ts'
];

for (const f of files) {
  if (!fs.existsSync(f)) continue;
  let content = fs.readFileSync(f, 'utf8');
  content = content.replace(/Errors\.unauthorized/g, 'Errors.unauthenticated');
  
  // Next.js Response => NextResponse
  content = content.replace(/import \{ NextRequest \} from 'next\/server';/g, "import { NextRequest, NextResponse } from 'next/server';");
  content = content.replace(/return Response\.json/g, "return NextResponse.json");

  fs.writeFileSync(f, content);
}
console.log('Fixed files');
