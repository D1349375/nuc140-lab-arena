import { build } from 'esbuild';
import { copyFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(root, 'web/assets/editor');
await mkdir(output, { recursive: true });
await build({
  absWorkingDir: root,
  entryPoints: ['web/editor.js'],
  outfile: resolve(output, 'editor.js'),
  bundle: true,
  minify: true,
  format: 'iife',
  globalName: 'ArenaEditor',
  target: ['es2022'],
  loader: { '.ttf': 'file' },
  assetNames: '[name]-[hash]',
  legalComments: 'linked',
  logLevel: 'info',
});
await build({
  absWorkingDir: root,
  entryPoints: ['node_modules/monaco-editor/esm/vs/editor/editor.worker.js'],
  outfile: resolve(output, 'editor.worker.js'),
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2022'],
  legalComments: 'linked',
  logLevel: 'info',
});
await copyFile(resolve(root, 'node_modules/monaco-editor/esm/vs/nls/lang/zh-tw.js'), resolve(output, 'zh-tw.js'));
await copyFile(resolve(root, 'node_modules/monaco-editor/LICENSE'), resolve(output, 'LICENSE.txt'));
