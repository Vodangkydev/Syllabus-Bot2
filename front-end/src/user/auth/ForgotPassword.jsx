import { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../../firebase";
import { useNavigate } from "react-router-dom";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleReset = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");

    try {
      await sendPasswordResetEmail(auth, email);
      setMessage("✅ Đã gửi email khôi phục mật khẩu. Vui lòng kiểm tra hộp thư.");
    } catch (err) {
      if (err.code === "auth/user-not-found") {
        setError("❌ Không tìm thấy người dùng với email này.");
      } else {
        setError("Lỗi: " + err.message);
      }
    }
  };

  return (
    <div className="relative flex items-center justify-center min-h-screen bg-[#F9F9F9] transition-colors duration-300">
      {/* Thay logo bằng chữ */}
      <div className="absolute top-8 left-16 z-10 text-2xl font-bold text-red-600 select-none">Syllabus-Bot</div>
      {/* Nút đóng với icon X */}
      <button
        className="absolute top-5 right-5 text-3xl text-gray-500 hover:text-red-500 transition-colors duration-300"
        title="Quay lại Chat"
        onClick={() => navigate("/")}
      >
        <svg
          stroke="currentColor"
          fill="currentColor"
          strokeWidth="0"
          viewBox="0 0 512 512"
          height="1em"
          width="1em"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="m289.94 256 95-95A24 24 0 0 0 351 127l-95 95-95-95a24 24 0 0 0-34 34l95 95-95 95a24 24 0 1 0 34 34l95-95 95 95a24 24 0 0 0 34-34z"></path>
        </svg>
      </button>

      <div className="w-[350px] p-8 rounded-xl shadow-lg bg-[#FFFFFF] text-black transition-colors duration-300 space-y-6">
        <h2 className="text-2xl text-center font-semibold text-gray-800 mb-6">Quên mật khẩu</h2>

        <form onSubmit={handleReset} className="space-y-6">
          <div className="space-y-4">
            <input
              type="email"
              placeholder="Nhập email của bạn"
              className="input input-bordered w-full bg-white border-gray-300 text-black py-3 px-4 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-normal"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full py-3 px-4 text-white font-semibold rounded-md shadow-md bg-blue-500 hover:bg-blue-600 focus:ring-2 focus:ring-blue-400 transition-all"
          >
            Gửi email khôi phục
          </button>
        </form>

        {message && <p className="text-green-500 text-sm text-center mt-4">{message}</p>}
        {error && <p className="text-red-500 text-sm text-center mt-4">{error}</p>}

        <div className="text-center mt-4">
          <button
            onClick={() => navigate("/login")}
            className="text-blue-500 hover:underline"
          >
            Quay lại đăng nhập
          </button>
        </div>
      </div>
    </div>
  );
}

export default ForgotPassword; 