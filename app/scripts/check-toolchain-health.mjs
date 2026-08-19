import { readFileSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const lockJson = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));

const requiredScripts = ['lint', 'build', 'test'];
const requiredPackages = [
  'vite',
  'eslint',
  'typescript',
  '@vitejs/plugin-react-swc',
  '@eslint/js'
];

const missingScripts = requiredScripts.filter((script) => !packageJson.scripts?.[script]);
if (missingScripts.length > 0) {
  console.error(`Missing required npm script(s): ${missingScripts.join(', ')}`);
  process.exit(1);
}

const lockPackages = lockJson.packages ?? {};
const missingLockEntries = requiredPackages.filter((pkg) => !lockPackages[`node_modules/${pkg}`]);
if (missingLockEntries.length > 0) {
  console.error(`Missing required lockfile package(s): ${missingLockEntries.join(', ')}`);
  process.exit(1);
}

console.log('Toolchain health check passed.');
