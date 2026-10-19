// Zips dist/ for the Chrome Web Store: release/bookmark-assistant-<version>.zip, with
// manifest.json at the top of the zip. Run through `npm run package`, which builds first.
//
// Writes the zip itself with Node's zlib instead of calling `tar`: which `tar` runs depends on
// the shell (Git Bash's GNU tar silently writes a tar archive with a .zip name).
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { crc32, deflateRawSync } from 'node:zlib';

const { version, host_permissions } = JSON.parse(readFileSync('dist/manifest.json', 'utf8'));
if (host_permissions) throw new Error('dist/ looks like the test build (site access granted at install). Run `npm run build`.');

/** Every file under dir, as paths relative to it with forward slashes. */
const files = (dir, prefix = '') =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path, `${prefix}${name}/`) : [`${prefix}${name}`];
  });

const local = [];
const central = [];
let offset = 0;
for (const name of files('dist')) {
  const data = readFileSync(join('dist', name));
  const packed = deflateRawSync(data, { level: 9 });
  const nameBytes = Buffer.from(name, 'utf8');
  const crc = crc32(data);

  // Local file header, then the deflated data.
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0); // signature
  header.writeUInt16LE(20, 4); // version needed: 2.0
  header.writeUInt16LE(0x0800, 6); // flags: UTF-8 names
  header.writeUInt16LE(8, 8); // method: deflate
  header.writeUInt32LE(0x00210000, 10); // time 00:00, date 1980-01-01 (fixed, so builds are repeatable)
  header.writeUInt32LE(crc, 14);
  header.writeUInt32LE(packed.length, 18);
  header.writeUInt32LE(data.length, 22);
  header.writeUInt16LE(nameBytes.length, 26);
  local.push(header, nameBytes, packed);

  const entry = Buffer.alloc(46);
  entry.writeUInt32LE(0x02014b50, 0); // signature
  entry.writeUInt16LE(20, 4); // version made by
  entry.writeUInt16LE(20, 6); // version needed
  entry.writeUInt16LE(0x0800, 8);
  entry.writeUInt16LE(8, 10);
  entry.writeUInt32LE(0x00210000, 12);
  entry.writeUInt32LE(crc, 16);
  entry.writeUInt32LE(packed.length, 20);
  entry.writeUInt32LE(data.length, 24);
  entry.writeUInt16LE(nameBytes.length, 28);
  entry.writeUInt32LE(offset, 42); // where the local header starts
  central.push(entry, nameBytes);

  offset += header.length + nameBytes.length + packed.length;
}

const directory = Buffer.concat(central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); // end-of-central-directory signature
end.writeUInt16LE(central.length / 2, 8); // entries on this disk
end.writeUInt16LE(central.length / 2, 10); // entries in total
end.writeUInt32LE(directory.length, 12);
end.writeUInt32LE(offset, 16); // where the central directory starts

const zip = Buffer.concat([...local, directory, end]);
if (zip.readUInt32LE(0) !== 0x04034b50) throw new Error('The package is not a zip file.');

const out = `release/bookmark-assistant-${version}.zip`;
mkdirSync('release', { recursive: true });
writeFileSync(out, zip);
console.log(`Wrote ${out} (${central.length / 2} files)`);
