import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dryRun = process.argv.includes('--dry-run');
const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = join(scriptDir, '..');
const packagePath = join(root, 'package.json');
const packageLockPath = join(root, 'package-lock.json');
const tauriConfigPath = join(root, 'src-tauri', 'tauri.conf.json');

async function readJson(path) {
  const content = await readFile(path, 'utf8');
  return JSON.parse(content.replace(/^\uFEFF/, ''));
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

const tauriConfig = await readJson(tauriConfigPath);
const versionMatch = /^(\d+)\.(\d+)\.(\d+)$/.exec(tauriConfig.version);
if (!versionMatch) {
  throw new Error(`Tauri version must be numeric semver, got "${tauriConfig.version}".`);
}

const [, major, minor, patch] = versionMatch;
const nextVersion = `${major}.${minor}.${Number(patch) + 1}`;

if (!dryRun) {
  const packageJson = await readJson(packagePath);
  packageJson.version = nextVersion;
  await writeJson(packagePath, packageJson);

  const packageLock = await readJson(packageLockPath);
  packageLock.version = nextVersion;
  packageLock.packages ??= {};
  packageLock.packages[''] ??= {};
  packageLock.packages[''].version = nextVersion;
  await writeJson(packageLockPath, packageLock);

  tauriConfig.version = nextVersion;
  await writeJson(tauriConfigPath, tauriConfig);
}

console.log(nextVersion);
