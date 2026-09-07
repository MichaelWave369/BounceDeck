import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import './v02.css';

const runtime = window.bounceDeck?.libraryGet ? 'desktop' : 'web';
document.documentElement.dataset.bouncdeckRuntime = runtime;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
