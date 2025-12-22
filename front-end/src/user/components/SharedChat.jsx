import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { FiArrowLeft, FiClock, FiUser } from 'react-icons/fi';
import ReactMarkdown from 'react-markdown';
import '../../styles/ChatBot.css';

const SharedChat = () => {
  const { shareId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [chat, setChat] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSharedChat = async () => {
      try {
        if (!user) {
          setError('Vui lòng đăng nhập để xem chat được chia sẻ');
          return;
        }

        const token = await user.getIdToken();
        const response = await fetch(`${API_URL}/user/shared-chat/${shareId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error('Không thể tải chat được chia sẻ');
        }

        const data = await response.json();
        setChat(data.chat);
      } catch (error) {
        console.error('Error fetching shared chat:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSharedChat();
  }, [shareId, user]);

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  if (loading) {
    return (
      <div className="shared-chat-container">
        <div className="loading">
          <div className="loading-spinner"></div>
          <p>Đang tải cuộc trò chuyện...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="shared-chat-container">
        <div className="error">
          <div className="error-icon">⚠️</div>
          <h3>Không thể tải cuộc trò chuyện</h3>
          <p>{error}</p>
          <button onClick={() => navigate('/login')} className="login-button">
            Đăng nhập để xem
          </button>
        </div>
      </div>
    );
  }

  if (!chat) {
    return (
      <div className="shared-chat-container">
        <div className="error">
          <div className="error-icon">🔍</div>
          <h3>Không tìm thấy cuộc trò chuyện</h3>
          <p>Cuộc trò chuyện này có thể đã bị xóa hoặc không tồn tại.</p>
          <button onClick={() => navigate('/chat')} className="login-button">
            Quay lại trang chủ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="shared-chat-container">
      <div className="shared-chat-header">
        <button onClick={() => navigate('/chat')} className="back-button">
          <FiArrowLeft /> Quay lại
        </button>
        <div className="chat-info">
          <h2>{chat.title}</h2>
          <div className="chat-meta">
            <span className="meta-item">
              <FiClock /> {formatDate(chat.timestamp)}
            </span>
            <span className="meta-item">
              <FiUser /> {chat.original_user_id}
            </span>
          </div>
        </div>
      </div>
      
      <div className="shared-chat-messages">
        {chat.messages.map((message, index) => (
          <div key={index} className={`message ${message.role}`}>
            <div className="message-content">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SharedChat; 