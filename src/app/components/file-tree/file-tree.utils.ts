export function normalizePath(p: string): string {
  return p.replace(/\\/g, '/');
}

export function dirname(p: string): string {
  const path = normalizePath(p);
  const idx = path.lastIndexOf('/');
  return idx > 0 ? path.slice(0, idx) : '/';
}

export function basename(p: string): string {
  const path = normalizePath(p);
  const idx = path.lastIndexOf('/');
  return idx >= 0 ? path.slice(idx + 1) : path;
}

export function createId(p: string): string {
  // VS Code 也是直接用 path 作为 id
  return normalizePath(p);
}
