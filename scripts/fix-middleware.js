const fs = require('fs');
let content = fs.readFileSync('lib/supabase/middleware.ts', 'utf8');
content = content.replace(
  "pathname.startsWith('/api/v1/dev/') ||",
  "pathname.startsWith('/api/v1/dev/') ||\n    pathname.startsWith('/api/v1/demo/') ||"
);
fs.writeFileSync('lib/supabase/middleware.ts', content);
