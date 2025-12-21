import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { onAuthStateChanged, signInWithRedirect, GoogleAuthProvider } from "firebase/auth";
import { auth } from "../../firebase";

(function() {
  const originalSetTimeout = window.setTimeout;
  window.setTimeout = function(fn, delay, ...args) {
    // Reduce the Firebase auth event timeout from 8000ms to 2000ms
    if (delay === 8000) {
      delay = 2000;
    }
    return originalSetTimeout(fn, delay, ...args);
  };
})();

function WelcomeModal({ show, onClose, forceShow = false }) {
  const [userLoggedIn, setUserLoggedIn] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUserLoggedIn(!!user);
    });
    return () => unsubscribe();
  }, []);

  const excludedPaths = ["/login", "/register", "/forgot-password"];
  const isExcludedPath = excludedPaths.includes(location.pathname);

  if ((isExcludedPath && !forceShow) || !show || userLoggedIn) return null;

  const handleRedirect = (path) => {
    onClose();
    setTimeout(() => {
      navigate(path);
    }, 300);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md text-center space-y-6">
        <h2 className="text-2xl font-bold text-black">Chào mừng trở lại</h2>
        <p className="text-base text-gray-600">
          Đăng nhập hoặc đăng ký để nhận phản hồi thông minh hơn, để có thể lưu lại lịch sử trò chuyện.
        </p>

        <div className="flex gap-4 justify-center">
          <button
            onClick={() => handleRedirect("/login")}
            className="w-36 px-8 py-3 rounded-full bg-black text-white font-semibold border-2 border-black hover:bg-gray-800 hover:border-gray-800 transition-colors"
          >
            Đăng nhập
          </button>
          <button
            onClick={() => handleRedirect("/register")}
            className="w-36 px-8 py-3 rounded-full bg-transparent text-blue-500 font-semibold border-2 border-blue-500 hover:bg-blue-500 hover:text-white transition-colors outline outline-2 outline-blue-500"
          >
            Đăng ký
          </button>
        </div>

        <button
          onClick={() => handleRedirect("/chat")}
          className="text-base text-blue-600 underline mt-4"
        >
          Tiếp tục trạng thái đăng xuất
        </button>
      </div>
    </div>
  );
}

export default WelcomeModal;
 