export function withBaseUrl(path: string): string {
  const base = import.meta.env.BASE_URL || '/';
  const prefix = base.endsWith('/') ? base.slice(0, -1) : base;
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${prefix}${suffix}`;
}
