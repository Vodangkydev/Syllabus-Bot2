import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Override fetch toàn cục để auto thêm ngrok-skip-browser-warning header nếu cần
import fetchWithNgrokHeader from './utils/fetchWithNgrokHeader';
window.fetch = fetchWithNgrokHeader;

// Set initial theme
document.documentElement.setAttribute('data-theme', 'dark');

const root = ReactDOM.createRoot(document.getElementById('root'));

if (import.meta.env.DEV) {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
  root.render(<App />);
}
