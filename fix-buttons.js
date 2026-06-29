const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'app/dashboard/qa-security/page.tsx');
let c = fs.readFileSync(file, 'utf-8');

// Replace disabled ShieldCheck button
c = c.replace(
  /          <Button variant="outline" disabled title="Not available yet" className="h-9 px-4 rounded-none text-xs font-mono uppercase tracking-widest border-border text-foreground gap-2 disabled:opacity-40">\r?\n            <ShieldCheck className="w-4 h-4" \/>\r?\n            Start Security Review\r?\n          <\/Button>/,
  `          <Button onClick={() => setShowSecurityReview(true)} variant="outline" className="h-9 px-4 rounded-none text-xs font-mono uppercase tracking-widest border-border text-foreground gap-2">\r\n            <ShieldCheck className="w-4 h-4" />\r\n            Start Security Review\r\n          </Button>`
);

// Replace disabled FileCheck button
c = c.replace(
  /          <Button variant="outline" disabled title="Not available yet" className="h-9 px-4 rounded-none text-xs font-mono uppercase tracking-widest border-border text-foreground gap-2 disabled:opacity-40">\r?\n            <FileCheck className="w-4 h-4" \/>\r?\n            Create Test Plan\r?\n          <\/Button>/,
  `          <Button onClick={() => setShowCreateTestPlan(true)} variant="outline" className="h-9 px-4 rounded-none text-xs font-mono uppercase tracking-widest border-border text-foreground gap-2">\r\n            <FileCheck className="w-4 h-4" />\r\n            Create Test Plan\r\n          </Button>`
);

// Replace disabled Plus/Create Bug button
c = c.replace(
  /          <Button disabled title="Not available yet" className="h-9 px-4 rounded-none text-xs font-mono uppercase tracking-widest bg-foreground text-background gap-2 disabled:opacity-40">\r?\n            <Plus className="w-4 h-4" \/>\r?\n            Create Bug\r?\n          <\/Button>/,
  `          <Button onClick={() => setShowCreateBug(true)} className="h-9 px-4 rounded-none text-xs font-mono uppercase tracking-widest bg-foreground text-background gap-2">\r\n            <Plus className="w-4 h-4" />\r\n            Create Bug\r\n          </Button>`
);

fs.writeFileSync(file, c);
console.log('onClick Create Bug:', c.includes('onClick={() => setShowCreateBug(true)}'));
console.log('onClick Test Plan:', c.includes('onClick={() => setShowCreateTestPlan(true)}'));
console.log('onClick Security:', c.includes('onClick={() => setShowSecurityReview(true)}'));
console.log('No disabled:', !c.includes('disabled title="Not available yet"'));
