const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'tests', 'integration');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.test.ts'));

const replacements = {
  'pm@apexfintech.test': 'admin@coopsetu.test',
  'dev@apexfintech.test': 'trainer@coopsetu.test',
  'qa@apexfintech.test': 'trainee@coopsetu.test',
  'owner@apexfintech.test': 'owner@coopsetu.test',
  'admin@apexfintech.test': 'super@coopsetu.test',
  'sec@apexfintech.test': 'employer@coopsetu.test',
  'tm@apexfintech.test': 'tm@coopsetu.test'
};

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  
  for (const [oldEmail, newEmail] of Object.entries(replacements)) {
    if (content.includes(oldEmail)) {
      content = content.replace(new RegExp(oldEmail, 'g'), newEmail);
      changed = true;
    }
  }
  
  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${file}`);
  }
}
