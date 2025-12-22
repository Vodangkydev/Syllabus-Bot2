import { useRef, useState, useEffect } from "react";
import API_URL from '../../config/api';
import { IoClose, IoMailOutline } from "react-icons/io5";
import { useNavigate } from "react-router-dom";
import { getAuth } from "firebase/auth";

function IssuePage() {
  const form = useRef();
  const navigate = useNavigate();
  const auth = getAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackHistory, setFeedbackHistory] = useState([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);

  // Hàm kiểm tra thông báo mới nâng cấp
  const checkNewNotifications = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const response = await fetch(`${API_URL}/user/feedback/history`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Authorization": `Bearer ${await user.getIdToken()}`
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Lấy danh sách đã xem từ localStorage
        const seen = JSON.parse(localStorage.getItem('feedback_seen') || '[]');
        // Tạo map để so sánh nhanh
        const seenMap = {};
        seen.forEach(item => { seenMap[item.id] = item.status; });
        // Đếm số lượng góp ý mới hoặc trạng thái mới
        let newCount = 0;
        if (Array.isArray(data)) {
          data.forEach(fb => {
            if (!fb.id) return; // Bỏ qua nếu không có id
            if (!(fb.id in seenMap) || seenMap[fb.id] !== fb.status) {
              newCount++;
            }
          });
        }
        setUnreadCount(newCount);
      }
    } catch (error) {
      console.error("Lỗi khi kiểm tra thông báo:", error);
    }
  };

  // Kiểm tra thông báo mới mỗi 3 giây
  useEffect(() => {
    checkNewNotifications();
    const interval = setInterval(checkNewNotifications, 3000); // Kiểm tra mỗi 3 giây
    return () => clearInterval(interval);
  }, []);

  // Khi mở modal, lưu lại trạng thái đã xem vào localStorage
  const handleOpenHistory = async () => {
    await fetchFeedbackHistory();
    // Lưu danh sách feedback hiện tại vào localStorage
    const user = auth.currentUser;
    if (!user) return;
    try {
      const response = await fetch(`${API_URL}/user/feedback/history`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Authorization": `Bearer ${await user.getIdToken()}`
        },
      });
      if (response.ok) {
        const data = await response.json();
        // Lưu lại id và status
        const seen = Array.isArray(data) ? data.filter(fb => fb.id).map(fb => ({ id: fb.id, status: fb.status })) : [];
        localStorage.setItem('feedback_seen', JSON.stringify(seen));
        setUnreadCount(0);
      }
    } catch (error) {
      // Nếu lỗi vẫn reset badge
      setUnreadCount(0);
    }
  };

  // Toggle modal khi nhấn icon hộp thư
  const handleToggleHistory = async () => {
    if (showHistoryModal) {
      setShowHistoryModal(false);
    } else {
      await handleOpenHistory();
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'pending':
        return 'Đang xử lý';
      case 'reviewed':
        return 'Đã xem xét';
      case 'rejected':
        return 'Từ chối';
      case 'resolved':
        return 'Đã phản hồi';
      case 'approved':
        return 'Đã duyệt';
      default:
        return status;
    }
  };

  async function submitFeedback(e) {
    e.preventDefault();
    setIsSubmitting(true);

    const user = auth.currentUser;
    if (!user) {
      alert("Vui lòng đăng nhập để gửi góp ý");
      navigate("/login");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/user/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Authorization": `Bearer ${await user.getIdToken()}`
        },
        body: JSON.stringify({
          user_email: user.email,
          message: form.current.message.value,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Gửi góp ý thất bại");
      }

      const result = await response.json();
      console.log("Góp ý đã được gửi:", result);
      document.getElementById("success-modal").checked = true;
      form.current.reset();
    } catch (error) {
      console.error("Lỗi khi gửi góp ý:", error);
      alert(error.message || "Đã xảy ra lỗi khi gửi góp ý. Vui lòng thử lại sau.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function fetchFeedbackHistory() {
    setIsLoadingHistory(true);
    setHistoryError("");
    const user = auth.currentUser;
    if (!user) {
      alert("Vui lòng đăng nhập để xem lịch sử góp ý");
      navigate("/login");
      return;
    }
    try {
      const response = await fetch(`${API_URL}/user/feedback/history`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Authorization": `Bearer ${await user.getIdToken()}`
        },
      });
      if (!response.ok) {
        throw new Error("Không thể lấy lịch sử góp ý");
      }
      const data = await response.json();
      setFeedbackHistory(Array.isArray(data) ? data : []);
      setShowHistoryModal(true);
    } catch (err) {
      setHistoryError(err.message || "Đã xảy ra lỗi khi lấy lịch sử góp ý");
      setShowHistoryModal(true);
    } finally {
      setIsLoadingHistory(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative"
      style={{
        backgroundColor: document.documentElement.classList.contains('dark') ? '#171717' : '#F9F9F9',
        color: 'var(--text-primary)'
      }}
    >
      {/* Icons container */}
      <div className="absolute top-5 right-5 flex items-center gap-4 z-10">
        {/* Mailbox Icon with notification badge */}
        <button
          className="text-2xl text-gray-400 hover:text-blue-500 transition-colors duration-200 relative"
          title="Lịch sử góp ý"
          onClick={handleToggleHistory}
        >
          <IoMailOutline />
          {unreadCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </button>

        {/* Nút đóng */}
        <button
          className="text-2xl text-gray-400 hover:text-red-500 transition-colors duration-200"
          onClick={() => navigate("/chat")}
          title="Quay lại"
        >
          <IoClose />
        </button>
      </div>

      {/* Modal thành công */}
      <input type="checkbox" id="success-modal" className="modal-toggle" />
      <div className="modal">
        <div className="modal-box bg-white dark:bg-[#212121] text-black dark:text-white">
          <h3 className="font-bold text-lg">Gửi thành công 🎉</h3>
          <p className="py-4">
            Cảm ơn bạn đã gửi góp ý. Chúng tôi sẽ xem xét và cải thiện sản phẩm dựa trên phản hồi của bạn.
          </p>
          <div className="modal-action">
            <label htmlFor="success-modal" className="btn btn-success">
              Đóng
            </label>
          </div>
        </div>
      </div>

      {/* Modal lịch sử góp ý */}
      {showHistoryModal && (
        <div className="fixed top-16 right-5 z-50">
          <div className="bg-[#18181b] rounded-2xl shadow-2xl w-96 p-6 relative animate-fadeIn border border-gray-700">
            <button
              className="absolute top-3 right-3 text-xl text-gray-400 hover:text-red-500"
              onClick={() => setShowHistoryModal(false)}
              title="Đóng"
            >
              <IoClose />
            </button>
            <h2 className="text-lg font-bold mb-4 text-white flex items-center gap-2"><IoMailOutline /> Lịch sử góp ý</h2>
            {isLoadingHistory ? (
              <div className="text-center py-8 text-gray-400">Đang tải...</div>
            ) : historyError ? (
              <div className="text-center text-red-500 py-8">{historyError}</div>
            ) : feedbackHistory.length === 0 ? (
              <div className="text-center text-gray-400 py-8">Chưa có góp ý nào.</div>
            ) : (
              <div className="flex flex-col gap-3 max-h-80 overflow-y-auto">
                {feedbackHistory
                  .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                  .map((fb, idx) => (
                  <div key={idx} className="rounded-xl p-4 bg-[#23232b] shadow border border-gray-700 flex flex-col gap-1">
                    <div className="text-base text-white font-medium whitespace-pre-line mb-1">{fb.message}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold tracking-wide
                        ${fb.status === 'pending' ? 'bg-yellow-400/20 text-yellow-300 border border-yellow-400' :
                          fb.status === 'resolved' ? 'bg-green-400/20 text-green-300 border border-green-400' :
                          fb.status === 'reviewed' ? 'bg-blue-400/20 text-blue-300 border border-blue-400' :
                          fb.status === 'approved' ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400' :
                          fb.status === 'rejected' ? 'bg-gray-400/20 text-gray-300 border border-gray-400' :
                          'bg-gray-200/20 text-gray-300 border border-gray-400'}`}>{getStatusLabel(fb.status || 'Chưa xác định')}</span>
                      <span className="ml-auto text-xs text-gray-400 font-mono">
                        {fb.created_at ? (new Date(fb.created_at).toLocaleString('vi-VN', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        }) !== 'Invalid Date' ? new Date(fb.created_at).toLocaleString('vi-VN', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        }) : '') : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Form góp ý */}
      <div
        className="w-full max-w-xl rounded-3xl shadow-lg border px-10 py-8 flex flex-col items-center gap-4 relative animate-fadeIn"
        style={{
          backgroundColor: document.documentElement.classList.contains('dark') ? '#212121' : '#FFFFFF',
        
        }}
      >
        {/* Icon minh họa mới: chat/feedback */}
        <div className="mb-1 flex items-center justify-center w-14 h-14 rounded-full bg-indigo-50 dark:bg-indigo-900/20 shadow-sm">
          <svg width="32" height="32" fill="none" viewBox="0 0 24 24"><path fill="#6366f1" d="M2 21l1.65-4.95A8 8 0 1 1 12 20a7.96 7.96 0 0 1-3.95-1.02L2 21zm6.05-3.13c.9.38 1.88.63 2.95.63a6 6 0 1 0-6-6c0 1.07.25 2.05.63 2.95l.2.47-.7 2.1 2.1-.7.47.2z"/></svg>
        </div>
        <h1 className="text-2xl font-extrabold mb-1 text-center text-black dark:text-white tracking-tight">
          Góp ý với chúng tôi
        </h1>
        <p className="mb-1 text-center text-gray-600 dark:text-gray-300 text-base font-medium">
          Syllabus-Bot luôn trân trọng mọi ý kiến đóng góp của bạn để ngày càng hoàn thiện và phục vụ tốt hơn.
        </p>

        <form ref={form} onSubmit={submitFeedback} className="w-full flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="message" className="font-semibold text-gray-800 dark:text-gray-100 text-base">Nội dung góp ý <span className="text-red-500">*</span></label>
            <textarea
              id="message"
              name="message"
              placeholder="Nhập góp ý của bạn tại đây..."
              className="textarea textarea-bordered w-full min-h-[140px] max-h-56 text-base text-black dark:text-white dark:bg-[#18181b] bg-white rounded-xl border border-gray-300 dark:border-gray-700 focus:border-gray-400 focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-800 transition p-3 placeholder-gray-400 dark:placeholder-gray-500 shadow-sm"
              required
            ></textarea>
          </div>

          <button
            type="submit"
            className={`w-2/5 mx-auto py-2 rounded-lg font-bold text-base transition bg-[var(--button-bg)] text-[var(--button-text)] shadow-md hover:bg-[var(--button-hover)] focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-offset-2 active:scale-95 ${isSubmitting ? "opacity-70 cursor-not-allowed" : ""}`}
            disabled={isSubmitting}
            style={{
              color: document.documentElement.classList.contains('dark') ? 'var(--button-text)' : '#fff'
            }}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2 text-sm"><span className="loader border-t-2 border-white border-solid rounded-full w-4 h-4 animate-spin"></span> Đang gửi...</span>
            ) : (
              <span className="text-sm">GỬI GÓP Ý</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default IssuePage; 