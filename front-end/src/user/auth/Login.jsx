import { useState, useEffect } from "react";
import { signInWithPopup, signInWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
import { auth, provider } from "../../firebase";
import { useNavigate } from "react-router-dom";
import { IoClose } from "react-icons/io5";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../../firebase";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showVerificationMessage, setShowVerificationMessage] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    let timer;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown((prev) => prev - 1);
      }, 1000);

      // Update the countdown within the existing error message if it's the too many requests error
      if (error && typeof error === 'object' && error.props && 
          error.props.children && Array.isArray(error.props.children) && 
          error.props.children[0].props.children === "Quá nhiều yêu cầu xác thực") {
         setError(
            <div className="text-center">
              <p className="text-red-600 font-medium">Quá nhiều yêu cầu xác thực</p>
              <p className="text-gray-600 mt-2">Vui lòng đợi {cooldown}s trước khi thử lại</p>
              {cooldown <= 20 && cooldown > 0 && (
                <p className="text-gray-600 mt-1">Trong thời gian chờ, hãy kiểm tra hộp thư của bạn</p>
              )}
            </div>
          );
      }

    } else if (cooldown === 0 && error && typeof error === 'object' && error.props && 
               error.props.children && Array.isArray(error.props.children) && 
               error.props.children[0].props.children === "Quá nhiều yêu cầu xác thực") {
        // Clear the specific too many requests error when cooldown reaches 0
        setError("");
    }

    return () => clearInterval(timer);
  }, [cooldown]); // Only depend on cooldown

  const handleGmailLogin = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      
      // Create or update user document in Firestore
      await setDoc(doc(db, 'users', result.user.uid), {
        email: result.user.email,
        fullName: result.user.displayName,
        createdAt: new Date().toISOString(),
        emailVerified: true  // Google accounts are pre-verified
      }, { merge: true });  // Use merge to update existing document if it exists
      
      navigate("/chat");
    } catch (error) {
      setError("Lỗi đăng nhập: " + error.message);
    }
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      if (!userCredential.user.emailVerified) {
        await sendEmailVerification(userCredential.user);
        setShowVerificationMessage(true);
        await auth.signOut();
        setSuccessMessage("✅ Email xác thực đã được gửi. Vui lòng kiểm tra hộp thư của bạn.");
        setError("");
        return;
      }
      
      navigate("/chat");
    } catch (err) {
      if (err.code === "auth/too-many-requests") {
        setCooldown(60); // Set 60 seconds cooldown
        // Set the detailed error message immediately
        setError(
          <div className="text-center">
            <p className="text-red-600 font-medium">Quá nhiều yêu cầu xác thực</p>
            <p className="text-gray-600 mt-2">Vui lòng đợi 60s trước khi thử lại</p>
            <p className="text-gray-600 mt-1">Trong thời gian chờ, hãy kiểm tra hộp thư của bạn</p>
          </div>
        );
      } else if (
        err.code === "auth/user-not-found" ||
        err.code === "auth/wrong-password" ||
        err.code === "auth/invalid-credential"
      ) {
        setError("Tài khoản hoặc mật khẩu không chính xác.");
      } else {
        setError("Lỗi: " + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (cooldown > 0) {
      // If cooldown is active, the error message is already displayed by useEffect.
      // Update the error message to show the current cooldown immediately if the user tries to resend again.
       setError(
         <div className="text-center">
           <p className="text-red-600 font-medium">Quá nhiều yêu cầu xác thực</p>
           <p className="text-gray-600 mt-2">Vui lòng đợi {cooldown}s trước khi thử lại</p>
           {cooldown <= 20 && cooldown > 0 && (
             <p className="text-gray-600 mt-1">Trong thời gian chờ, hãy kiểm thư mục spam.</p>
           )}
         </div>
       );
      return;
    }

    try {
      setLoading(true);
      setError("");
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(userCredential.user);
      await auth.signOut();
      setSuccessMessage("✅ Email xác thực mới đã được gửi. Vui lòng kiểm tra hộp thư của bạn.");
      setCooldown(60); // Set 60 seconds cooldown after successful send
    } catch (err) {
      console.error("Verification error in handleResendVerification:", err);
      if (err.code === "auth/too-many-requests") {
        setCooldown(60);
        // Set the detailed error message immediately
        setError(
          <div className="text-center">
            <p className="text-red-600 font-medium">Quá nhiều yêu cầu xác thực</p>
            <p className="text-gray-600 mt-2">Vui lòng đợi 60s trước khi thử lại</p>
            <p className="text-gray-600 mt-1">Trong thời gian chờ, hãy kiểm tra hộp thư của bạn</p>
          </div>
        );
      } else if (err.code === "auth/invalid-credential" || err.code === "auth/user-not-found") {
        setError("Email hoặc mật khẩu không chính xác.");
      } else if (err.code === "auth/network-request-failed") {
        setError("Lỗi kết nối. Vui lòng kiểm tra lại kết nối mạng của bạn.");
      } else if (err.code === "auth/operation-not-allowed") {
        setError("Tính năng xác thực email chưa được bật. Vui lòng liên hệ hỗ trợ.");
      } else {
        setError("Không thể gửi email xác thực. Vui lòng thử lại sau.");
      }
      setSuccessMessage("");
    } finally {
      setLoading(false);
    }
  };

  if (showVerificationMessage) {
    return (
      <div className="relative flex items-center justify-center min-h-screen bg-[#F9F9F9] transition-colors duration-300">
        <div className="absolute top-8 left-16 z-10 text-2xl font-bold text-red-600 select-none">Syllabus-Bot</div>
        {/* Nút quay lại trang chủ */}
        <button
          className="absolute top-5 right-5 text-3xl text-gray-500 hover:text-red-500 transition-colors duration-300"
          onClick={() => navigate("/")}
          title="Quay lại Trang chủ"
        >
          <IoClose />
        </button>
        <div className="w-[350px] p-8 rounded-xl shadow-lg bg-[#FFFFFF] text-black transition-colors duration-300 space-y-6">
          <h2 className="text-2xl text-center font-semibold text-gray-800 mb-6">Xác thực email</h2>
          
          {successMessage && (
            <div className="p-4 mb-4 text-sm text-green-700 bg-green-100 rounded-lg">
              {successMessage}
            </div>
          )}

          {error && (
            <div className="p-4 mb-4 text-sm text-red-700 bg-red-100 rounded-lg">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div className="text-center">
              <p className="text-lg font-medium text-gray-800 mb-3">
                Chào mừng bạn đến với Syllabus-Bot! 🎉
              </p>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-blue-800 font-medium mb-2">📧 Email xác thực đã được gửi đến {email}</p>
                <p className="text-blue-700 text-sm">
                  Vui lòng kiểm tra hộp thư email để xác nhận tài khoản
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => setShowVerificationMessage(false)}
              className="btn btn-primary w-full py-3 px-4 text-white font-semibold rounded-md shadow-md bg-blue-500 hover:bg-blue-600 focus:ring-2 focus:ring-blue-400 transition-all"
            >
              Quay lại đăng nhập
            </button>
            <button
              onClick={handleResendVerification}
              disabled={loading || cooldown > 0}
              className="btn btn-outline w-full py-3 px-4 text-blue-500 font-semibold rounded-md border-blue-500 border-2 hover:bg-blue-500 hover:text-white focus:ring-2 focus:ring-blue-400 transition-all disabled:cursor-not-allowed disabled:text-gray-400"
            >
              {loading ? "Đang gửi..." : cooldown > 0 ? `Đợi ${cooldown}s...` : "Gửi lại email xác thực"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex items-center justify-center min-h-screen bg-[#F9F9F9] transition-colors duration-300">
      {/* Thay logo bằng chữ */}
      <div className="absolute top-8 left-16 z-10 text-2xl font-bold text-red-600 select-none">Syllabus-Bot</div>
      {/* Nút quay lại trang chat */}
      <button
        className="absolute top-5 right-5 text-3xl text-gray-500 hover:text-red-500 transition-colors duration-300"
        onClick={() => navigate("/")}
        title="Quay lại Chat"
      >
        <IoClose />
      </button>

      {/* Box Login */}
      <div className="w-[350px] p-8 rounded-xl shadow-lg bg-[#FFFFFF] text-black transition-colors duration-300 space-y-6">
        <h2 className="text-2xl text-center font-semibold text-gray-800 mb-6">Đăng nhập</h2>

        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}

        <form onSubmit={handleEmailLogin} className="space-y-6">
          <div className="space-y-4">
            <input
              type="email"
              placeholder="Email"
              className="input input-bordered w-full bg-white border-gray-300 text-black py-3 px-4 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-normal"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Mật khẩu"
              className="input input-bordered w-full bg-white border-gray-300 text-black py-3 px-4 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-normal"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="flex items-center justify-between">
            <a href="/forgot-password" className="text-sm text-blue-600 hover:text-blue-800">
              Quên mật khẩu?
            </a>
            <a href="/register" className="text-sm text-blue-600 hover:text-blue-800">
              Đăng ký
            </a>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 text-white font-semibold rounded-md shadow-md bg-blue-500 hover:bg-blue-600 focus:ring-2 focus:ring-blue-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Hoặc</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGmailLogin}
            className="w-full py-3 px-4 text-gray-700 font-semibold rounded-md shadow-md bg-white border border-gray-300 hover:bg-gray-50 focus:ring-2 focus:ring-gray-400 transition-all flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Đăng nhập với Google
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login; 