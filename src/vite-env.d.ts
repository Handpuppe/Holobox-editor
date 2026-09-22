/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface HoloboxFilePickerType {
  description?: string;
  accept: Record<string, string[]>;
}

interface Window {
  showSaveFilePicker?: (options?: {
    suggestedName?: string;
    types?: HoloboxFilePickerType[];
  }) => Promise<FileSystemFileHandle>;
  showOpenFilePicker?: (options?: {
    multiple?: boolean;
    types?: HoloboxFilePickerType[];
  }) => Promise<FileSystemFileHandle[]>;
}
