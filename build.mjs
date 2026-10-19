import { build } from 'esbuild';
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';

/**
 * `node build.mjs` builds the extension into dist/.
 * `node build.mjs --test` builds dist-test/, identical except that site access is granted at
 * install: Chrome's permission prompt is a native dialog automated tests can't click.
 */
const testBuild = process.argv.includes('--test');
const out = testBuild ? 'dist-test' : 'dist';

await rm(out, { recursive: true, force: true });
await mkdir(`${out}/icons`, { recursive: true });
await build({
  entryPoints: ['src/background.ts', 'src/content.ts', 'src/grant.ts'],
  outdir: out,
  bundle: true,
  format: 'esm',
  target: 'chrome120',
  logLevel: testBuild ? 'warning' : 'info',
});

// The panel runs on every Google country site (google.co.uk, google.de, …). Match patterns
// can't wildcard a top-level domain, so the list comes from https://www.google.com/supported_domains.
const manifest = JSON.parse(await readFile('src/manifest.json', 'utf8'));
const domains = JSON.parse(await readFile('src/google-domains.json', 'utf8'));
manifest.content_scripts[0].matches = domains.map((d) => `https://www.${d}/search*`);
if (testBuild) manifest.host_permissions = manifest.optional_host_permissions;
await writeFile(`${out}/manifest.json`, JSON.stringify(manifest, null, 2));

await copyFile('src/grant.html', `${out}/grant.html`);
for (const size of [16, 32, 48, 128]) await copyFile(`src/icons/icon-${size}.png`, `${out}/icons/icon-${size}.png`);
