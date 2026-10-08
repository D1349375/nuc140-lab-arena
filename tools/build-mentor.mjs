import { build } from 'esbuild';
import { copyFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(root, 'web/assets/mentor');
await mkdir(output, { recursive: true });
await build({
  absWorkingDir: root,
  entryPoints: ['web/mentor.js'],
  outfile: resolve(output, 'mentor.js'),
  bundle: true, minify: true, format: 'iife', globalName: 'MentorMarkdown',
  target: ['es2022'],
  loader: { '.woff2': 'file', '.woff': 'file', '.ttf': 'file' },
  assetNames: 'fonts/[name]-[hash]', legalComments: 'linked', logLevel: 'info',
});
for (const [name, license] of [['marked', 'LICENSE'], ['dompurify', 'LICENSE'], ['katex', 'LICENSE']]) {
  await copyFile(resolve(root, 'node_modules', name, license), resolve(output, name + '-LICENSE.txt'));
}
await copyFile(resolve(root, 'node_modules/dompurify/LICENSE-MPL'), resolve(output, 'dompurify-LICENSE-MPL.txt'));
