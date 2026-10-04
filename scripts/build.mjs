import ncc from '@vercel/ncc';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const check = process.argv.includes('--check');
const { code, assets } = await ncc(path.join(root, 'src/index.js'), {
  cache: false,
  license: 'licenses.txt',
});
const files = { 'index.js': code, ...Object.fromEntries(
  Object.entries(assets).map(([name, asset]) => [name, asset.source]),
) };
const dist = path.join(root, 'dist');
if (check) {
  const actual = (await readdir(dist, { recursive: true, withFileTypes: true }))
    .filter(entry => entry.isFile())
    .map(entry => path.relative(dist, path.join(entry.parentPath, entry.name))).sort();
  if (JSON.stringify(actual) !== JSON.stringify(Object.keys(files).sort())) {
    throw new Error('Bundle file list differs; run npm run build.');
  }
}
for (const [name, content] of Object.entries(files)) {
  const target = path.join(dist, name);
  if (check) {
    if (!(await readFile(target)).equals(Buffer.from(content))) {
      throw new Error(`Stale bundle: dist/${name}; run npm run build.`);
    }
  } else {
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content);
  }
}
console.log(check ? 'Bundle matches source byte-for-byte.' : 'Built dist/.');
