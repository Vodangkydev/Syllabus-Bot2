import React, { useState, useRef, useEffect } from "react";
import { FiX } from "react-icons/fi";
import "../../styles/Settings.css";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { useChatHistory } from "../../hooks/useChatHistory";
import { deleteAllChats, deleteCurrentUser } from "../../firebase";
import ArchiveChatsModal from "../../components/ArchiveChatsModal";

const Settings = ({ onClose, onSelectArchivedChat }) => {
  const [showConfirmLogout, setShowConfirmLogout] = useState(false);
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [showArchivedChats, setShowArchivedChats] = useState(false);
  const [showConfirmDeleteAccount, setShowConfirmDeleteAccount] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const boxRef = useRef(null);
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { clearHistory } = useChatHistory();
  const [activeTab, setActiveTab] = useState('chung');
  const [selectedArchivedChat, setSelectedArchivedChat] = useState(null);

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      navigate('/chat');
    }
  };

  const handleLogoutClick = () => {
    setShowConfirmLogout(true);
  };

  const handleClearChatClick = () => {
    setShowConfirmClear(true);
  };

  const handleDeleteAccountClick = () => {
    setShowConfirmDeleteAccount(true);
  };

  const confirmLogout = async () => {
    try {
      await logout();
      setShowConfirmLogout(false);
      handleClose();
    } catch (error) {
      console.error("Error during logout:", error);
      alert("Có lỗi xảy ra khi đăng xuất. Vui lòng thử lại!");
    }
  };

  const confirmClearChat = async () => {
    if (!user) {
      alert("Vui lòng đăng nhập để thực hiện chức năng này!");
      return;
    }

    setIsDeleting(true);
    try {
      // Xóa tất cả chat từ Firebase
      await deleteAllChats(user.uid);
      
      // Xóa lịch sử chat local
      await clearHistory();
      
      // Gọi API backend để xóa dữ liệu
      const response = await fetch(`${API_URL}/user/delete-data`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await user.getIdToken()}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to delete all data');
      }
      
      const result = await response.json();
      setShowConfirmClear(false);
      setSuccessMessage("Đã xóa tất cả cuộc trò chuyện thành công!");
      setShowSuccessMessage(true);
      
      // Tự động ẩn thông báo sau 3 giây
      setTimeout(() => {
        setShowSuccessMessage(false);
        // Reload trang để reset hoàn toàn
        window.location.reload();
      }, 1000);
      
    } catch (error) {
      console.error("Error deleting all data:", error);
      alert("Có lỗi xảy ra khi xóa dữ liệu: " + error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmDeleteAccount = async () => {
    if (!user) {
      alert("Vui lòng đăng nhập để thực hiện chức năng này!");
      return;
    }
    setIsDeletingAccount(true);
    try {
      // Gọi API backend để xóa tài khoản và tất cả dữ liệu
      const response = await fetch(`${API_URL}/user/account`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${await user.getIdToken()}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to delete account');
      }

      // Xóa lịch sử chat local
      await clearHistory();

      // Hiển thị thông báo thành công
      setShowConfirmDeleteAccount(false);
      setSuccessMessage("Đã xóa tài khoản thành công!");
      setShowSuccessMessage(true);

      // Tự động ẩn thông báo và chuyển hướng sau 3 giây
      setTimeout(() => {
        setShowSuccessMessage(false);
        // Đăng xuất và chuyển hướng về trang đăng nhập
        logout();
        window.location.href = "/login";
      }, 1000);

    } catch (error) {
      if (error.code === 'auth/requires-recent-login') {
        alert('Vui lòng đăng nhập lại để xóa tài khoản!');
      } else {
        alert("Có lỗi xảy ra khi xóa tài khoản: " + error.message);
      }
    } finally {
      setIsDeletingAccount(false);
      setShowConfirmDeleteAccount(false);
    }
  };

  // Hàm xử lý khi chọn chat đã lưu trữ
  const handleSelectArchivedChat = (chat) => {
    setSelectedArchivedChat(chat); // hoặc truyền qua context nếu cần
    if (onSelectArchivedChat) onSelectArchivedChat(chat);
    handleClose(); // Đóng settings sau khi chọn chat
  };

  // Hàm khôi phục chat (ví dụ: cập nhật trường archived=false)
  const handleRestoreArchivedChat = async (chat) => {
    if (!user) return;
    const token = await user.getIdToken();
    await fetch(`http://localhost:8000/user/archive-chat/${chat.id}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ archived: false })
    });
    // Có thể reload lại modal hoặc cập nhật state
  };

  // Hàm xóa chat đã lưu trữ
  const handleDeleteArchivedChat = async (chat) => {
    if (!user) return;
    const token = await user.getIdToken();
    await fetch(`http://localhost:8000/user/delete-chat/${chat.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    // Có thể reload lại modal hoặc cập nhật state
  };

  return (
    <div className="settings-overlay" style={{ animation: 'none', transition: 'none', transform: 'none', opacity: 1, willChange: 'auto' }}>
      {showSuccessMessage && (
        <div className="success-notification">
          <div className="success-content">
            <div className="success-icon">✓</div>
            <p>{successMessage}</p>
          </div>
        </div>
      )}
      <div className="settings-box" ref={boxRef} style={{ animation: 'none', transition: 'none', transform: 'none', opacity: 1, willChange: 'auto' }}>
        <div className="settings-header">
          <div className="header-left">
            <h2>Cài đặt</h2>
          </div>
          <button className="close-btn" onClick={handleClose} title="Đóng">
            <FiX />
          </button>
        </div>

        <div className="settings-content">
          <div className="settings-sidebar">
            <button className={`sidebar-btn${activeTab === 'chung' ? ' active' : ''}`} onClick={() => setActiveTab('chung')}>Chung</button>
            <button className={`sidebar-btn${activeTab === 'account' ? ' active' : ''}`} onClick={() => setActiveTab('account')}>Tài khoản</button>
          </div>

          <div className="settings-main">
            {/* Tab Chung: Hiển thị đầy đủ */}
            {activeTab === 'chung' && (
              <>
                <div className="settings-row">
                  <span className="settings-label">Xoá tất cả đoạn chat</span>
                  <button className="btn-fixed" onClick={handleClearChatClick}>Xóa tất cả</button>
                </div>
                <div className="settings-row">
                  <span className="settings-label" style={{ color: '#e53935' }}>Xóa tài khoản</span>
                  <button className="btn-fixed btn-delete" onClick={handleDeleteAccountClick}>
                    Xóa tài khoản
                  </button>
                </div>
                <div className="settings-row">
                  <span className="settings-label">Quản lý đăng nhập</span>
                  <button className="btn-fixed" onClick={handleLogoutClick}>Đăng xuất</button>
                </div>
                <div className="settings-row">
                  <span className="settings-label">Đoạn chat đã lưu trữ</span>
                  <button className="btn-fixed" onClick={() => setShowArchivedChats(true)}>Quản lý</button>
                </div>
              </>
            )}
            {/* Tab Tài khoản: Chỉ hiển thị các chức năng tài khoản */}
            {activeTab === 'account' && (
              <>
                <div className="settings-row">
                  <span className="settings-label">Xoá tất cả đoạn chat</span>
                  <button className="btn-fixed" onClick={handleClearChatClick}>Xóa tất cả</button>
                </div>
                <div className="settings-row">
                  <span className="settings-label" style={{ color: '#e53935' }}>Xóa tài khoản</span>
                  <button className="btn-fixed btn-delete" onClick={handleDeleteAccountClick}>
                    Xóa tài khoản
                  </button>
                </div>
                <div className="settings-row">
                  <span className="settings-label">Quản lý đăng nhập</span>
                  <button className="btn-fixed" onClick={handleLogoutClick}>Đăng xuất</button>
                </div>
              </>
            )}

            {showConfirmLogout && (
              <div className="confirm-popup">
                <div className="confirm-content">
                  <p>Bạn chắc chắn muốn đăng xuất?</p>
                  <div className="confirm-buttons">
                    <button className="btn btn-error btn-sm" onClick={confirmLogout}>Đăng xuất</button>
                    <button className="btn btn-outline btn-sm" onClick={() => setShowConfirmLogout(false)}>Huỷ</button>
                  </div>
                </div>
              </div>
            )}

            {showConfirmClear && (
              <div className="confirm-popup">
                <div className="confirm-content">
                  <p>Bạn chắc chắn muốn xóa toàn bộ lịch sử trò chuyện?</p>
                  <div className="confirm-buttons">
                    <button 
                      className="btn btn-error btn-sm" 
                      onClick={confirmClearChat}
                      disabled={isDeleting}
                    >
                      {isDeleting ? "Đang xóa..." : "Xóa tất cả"}
                    </button>
                    <button 
                      className="btn btn-outline btn-sm" 
                      onClick={() => setShowConfirmClear(false)}
                      disabled={isDeleting}
                    >
                      Huỷ
                    </button>
                  </div>
                </div>
              </div>
            )}

            {showConfirmDeleteAccount && (
              <div className="confirm-popup">
                <div className="confirm-content">
                  <p>Bạn chắc chắn muốn <b>xóa vĩnh viễn</b> tài khoản này? Hành động này không thể hoàn tác!</p>
                  <div className="confirm-buttons">
                    <button 
                      className="btn btn-error btn-sm" 
                      onClick={confirmDeleteAccount}
                      disabled={isDeletingAccount}
                    >
                      {isDeletingAccount ? "Đang xóa..." : "Xóa tài khoản"}
                    </button>
                    <button 
                      className="btn btn-outline btn-sm" 
                      onClick={() => setShowConfirmDeleteAccount(false)}
                      disabled={isDeletingAccount}
                    >
                      Huỷ
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <ArchiveChatsModal
        open={showArchivedChats}
        onClose={() => setShowArchivedChats(false)}
        onSelectChat={handleSelectArchivedChat}
        onRestoreChat={handleRestoreArchivedChat}
        onDeleteChat={handleDeleteArchivedChat}
      />
    </div>
  );
};

export default Settings; 