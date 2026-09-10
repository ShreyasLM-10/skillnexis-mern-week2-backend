/* Pre-push security check. Run from the repo root:  npm run security
 *
 *  1. Git hygiene  - .env files are ignored and never tracked, node_modules not committed
 *  2. Secret scan  - looks for credentials / tokens / keys in files that would be pushed
 *  3. npm audit    - known vulnerabilities in every project's dependencies
 *  4. ESLint       - static analysis incl. eslint-plugin-security
 *  5. gitleaks     - deep secret scan of the whole git history (if installed)
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { spawnNpm } = require('./spawn-npm');

const ROOT = path.join(__dirname, '..');
const PROJECTS = ['01-todo-api', '02-user-auth-api', '03-notes-app-backend'];

const results = [];
const report = (ok, title, detail = '') => {
  results.push(ok);
  console.log(`${ok ? '\u2714 PASS' : '\u2716 FAIL'}  ${title}${!ok && detail ? `\n        ${detail}` : ''}`);
};
// ".env", ".env.local", ".env.production"... but not the ".env.example" template
const isEnvFile = (file) => {
  const name = path.basename(file);
  return (name === '.env' || name.startsWith('.env.')) && name !== '.env.example';
};
// git and gitleaks are real executables, so no shell is ever needed.
const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', ...opts });

// ---------------------------------------------------------------- 1. git hygiene
const inGit = run('git', ['rev-parse', '--is-inside-work-tree']).stdout?.trim() === 'true';
let files;

if (inGit) {
  const tracked = run('git', ['ls-files']).stdout.split('\n').filter(Boolean);
  const envTracked = tracked.filter(isEnvFile);
  report(envTracked.length === 0, 'No .env files are tracked by git', envTracked.join(', '));

  const modules = tracked.filter((f) => f.includes('node_modules/'));
  report(modules.length === 0, 'node_modules is not committed', modules.slice(0, 3).join(', '));

  const notIgnored = PROJECTS.filter((p) => run('git', ['check-ignore', '-q', `${p}/.env`]).status !== 0);
  report(notIgnored.length === 0, '.gitignore ignores every project .env file', notIgnored.join(', '));

  // Everything that would be pushed: tracked + untracked-but-not-ignored files
  files = run('git', ['ls-files', '--cached', '--others', '--exclude-standard']).stdout.split('\n').filter(Boolean);
} else {
  console.log('\u2139 Not a git repository yet - skipping git checks (run "git init" first to enable them).');
  const walk = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      if (['node_modules', '.git'].includes(entry.name) || isEnvFile(entry.name)) return [];
      const full = path.join(dir, entry.name);
      return entry.isDirectory() ? walk(full) : [path.relative(ROOT, full)];
    });
  files = walk(ROOT);
}

// ---------------------------------------------------------------- 2. secret scan
const SECRET_PATTERNS = [
  ['MongoDB URI with username:password', /mongodb(?:\+srv)?:\/\/[^\s:@/<>]+:[^\s@/<>]+@/],
  // [ \t] instead of \s so an empty `JWT_SECRET=` line doesn't match the next line
  ['Hard-coded JWT_SECRET value', /^[ \t]*JWT_SECRET[ \t]*=[ \t]*[^\s#]+/m],
  ['Private key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{36,}\b/],
  ['JSON Web Token', /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
];
const findings = [];
for (const file of files) {
  if (/\.(png|jpe?g|gif|ico|pdf|zip)$/i.test(file) || file.endsWith('package-lock.json')) continue;
  let text;
  try {
    text = fs.readFileSync(path.join(ROOT, file), 'utf8');
  } catch {
    continue; // deleted or unreadable file
  }
  for (const [label, pattern] of SECRET_PATTERNS) {
    if (pattern.test(text)) findings.push(`${file}: ${label}`);
  }
}
report(findings.length === 0, `No secrets found in ${files.length} files that would be pushed`, findings.join('\n        '));

// ---------------------------------------------------------------- 3. npm audit
for (const dir of ['.', ...PROJECTS]) {
  const cwd = path.join(ROOT, dir);
  if (!fs.existsSync(path.join(cwd, 'node_modules'))) {
    report(false, `npm audit (${dir})`, 'dependencies not installed - run "npm install" / "npm run setup" first');
    continue;
  }
  const out = spawnNpm(['audit', '--json'], { cwd, encoding: 'utf8' });
  try {
    const counts = JSON.parse(out.stdout).metadata.vulnerabilities;
    const total = Object.values(counts).reduce((a, b) => a + b, 0) - (counts.total ?? 0);
    const summary = Object.entries(counts).filter(([k, v]) => k !== 'total' && v > 0).map(([k, v]) => `${v} ${k}`).join(', ');
    report(total === 0, `npm audit (${dir === '.' ? 'root dev tools' : dir}): ${total} vulnerabilities`, summary);
  } catch {
    report(false, `npm audit (${dir})`, 'could not run npm audit (are you online?)');
  }
}

// ---------------------------------------------------------------- 4. ESLint
// Run ESLint's own CLI file with Node (no npx, no shell).
let eslintCli;
try {
  const pkgPath = require.resolve('eslint/package.json', { paths: [ROOT] });
  eslintCli = path.join(path.dirname(pkgPath), JSON.parse(fs.readFileSync(pkgPath, 'utf8')).bin.eslint);
} catch {
  eslintCli = null;
}
if (eslintCli) {
  const lint = run(process.execPath, [eslintCli, '.', '--max-warnings=0']);
  report(lint.status === 0, 'ESLint + eslint-plugin-security: no problems', (lint.stdout + lint.stderr).trim().split('\n').slice(0, 8).join('\n        '));
} else {
  report(false, 'ESLint', 'not installed - run "npm install" in the repo root first');
}

// ---------------------------------------------------------------- 5. gitleaks (optional)
const gitleaks = run('gitleaks', ['version']);
if (gitleaks.status === 0 && inGit) {
  const scan = run('gitleaks', ['git', '--redact', '--no-banner', '.']);
  report(scan.status === 0, 'gitleaks: no leaks in git history', (scan.stdout + scan.stderr).trim().split('\n').slice(-3).join('\n        '));
} else {
  console.log('\u2139 gitleaks not installed or no git repo - optional deep scan skipped (https://github.com/gitleaks/gitleaks).');
}

// ---------------------------------------------------------------- summary
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed.`);
if (failed) {
  console.log('Fix the failures above before pushing to GitHub.');
  process.exit(1);
}
console.log('Safe to push.');
