declare module 'node:fs' {
  export function existsSync(path: string): boolean;
  export function mkdirSync(path: string, options?: { recursive?: boolean }): void;
  export function readFileSync(path: string, encoding: 'utf8'): string;
  export function readFileSync(path: string): Uint8Array;
  export function writeFileSync(path: string, data: string, encoding: 'utf8'): void;
  export function writeFileSync(path: string, data: Uint8Array): void;
  export function unlinkSync(path: string): void;
  export function readdirSync(path: string): string[];
  export function statSync(path: string): { isDirectory(): boolean; isFile(): boolean };
  export function rmSync(path: string, options?: { recursive?: boolean; force?: boolean }): void;
}

declare module 'node:os' {
  export function tmpdir(): string;
}

declare module 'node:path' {
  export function join(...paths: string[]): string;
}
