import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

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
