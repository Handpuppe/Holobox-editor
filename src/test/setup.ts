import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { clearHeldEditorPassword } from '../editor/editorLock';
import { releasePackageMedia } from '../media/packageMedia';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  clearHeldEditorPassword();
  releasePackageMedia();
});
