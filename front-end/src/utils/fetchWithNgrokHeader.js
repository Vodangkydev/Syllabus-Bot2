// src/utils/fetchWithNgrokHeader.js

const originalFetch = window.fetch;

export default function fetchWithNgrokHeader(input, init = {}) {
  let url = typeof input === "string" ? input : input.url;
  if (url.includes('ngrok-free.app')) {
    init.headers = {
      ...(init.headers || {}),
      'ngrok-skip-browser-warning': 'true'
    };
  }
  return originalFetch(input, init);
}
