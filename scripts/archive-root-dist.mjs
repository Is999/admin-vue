import { spawnSync } from 'node:child_process';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const appDistDir = path.join(rootDir, 'apps/web-antd/dist');
const rootDistDir = path.join(rootDir, 'dist');
const rootZipPath = path.join(rootDir, 'dist.zip');

async function assertAppDistExists() {
  const stat = await fsp.stat(appDistDir).catch(() => null);

  if (!stat?.isDirectory()) {
    throw new Error(`App dist directory does not exist: ${appDistDir}`);
  }
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    encoding: 'utf8',
    stdio: 'pipe',
  });

  if (result.status === 0) {
    return true;
  }

  if (result.error?.code === 'ENOENT') {
    return false;
  }

  throw new Error(
    [
      `Command failed: ${command} ${args.join(' ')}`,
      result.stdout,
      result.stderr,
    ]
      .filter(Boolean)
      .join('\n'),
  );
}

await assertAppDistExists();
await fsp.rm(rootDistDir, { force: true, recursive: true });
await fsp.cp(appDistDir, rootDistDir, { recursive: true });
await fsp.rm(rootZipPath, { force: true });

const zippedByZip = run('zip', ['-qr', 'dist.zip', 'dist']);

if (!zippedByZip) {
  const pythonScript = `
import os
import zipfile
root = ${JSON.stringify(rootDir)}
dist = os.path.join(root, 'dist')
out = os.path.join(root, 'dist.zip')
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as zf:
    for base, _, files in os.walk(dist):
        for name in files:
            path = os.path.join(base, name)
            zf.write(path, os.path.relpath(path, root))
`;

  const zippedByPython = run('python3', ['-c', pythonScript]);

  if (!zippedByPython) {
    throw new Error('Neither zip nor python3 is available to create dist.zip');
  }
}

const stat = await fsp.stat(rootZipPath);
console.log(`Root dist synchronized: ${rootDistDir}`);
console.log(`ZIP file created: ${rootZipPath} (${stat.size} total bytes)`);
