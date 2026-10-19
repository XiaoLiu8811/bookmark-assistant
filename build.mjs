import { build } from 'esbuild';
import { copyFile, mkdir, rm } from 'node:fs/promises';

await rm('dist', { recursive: true, force: true });
await mkdir('dist');
await build({
  entryPoints: ['src/background.ts', 'src/content.ts'],
  outdir: 'dist',
  bundle: true,
  format: 'esm',
  target: 'chrome120',
  logLevel: 'info',
});
await copyFile('src/manifest.json', 'dist/manifest.json');
