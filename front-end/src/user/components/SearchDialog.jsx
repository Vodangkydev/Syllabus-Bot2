import React, { useState, useEffect, useRef } from 'react';
import { FiSearch, FiX, FiClock, FiMessageSquare } from 'react-icons/fi';

const SearchDialog = ({ isOpen, onClose, chatHistory, onSelectChat }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredChats, setFilteredChats] = useState([]);
  const inputRef = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setFilteredChats([]);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredChats([]);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = chatHistory.filter(chat => 
      chat.firstMessage?.toLowerCase().includes(query)
    );
    setFilteredChats(filtered);
  }, [searchQuery, chatHistory]);

  const handleSelectChat = (chat) => {
    onSelectChat(chat);
    onClose();
  };

  const handleClickOutside = (e) => {
    if (dialogRef.current && !dialogRef.current.contains(e.target)) {
      onClose();
    }
  };

  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return '';
    
    const now = new Date();
    const date = timestamp.toDate();
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
    
    if (diffInHours < 24) {
      return 'Hôm nay';
    } else if (diffInHours < 48) {
      return 'Hôm qua';
    } else {
      return date.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    }
  };

  const groupChatsByDate = (chats) => {
    const groups = {};
    
    chats.forEach(chat => {
      const timeGroup = formatTimeAgo(chat.timestamp);
      if (!groups[timeGroup]) {
        groups[timeGroup] = [];
      }
      groups[timeGroup].push(chat);
    });

    return groups;
  };

  if (!isOpen) return null;

  const groupedChats = groupChatsByDate(chatHistory);

  return (
    <div 
      className="search-dialog-overlay"
      onClick={handleClickOutside}
    >
      <div 
        ref={dialogRef}
        className="search-dialog"
      >
        <div className="search-dialog-header">
          <div className="search-icon-wrapper">
            <FiSearch className="search-icon" />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm cuộc trò chuyện..."
            className="search-dialog-input"
          />
          <button
            onClick={onClose}
            className="search-close-button"
            aria-label="Đóng"
          >
            <FiX />
          </button>
        </div>
        
        <div className="search-dialog-content">
          {searchQuery && filteredChats.length === 0 ? (
            <div className="search-dialog-empty">
              <FiSearch className="empty-icon" />
              <p>Không tìm thấy kết quả nào cho "{searchQuery}"</p>
            </div>
          ) : !searchQuery ? (
            <div className="search-history">
              <div className="search-history-header">
                <FiClock className="history-icon" />
                <span>Lịch sử tìm kiếm gần đây</span>
              </div>
              {Object.entries(groupedChats).map(([timeGroup, chats]) => (
                <div key={timeGroup} className="search-history-group">
                  <div className="search-history-group-header">
                    {timeGroup}
                  </div>
                  {chats.map((chat) => (
                    <button
                      key={chat.id}
                      onClick={() => handleSelectChat(chat)}
                      className="search-history-item"
                    >
                      <FiMessageSquare className="chat-icon" />
                      <div className="search-history-item-content">
                        <span className="search-history-item-title">
                          {chat.firstMessage}
                        </span>
                        <span className="search-history-item-time">
                          {chat.timestamp ? new Date(chat.timestamp.toDate()).toLocaleTimeString('vi-VN', {
                            hour: '2-digit',
                            minute: '2-digit'
                          }) : ''}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="search-results">
              {filteredChats.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => handleSelectChat(chat)}
                  className="search-result-item"
                >
                  <div className="search-result-content">
                    <span className="search-result-title">
                      {chat.firstMessage}
                    </span>
                    <span className="search-result-time">
                      {chat.timestamp ? new Date(chat.timestamp.toDate()).toLocaleString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                      }) : ''}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchDialog; 