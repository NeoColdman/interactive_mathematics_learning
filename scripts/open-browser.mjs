import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export function localUrl(port = process.env.PORT || '3210') {
  const number = Number(port);
  if (!Number.isInteger(number) || number < 1 || number > 65535) {
    throw new Error('PORT 必须是 1 到 65535 之间的整数。');
  }
  return `http://127.0.0.1:${number}/`;
}

export async function waitForServer(url, { timeoutMs = 20000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(new URL('api/bootstrap', url), {
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data.modules) && Array.isArray(data.profiles)) return true;
      }
    } catch {
      // The foreground server may still be loading its local records.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

export function openBrowser(url, platform = process.platform) {
  let child;
  if (platform === 'darwin') {
    child = spawn('open', [url], { detached: true, stdio: 'ignore' });
  } else if (platform === 'win32') {
    child = spawn('cmd.exe', ['/d', '/c', 'start', '', url], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
  } else {
    child = spawn('xdg-open', [url], { detached: true, stdio: 'ignore' });
  }
  child.on('error', () => {
    // The address remains visible in the server window if no browser can open.
  });
  child.unref();
}

export async function main() {
  if (process.env.MATH_NO_BROWSER === '1') return;
  const url = localUrl();
  if (await waitForServer(url)) openBrowser(url);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => {
    // Browser opening is optional; the foreground server prints its address.
  });
}
