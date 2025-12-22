import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { FiMessageSquare, FiArchive, FiTrash2, FiRefreshCw, FiEye } from "react-icons/fi";

export default function ArchiveChatsModal({ open, onClose, onSelectChat }) {
  const [archivedChats, setArchivedChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const { user } = useAuth();

  const loadArchivedChats = async () => {
    if (!user) return;
    
    try {
      const token = await user.getIdToken();
      const response = await fetch(`${API_URL}/user/archived-chats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!response.ok) {
        throw new Error('Failed to load archived chats');
      }
      
      const data = await response.json();
      setArchivedChats(data.chats || []);
    } catch (error) {
      console.error('Error loading archived chats:', error);
    }
  };

  useEffect(() => {
    if (open && user) {
      loadArchivedChats();
    }
  }, [open, user]);

  const handleUnarchive = async (chat) => {
    if (!user) return;
    
    try {
      const token = await user.getIdToken();
      const response = await fetch(`${API_URL}/user/unarchive-chat/${chat.id}`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ archived: false })
      });
      
      if (!response.ok) {
        throw new Error('Failed to unarchive chat');
      }
      
      // Reload archived chats after unarchiving
      loadArchivedChats();
    } catch (error) {
      console.error('Error unarchiving chat:', error);
    }
  };

  const handleDelete = async (chat) => {
    if (!user) return;
    
    try {
      const token = await user.getIdToken();
      const response = await fetch(`${API_URL}/user/delete-chat/${chat.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete chat');
      }
      
      // Reload archived chats after deleting
      loadArchivedChats();
    } catch (error) {
      console.error('Error deleting chat:', error);
    }
  };

  const handleViewChat = (chat) => {
    setSelectedChat(chat);
    if (onSelectChat) {
      onSelectChat(chat);
    }
  };

  if (!open) return null;

  // Định dạng ngày tháng kiểu '3 tháng 6, 2025'
  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('vi-VN', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  return (
    <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="modal-content" style={{ background: '#222', color: '#fff', borderRadius: 16, padding: 32, minWidth: 800, maxWidth: 1100, width: '80vw', boxShadow: '0 8px 32px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 26 }}>Đoạn Chat đã Lưu trữ</h3>
          <button onClick={onClose} style={{ background: 'none', color: '#fff', border: 'none', fontSize: 28, cursor: 'pointer', fontWeight: 700 }}>✕</button>
        </div>
        <table style={{ width: '100%', marginBottom: 16, borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 12, fontSize: 17 }}>Tên</th>
              <th style={{ textAlign: 'left', padding: 12, fontSize: 17 }}>Ngày tạo</th>
              <th style={{ textAlign: 'center', padding: 12, fontSize: 17 }}></th>
            </tr>
          </thead>
          <tbody>
            {archivedChats.length === 0 && (
              <tr><td colSpan={3} style={{ textAlign: 'center', padding: 24, fontSize: 16 }}>Không có đoạn chat nào đã lưu trữ.</td></tr>
            )}
            {archivedChats.map(chat => (
              <tr key={chat.id}>
                <td style={{ padding: 12 }}>
                  <span style={{ cursor: 'pointer', color: '#1976d2', display: 'flex', alignItems: 'center', fontSize: 16 }}
                    onClick={() => handleViewChat(chat)}>
                    <FiMessageSquare style={{ marginRight: 8, fontSize: 18 }} />
                    {chat.title || chat.firstMessage || chat.message || "Không tên"}
                  </span>
                </td>
                <td style={{ padding: 12, fontSize: 15 }}>{formatDate(chat.timestamp)}</td>
                <td style={{ padding: 12, textAlign: 'center' }}>
                  <button style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', marginRight: 12, fontSize: 18 }}
                    title="Khôi phục"
                    onClick={() => handleUnarchive(chat)}>
                    <FiRefreshCw />
                  </button>
                  <button style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 18 }}
                    title="Xóa"
                    onClick={() => handleDelete(chat)}>
                    <FiTrash2 />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
} 