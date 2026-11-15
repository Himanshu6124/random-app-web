import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles/main.css';
import './styles/mobile.css';
import './styles/motion.css';
import { initNativeShell } from './mobile/nativeShell';
import { initTapFeedback } from './mobile/feedback';

initNativeShell();
initTapFeedback();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
