import path from 'node:path';

export function resolveAsset(requestUrl: string, root: string): string | null {
  try {
    const url = new URL(requestUrl);
    if (url.protocol !== 'app:' || url.host !== 'auction' || url.username || url.password) return null;
    const pathname = decodeURIComponent(url.pathname);
    if (pathname.includes('\\') || pathname.includes('\0') || pathname.includes(':')) return null;
    const file = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    const relative = path.relative(root, file);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return null;
    return file;
  } catch {
    return null;
  }
}
