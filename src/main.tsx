import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.jsx';
import './index.css';

try {
  registerSW({ immediate: true });
} catch {}

createRoot(document.getElementById('root')!).render(<App />);

