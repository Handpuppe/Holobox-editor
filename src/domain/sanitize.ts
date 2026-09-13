const TAGS = /<\/?[^>]+>/g;

function stripControlChars(value: string): string {
  let result = '';
  for (const char of value) {
    const code = char.charCodeAt(0);
    const isControl = code <= 31 || code === 127;
    const allowedWhitespace = char === '\n' || char === '\t';
    if (isControl && !allowedWhitespace) {
      continue;
    }
    result += char;
  }
  return result;
}

export function sanitizeInput(value: string, maxLength: number): string {
  return stripControlChars(value).replace(TAGS, '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

export function sanitizeMultiline(value: string, maxLength: number): string {
  return stripControlChars(value)
    .replace(TAGS, '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxLength);
}

export function hasRequiredText(value: string, minLength: number): boolean {
  return sanitizeInput(value, Number.MAX_SAFE_INTEGER).length >= minLength;
}
