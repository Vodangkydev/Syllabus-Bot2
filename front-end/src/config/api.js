// API Configuration
// Sử dụng biến môi trường VITE_API_URL hoặc fallback về localhost
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default API_URL;

