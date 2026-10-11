import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/global.css';
import { EditorGate } from './EditorGate';
import './editor.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element ontbreekt.');
}

createRoot(rootElement).render(
  <StrictMode>
    <EditorGate />
  </StrictMode>,
);
