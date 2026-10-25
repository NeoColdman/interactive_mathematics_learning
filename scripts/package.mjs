import { mkdir, readFile, readdir, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const sourceDirectories = new Set(['docs', 'domain', 'public', 'scripts', 'tests', 'vendor']);
const sourceFiles = new Set(['README.md', 'server.mjs', 'start.command', '启动学习.cmd', 'package.json', 'LICENSE', 'LICENSE.md']);
const ignoredDirectories = new Set(['.git', 'node_modules', '.cache', 'tmp', 'temp', 'coverage', 'test-results', 'playwright-report', '__pycache__']);

export async function collectFiles(root = projectRoot) {
  const files = [];
  async function walk(relative = '') {
    const entries = await readdir(path.join(root, relative), { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name, 'en'));
    for (const entry of entries) {
      if (entry.isSymbolicLink() || entry.name.startsWith('.')) continue;
      if (/\.(?:tmp|log|bak|zip|pyc)$/i.test(entry.name)) continue;
      const child = path.join(relative, entry.name);
      if (entry.isDirectory()) {
        if (ignoredDirectories.has(entry.name.toLowerCase())) continue;
        if (!relative && !sourceDirectories.has(entry.name)) continue;
        await walk(child);
      } else if (entry.isFile() && (relative || sourceFiles.has(entry.name))) {
        files.push(child);
      }
    }
  }
  await walk();
  return files;
}

const crcTable = Array.from({ length: 256 }, (_, number) => {
  let crc = number;
  for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  return crc >>> 0;
});

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date) {
  const year = Math.max(1980, Math.min(2107, date.getFullYear()));
  return {
    time: ((date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1)) >>> 0,
    date: (((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()) >>> 0,
  };
}

export async function buildZip(root, files) {
  if (files.length > 65535) throw new Error('源码文件数量超过当前打包器支持范围。');
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const relative of files) {
    const absolute = path.join(root, relative);
    const [bytes, details] = await Promise.all([readFile(absolute), stat(absolute)]);
    const name = Buffer.from(`interactive-math-learning/${relative.split(path.sep).join('/')}`, 'utf8');
    if (bytes.length > 0xffffffff || offset + bytes.length > 0xffffffff) throw new Error('源码包超过当前打包器支持大小。');
    const crc = crc32(bytes);
    const stamp = dosDateTime(details.mtime);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(stamp.time, 10);
    local.writeUInt16LE(stamp.date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(bytes.length, 18);
    local.writeUInt32LE(bytes.length, 22);
    local.writeUInt16LE(name.length, 26);
    localParts.push(local, name, bytes);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x0314, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(stamp.time, 12);
    central.writeUInt16LE(stamp.date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(bytes.length, 20);
    central.writeUInt32LE(bytes.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(((details.mode & 0xffff) << 16) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + bytes.length;
  }
  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

export async function main(args = process.argv.slice(2)) {
  const outputIndex = args.indexOf('--output');
  if (outputIndex !== -1 && !args[outputIndex + 1]) throw new Error('--output 后需要给出 zip 文件路径。');
  const output = path.resolve(outputIndex === -1
    ? path.join(projectRoot, 'dist', 'interactive-math-learning-offline-source.zip')
    : args[outputIndex + 1]);
  const files = await collectFiles();
  for (const required of ['server.mjs', 'start.command', '启动学习.cmd', 'scripts/open-browser.mjs']) {
    if (!files.includes(required)) throw new Error(`缺少运行文件：${required}。请先准备完整源码。`);
  }
  if (args.includes('--dry-run')) {
    console.log(files.map((file) => file.split(path.sep).join('/')).join('\n'));
    console.log(`共 ${files.length} 个源码文件；不包含学习记录、教材或运行时。`);
    return { files, output };
  }
  const zip = await buildZip(projectRoot, files);
  await mkdir(path.dirname(output), { recursive: true });
  const temporary = `${output}.tmp-${process.pid}`;
  await writeFile(temporary, zip);
  await rename(temporary, output);
  console.log(`已生成离线源码包：${output}`);
  console.log(`包含 ${files.length} 个文件；首次使用仍需准备 Node.js 22 或 24。`);
  return { files, output };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`打包未完成：${error.message}`);
    process.exitCode = 1;
  });
}
