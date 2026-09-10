const { spawnSync } = require('node:child_process');

/**
 * Runs an npm command WITHOUT handing an argument list to a shell
 * (avoids Node's DEP0190 warning and any argument-injection risk).
 *
 * - Under `npm run ...`, npm exposes the path of its CLI in npm_execpath, so we
 *   start it directly with the current Node binary - no shell involved at all.
 * - Otherwise (plain `node scripts/...`): on Windows npm is a .cmd file that
 *   needs a shell, so the fixed command is passed as ONE string. Every caller
 *   only uses hard-coded arguments, never user input.
 */
function spawnNpm(args, options = {}) {
  const npmCli = process.env.npm_execpath;
  if (npmCli && /npm-cli\.js$/.test(npmCli)) {
    return spawnSync(process.execPath, [npmCli, ...args], options);
  }
  if (process.platform === 'win32') {
    return spawnSync(`npm ${args.join(' ')}`, { ...options, shell: true });
  }
  return spawnSync('npm', args, options);
}

module.exports = { spawnNpm };
