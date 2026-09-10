// Runs the same npm command in every project folder.
//   node scripts/run-all.js install   -> npm ci   (exact versions from package-lock.json)
//   node scripts/run-all.js test      -> npm test
const path = require('node:path');
const { spawnNpm } = require('./spawn-npm');

const PROJECTS = ['01-todo-api', '02-user-auth-api', '03-notes-app-backend'];
const COMMANDS = { install: ['ci'], test: ['test'] };

const args = COMMANDS[process.argv[2]];
if (!args) {
  console.error('Usage: node scripts/run-all.js <install|test>');
  process.exit(1);
}

const failed = [];
for (const project of PROJECTS) {
  console.log(`\n=== ${project}: npm ${args.join(' ')} ===`);
  const result = spawnNpm(args, { cwd: path.join(__dirname, '..', project), stdio: 'inherit' });
  if (result.status !== 0) failed.push(project);
}

if (failed.length) {
  console.error(`\nFailed in: ${failed.join(', ')}`);
  process.exit(1);
}
console.log('\nAll projects OK');
