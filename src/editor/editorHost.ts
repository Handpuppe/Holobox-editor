/** Editor.exe en npm run dev draaien op deze machine. GitHub Pages niet. */
export function canSaveToThisCopy(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const host = window.location.hostname;
  return host === '127.0.0.1' || host === 'localhost';
}
