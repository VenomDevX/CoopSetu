const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'app/dashboard/qa-security/page.tsx');
let c = fs.readFileSync(file, 'utf-8');

// 1. Add modal imports after DataViewport import
c = c.replace(
  "import { DataViewport } from '@/components/layout/data-viewport';",
  `import { DataViewport } from '@/components/layout/data-viewport';
import { CreateBugModal } from '@/components/qa-security/create-bug-modal';
import { CreateTestPlanModal } from '@/components/qa-security/create-test-plan-modal';
import { StartSecurityReviewModal } from '@/components/qa-security/start-security-review-modal';`
);

// 2. Add modal state + refactor useEffect into fetchQAData
// Find the useEffect block and wrap it
c = c.replace(
  `  const [mockApprovals, setMockApprovals] = useState`,
  `  const [showCreateBug, setShowCreateBug] = useState(false);
  const [showCreateTestPlan, setShowCreateTestPlan] = useState(false);
  const [showSecurityReview, setShowSecurityReview] = useState(false);

  const [mockApprovals, setMockApprovals] = useState`
);

// Replace useEffect(() => { ... }, []) with fetchQAData pattern
c = c.replace(
  /  useEffect\(\(\) => \{\r?\n    let active = true;\r?\n([\s\S]*?)    return \(\) => \{ active = false; \};\r?\n  \}, \[\]\);/m,
  `  const fetchQAData = () => {
    let active = true;
$1    return () => { active = false; };
  };

  useEffect(() => fetchQAData(), []);`
);

// 3. Replace disabled buttons with working ones
c = c.replace(
  `<Button variant="outline" disabled title="Not available yet" className="h-9 px-4 rounded-none text-xs font-mono uppercase tracking-widest border-border text-foreground gap-2 disabled:opacity-40">
            <ShieldCheck className="w-4 h-4" />
            Start Security Review
          </Button>`,
  `<Button onClick={() => setShowSecurityReview(true)} variant="outline" className="h-9 px-4 rounded-none text-xs font-mono uppercase tracking-widest border-border text-foreground gap-2">
            <ShieldCheck className="w-4 h-4" />
            Start Security Review
          </Button>`
);

c = c.replace(
  `<Button variant="outline" disabled title="Not available yet" className="h-9 px-4 rounded-none text-xs font-mono uppercase tracking-widest border-border text-foreground gap-2 disabled:opacity-40">
            <FileCheck className="w-4 h-4" />
            Create Test Plan
          </Button>`,
  `<Button onClick={() => setShowCreateTestPlan(true)} variant="outline" className="h-9 px-4 rounded-none text-xs font-mono uppercase tracking-widest border-border text-foreground gap-2">
            <FileCheck className="w-4 h-4" />
            Create Test Plan
          </Button>`
);

c = c.replace(
  `<Button disabled title="Not available yet" className="h-9 px-4 rounded-none text-xs font-mono uppercase tracking-widest bg-foreground text-background gap-2 disabled:opacity-40">
            <Plus className="w-4 h-4" />
            Create Bug
          </Button>`,
  `<Button onClick={() => setShowCreateBug(true)} className="h-9 px-4 rounded-none text-xs font-mono uppercase tracking-widest bg-foreground text-background gap-2">
            <Plus className="w-4 h-4" />
            Create Bug
          </Button>`
);

// 4. Add modal rendering before closing </WorkspaceDataLayout>
c = c.replace(
  `    </WorkspaceDataLayout>`,
  `      {showCreateBug && <CreateBugModal onClose={() => setShowCreateBug(false)} onCreated={() => { setShowCreateBug(false); fetchQAData(); }} />}
      {showCreateTestPlan && <CreateTestPlanModal onClose={() => setShowCreateTestPlan(false)} onCreated={() => { setShowCreateTestPlan(false); fetchQAData(); }} />}
      {showSecurityReview && <StartSecurityReviewModal onClose={() => setShowSecurityReview(false)} onCreated={() => { setShowSecurityReview(false); fetchQAData(); }} />}
    </WorkspaceDataLayout>`
);

fs.writeFileSync(file, c);
console.log('Done. Verifying key markers...');
console.log('  setShowCreateBug:', c.includes('setShowCreateBug'));
console.log('  CreateBugModal import:', c.includes("from '@/components/qa-security/create-bug-modal'"));
console.log('  onClick Create Bug:', c.includes('onClick={() => setShowCreateBug(true)}'));
console.log('  fetchQAData:', c.includes('const fetchQAData'));
console.log('  No disabled buttons:', !c.includes('disabled title="Not available yet"'));
