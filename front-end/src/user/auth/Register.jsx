import { useState } from "react";
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification } from "firebase/auth";
import { auth, db } from "../../firebase";
import { useNavigate } from "react-router-dom";
import { doc, setDoc } from "firebase/firestore";

function Register() {
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [verificationSent, setVerificationSent] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setError(""); // Reset previous error

    if (password !== confirmPassword) {
      setError("Mật khẩu nhập lại không khớp");
      return;
    }

    if (password.length < 6) {
      setError("Mật khẩu phải có ít nhất 6 ký tự.");
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

      // Update profile with full name
      await updateProfile(userCredential.user, {
        displayName: fullName,
      });

      // Send email verification
      await sendEmailVerification(userCredential.user);

      // Create user document in Firestore
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        email: email,
        fullName: fullName,
        createdAt: new Date().toISOString(),
        emailVerified: false
      });

      // Sign out the user after registration
      await auth.signOut();
      
      setVerificationSent(true);
    } catch (err) {
      console.error("Registration error:", err);
      if (err.code === 'auth/email-already-in-use') {
        setError('Email này đã đăng ký, vui lòng đăng nhập');
      } else {
        setError("Lỗi: " + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  if (verificationSent) {
    return (
      <div className="relative flex items-center justify-center min-h-screen bg-[#F9F9F9] transition-colors duration-300">
        <div className="absolute top-8 left-16 z-10 text-2xl font-bold text-red-600 select-none">Syllabus-Bot</div>
        <div className="w-[350px] p-8 rounded-xl shadow-lg bg-[#FFFFFF] text-black transition-colors duration-300 space-y-6">
          <h2 className="text-2xl text-center font-semibold text-gray-800 mb-6">Xác thực email</h2>
          <p className="text-center text-gray-600">
            Chúng tôi đã gửi một email xác thực đến {email}. 
            Vui lòng kiểm tra hộp thư của bạn và nhấp vào liên kết xác thực để hoàn tất đăng ký.
          </p>
          <button
            onClick={() => navigate("/login")}
            className="btn btn-primary w-full py-3 px-4 text-white font-semibold rounded-md shadow-md bg-blue-500 hover:bg-blue-600 focus:ring-2 focus:ring-blue-400 transition-all"
          >
            Đi đến trang đăng nhập
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex items-center justify-center min-h-screen bg-[#F9F9F9] transition-colors duration-300">
      {/* Thay logo bằng chữ */}
      <div className="absolute top-8 left-16 z-10 text-2xl font-bold text-red-600 select-none">Syllabus-Bot</div>
      <div className="w-[350px] p-8 rounded-xl shadow-lg bg-[#FFFFFF] text-black transition-colors duration-300 space-y-6">
        
        {/* Close button (X icon) to go back to chat */}
        <button
          onClick={() => navigate("/")}
          className="absolute top-5 right-5 text-3xl text-gray-500 hover:text-red-500 transition-colors duration-300"
          title="Quay lại Chat"
        >
          <svg
            stroke="currentColor"
            fill="currentColor"
            stroke-width="0"
            viewBox="0 0 512 512"
            height="1em"
            width="1em"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="m289.94 256 95-95A24 24 0 0 0 351 127l-95 95-95-95a24 24 0 0 0-34 34l95 95-95 95a24 24 0 1 0 34 34l95-95 95 95a24 24 0 0 0 34-34z"></path>
          </svg>
        </button>

        <h2 className="text-2xl text-center font-semibold text-gray-800 mb-6">Đăng ký</h2>

        <form onSubmit={handleRegister} className="space-y-6">
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Họ và tên"
              className="input input-bordered w-full bg-white border-gray-300 text-black py-3 px-4 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-normal"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
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
            <input
              type="password"
              placeholder="Nhập lại mật khẩu"
              className="input input-bordered w-full bg-white border-gray-300 text-black py-3 px-4 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-normal"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
            <input
              type="email"
              placeholder="Email"
              className="input input-bordered w-full bg-white border-gray-300 text-black py-3 px-4 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-normal"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full py-3 px-4 text-white font-semibold rounded-md shadow-md bg-blue-500 hover:bg-blue-600 focus:ring-2 focus:ring-blue-400 transition-all"
            disabled={loading}
          >
            {loading ? "Đang đăng ký..." : "Đăng ký"}
          </button>
        </form>

        {error && <p className="text-red-500 text-sm text-center mt-4">{error}</p>}

        <p className="text-sm text-center text-gray-700 mt-4">
          Đã có tài khoản?{" "}
          <a className="text-blue-500 hover:underline" href="/login">
            Đăng nhập
          </a>
        </p>
      </div>
    </div>
  );
}

export default Register; 