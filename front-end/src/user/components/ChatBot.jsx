import { useState, useRef, useEffect } from "react";
import API_URL from '../../config/api';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPaperPlane, faSpinner, faPlus, faMessage, faEllipsisVertical, faArchive, faShare } from "@fortawesome/free-solid-svg-icons";
import "../../styles/ChatBot.css";
import { usePageState } from "../../context/PageStateContext";
import { useChatHistory } from "../../hooks/useChatHistory";
import { useAuth } from '../../context/AuthContext';
import { collection, addDoc, serverTimestamp, getDocs, query, where, orderBy, limit, doc, deleteDoc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { FiPlus, FiMessageSquare, FiUser, FiMoreVertical, FiChevronDown, FiSearch, FiUpload, FiLogOut, FiSun, FiMoon, FiHelpCircle, FiSettings, FiMessageCircle, FiMenu, FiGrid, FiChevronLeft, FiEdit, FiTrash2, FiCheck, FiX, FiArchive, FiCopy, FiInfo } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import logo from "../../assets/LOGO.png";
import logo2 from "../../assets/robot_image.png";
import SearchDialog from './SearchDialog';
import Settings from './Settings';
import { FaRegCopy } from "react-icons/fa";
import ReactMarkdown from 'react-markdown';
import { TypeAnimation } from 'react-type-animation';
import WelcomeModal from './WelcomeModal';

// Helper function to format source URL into a displayable name
const formatSourceName = (source) => {
  if (!source) return 'Nguồn không xác định';

  try {
    // First try to parse as URL
    const urlObject = new URL(source);
    // Get the last part of the pathname (after the last slash)
    const pathParts = urlObject.pathname.split('/').filter(Boolean);
    if (pathParts.length > 0) {
      return pathParts[pathParts.length - 1];
    }
    // Fallback to hostname if no path parts
    return urlObject.hostname;
  } catch (e) {
    // If not a valid URL, treat as a local path
    // Split by either / or \ and return the last part (filename)
    const parts = source.split(/[\\/]/).filter(Boolean);
    if (parts.length > 0) {
      return parts[parts.length - 1];
    }
    return source; // Return original source if no parts found
  }
};

// Helper function to check if a string is a valid URL
function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
}

function ChatBot() {
  const { user, logout } = useAuth();
  const { savePageState, getPageState } = usePageState();
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const [theme, setTheme] = useState('light');
  const [showSidebar, setShowSidebar] = useState(true);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [editingChatId, setEditingChatId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [showChatMenu, setShowChatMenu] = useState(null);
  const { archiveChat } = useChatHistory();
  const [editingMessageIndex, setEditingMessageIndex] = useState(null);
  const [editingMessageContent, setEditingMessageContent] = useState("");
  const [showCopyToast, setShowCopyToast] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [newMessageIndex, setNewMessageIndex] = useState(null);
  const [showSourceModal, setShowSourceModal] = useState({ visible: false, content: '', source: '' });
  const [showSources, setShowSources] = useState({});
  const [showArchivedChats, setShowArchivedChats] = useState(false);
  const [archivedChats, setArchivedChats] = useState([]);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [llmProvider, setLlmProvider] = useState(() => {
    // Load from localStorage hoặc mặc định 'huggingface'
    return localStorage.getItem('llmProvider') || 'huggingface';
  });
  const [showProviderDropdown, setShowProviderDropdown] = useState(false);
  
  const [state, setState] = useState({
    messages: [],
    promptInput: "",
    isLoading: false,
    error: null,
    firstMessage: null,
    chatHistory: [],
    currentChatId: null,
    chatTitle: null
  });

  const [guestMessageCount, setGuestMessageCount] = useState(0);
  const GUEST_MESSAGE_LIMIT = 2;

  const suggestedPrompts = [
    {
      title: "Tra cứu đề cương",
      description: "Tìm hiểu về đề cương chi tiết của các môn học"
    },
    {
      title: "Điểm số & Đánh giá",
      description: "Thông tin về cách tính điểm và yêu cầu đạt môn"
    },
    {
      title: "Tài liệu tham khảo",
      description: "Tài liệu tham khảo môn học"
    },
    {
      title: "Tìm kiếm gần đây",
      description: "Môn học kiểm thử tự động có bao nhiêu tín chỉ"
    },
    {
      title: "Tìm kiếm gần đây",
      description: "Môn học bóng rổ có bao nhiêu tín chỉ"
    },
    {
      title: "Tìm kiếm gần đây",
      description: "Các môn tự chọn"
    }
  ];

  const handleSendMessage = async (message) => {
    if (!message.trim()) return;

    // Handle guest user message limit
    if (!user) {
      if (guestMessageCount >= GUEST_MESSAGE_LIMIT) {
        setShowWelcomeModal(true);
        return;
      }
      setGuestMessageCount(prev => prev + 1);
    }

    const newMessage = { 
      role: "user", 
      content: message,
      timestamp: new Date().toISOString()
    };

    // Tạo message trống cho assistant ngay từ đầu
    const assistantMessage = {
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString()
    };

    // Cập nhật state một lần duy nhất với cả hai message
    setState(prev => ({
      ...prev,
      messages: [...prev.messages, newMessage, assistantMessage],
      promptInput: "",
      error: null
    }));

    let timeoutId;
    try {
      // Remove the 10 second delay
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 30000);

      // Sử dụng endpoint /chatbot/ask_stream với provider parameter
      const providerParam = llmProvider === 'huggingface' ? 'huggingface' : 'ollama';
      const response = await fetch(`${API_URL}/chatbot/ask_stream?question=${encodeURIComponent(message)}&provider=${encodeURIComponent(providerParam)}`, {
        method: "GET",
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive"
        },
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullAnswer = "";

      while (true) {
        const {value, done} = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'loading') {
                // Cập nhật trạng thái loading
                setState(prev => ({
                  ...prev,
                  loading: true,
                  loadingMessage: data.message
                }));
              } else if (data.type === 'chunk') {
                // Cập nhật câu trả lời từng phần với hiệu ứng typing
                fullAnswer += data.text;
                setState(prev => ({
                  ...prev,
                  messages: prev.messages.map((msg, idx) => 
                    idx === prev.messages.length - 1 
                      ? {...msg, content: fullAnswer}
                      : msg
                  ),
                  // Reset loading state when we start receiving chunks
                  loading: false,
                  loadingMessage: null,
                  isTyping: true
                }));
              } else if (data.type === 'sources') {
                // Cập nhật sources cho message cuối cùng
                setState(prev => ({
                  ...prev,
                  messages: prev.messages.map((msg, idx) => 
                    idx === prev.messages.length - 1 
                      ? {...msg, sources: data.sources}
                      : msg
                  )
                }));
              } else if (data.type === 'complete') {
                // Hoàn thành streaming
                setState(prev => ({
                  ...prev,
                  isTyping: false
                }));
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e);
            }
          }
        }
      }

      // Only save to Firebase if user is logged in
      if (user && user.uid) {
        const chatsRef = collection(db, "users", user.uid, "chats");
        
        if (state.currentChatId) {
          // Update existing chat
          const chatRef = doc(chatsRef, state.currentChatId);
          await updateDoc(chatRef, {
            messages: [...state.messages, newMessage, {
              ...assistantMessage,
              content: fullAnswer
            }],
            lastMessage: message,
            lastMessageTime: new Date().toISOString()
          });
        } else {
          // Create new chat
          const newChatRef = await addDoc(chatsRef, {
            firstMessage: message,
            title: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
            messages: [newMessage, {
              ...assistantMessage,
              content: fullAnswer
            }],
            timestamp: serverTimestamp(),
            createdAt: new Date().toISOString(),
            userId: user.uid,
            status: 'active',
            lastMessage: message,
            lastMessageTime: new Date().toISOString()
            
          });
          
          const newChat = {
            id: newChatRef.id,
            firstMessage: message,
            title: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
            messages: [newMessage, {
              ...assistantMessage,
              content: fullAnswer
            }],
            timestamp: new Date(),
            lastMessage: message,
            lastMessageTime: new Date().toISOString(),
            
          };

          setState(prev => ({
            ...prev,
            currentChatId: newChatRef.id,
            chatTitle: newChat.title,
            chatHistory: [newChat, ...prev.chatHistory]
          }));
        }
      }
    } catch (error) {
      console.error("Error:", error);
      
      // Remove the assistant message that was created if request failed
      setState(prev => ({
        ...prev,
        messages: prev.messages.filter((msg, idx) => {
          // Keep all messages except the last one (which is the empty assistant message)
          return idx < prev.messages.length - 1;
        }),
        error: error.name === 'AbortError' 
          ? "Yêu cầu đã bị hủy do quá thời gian chờ. Vui lòng thử lại."
          : error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')
          ? "Không thể kết nối đến server. Vui lòng kiểm tra kết nối mạng hoặc đảm bảo backend server đang chạy."
          : error.message || "Đã xảy ra lỗi. Vui lòng thử lại sau."
      }));
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage(state.promptInput);
    }
    const textarea = event.target;
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  };

  const handleInputChange = (e) => {
    setState(prev => ({ ...prev, promptInput: e.target.value }));
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  };

  const handlePromptClick = (prompt) => {
    setState(prev => ({
      ...prev,
      promptInput: prompt.description
    }));
    inputRef.current?.focus();
  };

  const loadChatHistory = async () => {
    if (!user) {
      console.log("No user found, skipping loadChatHistory");
      return;
    }
    
    try {
      console.log("Loading chat history for user:", user.uid);
      
      const userChatsRef = collection(db, "users", user.uid, "chats");
      const q = query(
        userChatsRef,
        orderBy("timestamp", "desc"),
        limit(200)
      );
      
      const querySnapshot = await getDocs(q);
      console.log("Found documents:", querySnapshot.size);
      
      const conversations = querySnapshot.docs
        .map(doc => {
          const data = doc.data();
          const hasCustomTitle = data.title && data.title !== data.firstMessage;
          return {
            id: doc.id,
            firstMessage: data.firstMessage,
            timestamp: data.timestamp,
            messages: data.messages || [],
            title: data.title || data.firstMessage,
            hasCustomTitle: hasCustomTitle,
            status: data.status || 'active'
          };
        })
        .filter(chat => !chat.hasCustomTitle && chat.status !== 'archived'); // Filter out archived chats and custom titles
      
      console.log("Processed conversations:", conversations);
      
      setState(prev => ({
        ...prev,
        chatHistory: conversations,
        error: null
      }));
    } catch (error) {
      console.error("Error loading chat history:", error);
      if (error.code) {
        console.error("Firebase error code:", error.code);
      }
      setState(prev => ({
        ...prev,
        error: `Không thể tải lịch sử chat: ${error.message}`
      }));
    }
  };

  const loadConversation = async (firstMessage) => {
    if (!user) return;
    
    try {
      console.log("Loading conversation with first message:", firstMessage);
      setState(prev => ({
        ...prev,
        isLoading: true,
        error: null
      }));

      const userRef = doc(db, "users", user.uid);
      const chatsRef = collection(userRef, "chats");
      
      const q = query(
        chatsRef,
        where('firstMessage', '==', firstMessage)
      );
      
      const querySnapshot = await getDocs(q);
      console.log("Found conversation documents:", querySnapshot.size);
      
      if (querySnapshot.empty) {
        throw new Error("Không tìm thấy cuộc trò chuyện");
      }

      const chatDoc = querySnapshot.docs[0];
      const chatData = chatDoc.data();

      setState(prev => ({
        ...prev,
        messages: chatData.messages || [],
        firstMessage: firstMessage,
        isLoading: false,
        promptInput: ""
      }));

    } catch (error) {
      console.error("Error in query:", error);
      setState(prev => ({
        ...prev,
        error: error.message,
        isLoading: false
      }));
    }
  };

  const startNewChat = () => {
    setState(prev => ({
      ...prev,
      messages: [],
      promptInput: "",
      currentChatId: null,
      chatTitle: null,
      firstMessage: null
    }));
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error("Lỗi đăng xuất:", error);
    }
  };

  const handleLogin = () => {
    navigate('/login');
  };

  const getUserInfo = () => {
    if (!user) return { initial: 'U', displayName: 'User', email: '' };
    return {
      initial: user.displayName ? user.displayName.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase(),
      displayName: user.displayName || user.email.split('@')[0],
      email: user.email,
      photoURL: user.photoURL
    };
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('selectedTheme', newTheme);
  };

  const handleProfile = () => {
    navigate('/profile');
  };

  const handleFAQ = () => {
    navigate('/faq');
  };

  const handleIssue = () => {
    navigate('/issue');
  };

  const handleSettings = () => {
    setShowSettingsModal(true);
  };

  const loadArchivedChats = async () => {
    if (!user) return;
    
    try {
      const token = await user.getIdToken();
      const response = await fetch(`${API_URL}/user/archived-chats`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setArchivedChats(data.chats || []);
    } catch (error) {
      console.error('Error loading archived chats:', error);
      // Only show error if it's not a network error (to avoid spamming console)
      if (error.message && !error.message.includes('Failed to fetch') && !error.message.includes('NetworkError')) {
        setState(prev => ({
          ...prev,
          error: `Không thể tải danh sách chat đã lưu trữ: ${error.message}`
        }));
      }
    }
  };

  // Add useEffect to reload archived chats when needed
  useEffect(() => {
    if (user && showArchivedChats) {
      loadArchivedChats();
    }
  }, [user, showArchivedChats]);

  const handleArchiveChat = async (chatId) => {
    if (!user || !chatId) return;
    
    try {
      const userRef = doc(db, "users", user.uid);
      const chatRef = doc(userRef, "chats", chatId);
      
      await updateDoc(chatRef, {
        status: 'archived',
        archivedAt: new Date().toISOString()
      });
      
      // Remove from current chat history immediately
      setState(prev => ({
        ...prev,
        chatHistory: prev.chatHistory.filter(chat => chat.id !== chatId),
        messages: [], // Clear current messages
        currentChatId: null,
        chatTitle: null
      }));
      
      // Reload archived chats after archiving
      if (showArchivedChats) {
        loadArchivedChats();
      }
      
      setShowChatMenu(null);
      startNewChat();
    } catch (error) {
      console.error("Error archiving chat:", error);
    }
  };

  const handleSelectArchivedChat = async (chat) => {
    try {
      setState(prev => ({
        ...prev,
        isLoading: true,
        error: null
      }));

      const userRef = doc(db, "users", user.uid);
      const chatRef = doc(userRef, "chats", chat.id);
      const chatDoc = await getDoc(chatRef);
      
      if (!chatDoc.exists()) {
        throw new Error("Không tìm thấy đoạn chat này");
      }

      const chatData = chatDoc.data();
      setState(prev => ({
        ...prev,
        messages: chatData.messages || [],
        currentChatId: chat.id,
        chatTitle: chatData.title,
        firstMessage: chatData.firstMessage,
        isLoading: false
      }));

      // Scroll to bottom of messages
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);

    } catch (error) {
      console.error("Error loading archived chat:", error);
      setState(prev => ({
        ...prev,
        error: error.message || "Có lỗi xảy ra khi tải đoạn chat",
        isLoading: false
      }));
    }
  };

  const handleUnarchiveChat = async (chatId) => {
    if (!user || !chatId) return;
    
    try {
      const userRef = doc(db, "users", user.uid);
      const chatRef = doc(userRef, "chats", chatId);
      
      await updateDoc(chatRef, {
        status: 'active',
        archivedAt: null
      });
      
      // Reload chat history and archived chats
      loadChatHistory();
      loadArchivedChats();
    } catch (error) {
      console.error("Error unarchiving chat:", error);
    }
  };

  const handleDeleteArchivedChat = async (chatId) => {
    if (!user || !chatId) return;
    
    try {
      const userRef = doc(db, "users", user.uid);
      const chatRef = doc(userRef, "chats", chatId);
      
      await deleteDoc(chatRef);
      
      // Reload archived chats after deleting
      loadArchivedChats();
    } catch (error) {
      console.error("Error deleting archived chat:", error);
    }
  };

  const sidebarItems = [
    { icon: <FiMessageSquare />, text: "Đóng sidebar", link: "#", onClick: () => setShowSidebar(false) },
    { icon: <FiPlus />, text: "Chat mới", link: "#", onClick: startNewChat },
    { icon: <FiMessageCircle />, text: "Lịch sử chat", link: "#", onClick: loadChatHistory },
    { icon: <FiArchive />, text: showArchivedChats ? "Hiện chat hiện tại" : "Hiện chat đã lưu trữ", link: "#", onClick: () => setShowArchivedChats(!showArchivedChats) }
  ];

  const recentItems = [
    "Chữ không hiển thị",
    "Thêm logo vào trang",
    "Chatbot RAG CNTT",
    "Cách hiển thị logo React",
    "Lấy file giao diện"
  ];

  const handleSearchClick = () => {
    setIsSearchOpen(true);
  };

  const handleSelectChat = async (conversation) => {
    try {
      setState(prev => ({
        ...prev,
        isLoading: true,
        error: null
      }));

      const userRef = doc(db, "users", user.uid);
      const chatRef = doc(userRef, "chats", conversation.id);
      const chatDoc = await getDoc(chatRef);
      
      if (!chatDoc.exists()) {
        throw new Error("Không tìm thấy đoạn chat này");
      }

      const chatData = chatDoc.data();
      setState(prev => ({
        ...prev,
        messages: chatData.messages || [],
        currentChatId: conversation.id,
        chatTitle: chatData.title,
        firstMessage: chatData.firstMessage,
        isLoading: false
      }));

      // Scroll to bottom of messages
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);

    } catch (error) {
      console.error("Error loading chat:", error);
      setState(prev => ({
        ...prev,
        error: error.message || "Có lỗi xảy ra khi tải đoạn chat",
        isLoading: false
      }));
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    let date;
    if (timestamp.seconds) {
      // Firestore Timestamp
      date = new Date(timestamp.seconds * 1000);
    } else if (timestamp instanceof Date) {
      // JS Date
      date = timestamp;
    } else {
      return '';
    }
    const now = new Date();
    
    const diffInDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    const timeString = date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    
    if (diffInDays === 0) {
      return `Hôm nay ${timeString}`;
    } else if (diffInDays === 1) {
      return `Hôm qua ${timeString}`;
    } else if (diffInDays <= 7) {
      return `${diffInDays} ngày trước ${timeString}`;
    } else {
      return date.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }) + ` ${timeString}`;
    }
  };

  const handleRenameChat = async (chatId, newTitle) => {
    if (!user || !chatId || !newTitle.trim()) return;
    
    try {
      const userRef = doc(db, "users", user.uid);
      const chatRef = doc(userRef, "chats", chatId);
      
      await updateDoc(chatRef, {
        title: newTitle,
        firstMessage: newTitle
      });
      
      setState(prev => ({
        ...prev,
        chatHistory: prev.chatHistory.map(chat => 
          chat.id === chatId ? { ...chat, title: newTitle, firstMessage: newTitle } : chat
        )
      }));
      
      setEditingChatId(null);
      setEditingTitle('');
    } catch (error) {
      console.error("Error renaming chat:", error);
    }
  };

  const handleDeleteChat = async (chatId) => {
    if (!user || !chatId) return;
    
    try {
      const userRef = doc(db, "users", user.uid);
      const chatRef = doc(userRef, "chats", chatId);
      
      await deleteDoc(chatRef);
      
      setState(prev => ({
        ...prev,
        chatHistory: prev.chatHistory.filter(chat => chat.id !== chatId)
      }));
      
      setShowChatMenu(null);
      startNewChat();
    } catch (error) {
      console.error("Error deleting chat:", error);
    }
  };

  const handleChatMenuClick = (e, chatId) => {
    e.stopPropagation();
    setShowChatMenu(showChatMenu === chatId ? null : chatId);
  };

  const handleStartEditing = (e, chat) => {
    e.stopPropagation();
    setEditingChatId(chat.id);
    setEditingTitle(chat.firstMessage);
    setShowChatMenu(null);
  };

  const handleCancelEditing = () => {
    setEditingChatId(null);
    setEditingTitle('');
  };

  const handleTitleEditKeyDown = (e, chatId) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleRenameChat(chatId, editingTitle);
    } else if (e.key === 'Escape') {
      handleCancelEditing();
    }
  };

  const handleCopyMessage = (content) => {
    navigator.clipboard.writeText(content);
    setShowCopyToast(true);
    setTimeout(() => setShowCopyToast(false), 2000);
  };

  const handleEditMessage = (index) => {
    setEditingMessageIndex(index);
    setEditingMessageContent(state.messages[index].content);
  };

  const handleEditInputKeyDown = (e, index) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveEditMessage(index);
    } else if (e.key === "Escape") {
      setEditingMessageIndex(null);
      setEditingMessageContent("");
    }
  };

  const saveEditMessage = async (index) => {
    if (editingMessageContent.trim() === "") return;
    const newMessages = state.messages.slice(0, index).concat({ ...state.messages[index], content: editingMessageContent });
    setState(prev => ({
      ...prev,
      messages: newMessages,
      isLoading: true
    }));
    setEditingMessageIndex(null);
    setEditingMessageContent("");

    let timeoutId;
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const providerParam = llmProvider === 'huggingface' ? 'huggingface' : 'ollama';
      const response = await fetch(`${API_URL}/chatbot/ask_stream?question=${encodeURIComponent(editingMessageContent)}&email=${encodeURIComponent(user?.email || "")}&provider=${encodeURIComponent(providerParam)}`, {
        method: "GET",
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive"
        },
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullAnswer = "";

      // Thêm message trống cho assistant
      setState(prev => ({
        ...prev,
        messages: [...newMessages, {
          role: "assistant",
          content: "",
          timestamp: new Date().toISOString()
        }]
      }));

      while (true) {
        const {value, done} = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'loading') {
                // Cập nhật trạng thái loading
                setState(prev => ({
                  ...prev,
                  loading: true,
                  loadingMessage: data.message
                }));
              } else if (data.type === 'chunk') {
                // Cập nhật câu trả lời từng phần
                fullAnswer += data.text;
                setState(prev => ({
                  ...prev,
                  messages: prev.messages.map((msg, idx) => 
                    idx === prev.messages.length - 1 
                      ? {...msg, content: fullAnswer}
                      : msg
                  )
                }));
              } else if (data.type === 'complete') {
                // Hoàn thành streaming
                setState(prev => ({
                  ...prev,
                  loading: false,
                  loadingMessage: null,
                  isLoading: false
                }));
              } else if (data.type === 'sources') {
                // Cập nhật nguồn tham khảo
                setState(prev => ({
                  ...prev,
                  messages: prev.messages.map((msg, idx) => 
                    idx === prev.messages.length - 1 
                      ? {...msg, sources: data.sources}
                      : msg
                  )
                }));
              } else if (data.type === 'error') {
                throw new Error(data.message);
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e);
            }
          }
        }
      }
    } catch (error) {
      // Remove the assistant message that was created if request failed
      setState(prev => {
        const updatedMessages = prev.messages.filter((msg, idx) => {
          // Keep all messages except the last one (which is the empty assistant message)
          return idx < prev.messages.length - 1;
        });
        
        return {
          ...prev,
          messages: [...updatedMessages, {
            role: "assistant",
            content: error.name === 'AbortError' 
              ? "Yêu cầu đã bị hủy do quá thời gian chờ. Vui lòng thử lại."
              : error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')
              ? "Không thể kết nối đến server. Vui lòng kiểm tra kết nối mạng hoặc đảm bảo backend server đang chạy."
              : `Xin lỗi, có lỗi xảy ra: ${error.message}. Vui lòng thử lại sau hoặc liên hệ admin để được hỗ trợ.`,
            error: true
          }],
          isLoading: false
        };
      });
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText("Dựa vào thông tin đã cung cấp, có tổng cộng 36 tín chỉ.");
  };

  const handleSourceLabelClick = (index) => {
    setShowSources(prevState => ({
      ...prevState,
      [index]: !prevState[index]
    }));
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showChatMenu && !event.target.closest('.chat-menu') && !event.target.closest('.action-icon')) {
        setShowChatMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showChatMenu]);

  useEffect(() => {
    const savedTheme = localStorage.getItem('selectedTheme') || 'auto';
    setTheme(savedTheme);
    if (savedTheme === 'auto') {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.setAttribute('data-theme', savedTheme);
      if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, []);

  useEffect(() => {
    console.log("useEffect triggered, user:", user);
    if (user) {
      loadChatHistory();
      loadArchivedChats();
    }
  }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.messages]);

  // Close provider dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showProviderDropdown && !event.target.closest('.model-select')) {
        setShowProviderDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProviderDropdown]);

  const handleShareChat = async (chatId) => {
    try {
      const token = await user.getIdToken();
      const response = await fetch(`${API_URL}/user/share-chat/${chatId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to share chat');
      }

      const data = await response.json();
      
      // Tạo URL chia sẻ và hiển thị modal
      const generatedShareUrl = `${window.location.origin}/shared-chat/${data.share_id}`;
      setShareLink(generatedShareUrl); // Store the link
      setShowShareModal(true); // Open the modal

      // Ẩn menu sau khi chia sẻ
      setShowChatMenu(null);
    } catch (error) {
      console.error('Error sharing chat:', error);
      setState(prev => ({
        ...prev,
        error: "Không thể chia sẻ chat. Vui lòng thử lại sau."
      }));
    }
  };

  const handleCloseShareModal = () => {
    setShowShareModal(false);
    setShareLink(''); // Clear the link when closing
  };

  const handleCopyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      alert('Đã sao chép liên kết vào clipboard!'); // Simple confirmation
      // You could add a more styled toast notification here
    } catch (err) {
      console.error('Could not copy text: ', err);
      alert('Không thể sao chép liên kết.');
    }
  };

  return (
    <div className="app-container">
      <WelcomeModal show={showWelcomeModal} onClose={() => setShowWelcomeModal(false)} forceShow={true} />
      {showCopyToast && (
        <div className="copy-toast">Đã sao chép!</div>
      )}
      <SearchDialog
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        chatHistory={state.chatHistory}
        onSelectChat={handleSelectChat}
      />

      {!showSidebar && (
        <button 
          className="toggle-sidebar"
          onClick={() => setShowSidebar(true)}
        >
          <FiMenu />
        </button>
      )}

      <div className={`sidebar ${showSidebar ? 'show' : 'hide'}`}
        style={showSettingsModal ? { pointerEvents: 'none', opacity: 0.3 } : {}}>
        <div className="sidebar-header">
          <div className="sidebar-actions">
            <div className="left-actions">
              <button className="logo-button ml-1 nav-logo" onClick={() => navigate('/')}
                tabIndex={showSettingsModal ? -1 : 0}>
                <img src={logo} alt="Logo" className="logo-image" />
              </button>
            </div>
            <div className="right-actions">
              <button className="action-button" onClick={() => setShowSidebar(false)} tabIndex={showSettingsModal ? -1 : 0}>
                <FiMenu />
              </button>
              <button 
                className="action-button"
                onClick={handleSearchClick}
                title="Tìm kiếm đoạn chat"
                tabIndex={showSettingsModal ? -1 : 0}
              >
                <FiSearch />
              </button>
            </div>
          </div>
        </div>

        {!showSettingsModal && (
          <div className="recent-items">
            <button 
              onClick={startNewChat}
              className="new-chat-button"
            >
              <FiPlus />
              <span>Cuộc trò chuyện mới</span>
            </button>
            
            <div className="chat-history">
              {user ? (
                (showArchivedChats ? archivedChats : state.chatHistory).length > 0 ? (
                  (showArchivedChats ? archivedChats : state.chatHistory).map((conversation) => (
                    <div 
                      key={conversation.id}
                      className={`chat-history-item ${state.currentChatId === conversation.id ? 'active' : ''} ${editingChatId === conversation.id ? 'editing' : ''}`}
                      onClick={() => handleSelectChat(conversation)}
                    >
                      <div className="chat-history-content">
                        {editingChatId === conversation.id ? (
                          <div className="chat-title-edit" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="text"
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              onKeyDown={(e) => handleTitleEditKeyDown(e, conversation.id)}
                              className="chat-title-input"
                              autoFocus
                            />
                            <button
                              className="action-icon"
                              onClick={() => handleRenameChat(conversation.id, editingTitle)}
                              title="Lưu"
                            >
                              <FiCheck />
                            </button>
                            <button
                              className="action-icon"
                              onClick={handleCancelEditing}
                              title="Hủy"
                            >
                              <FiX />
                            </button>
                          </div>
                        ) : (
                          <>
                            <span className="chat-title">
                              {conversation.title || conversation.firstMessage || "Cuộc trò chuyện mới"}
                            </span>
                            <span className="chat-time">
                              {formatTimestamp(conversation.timestamp)}
                            </span>
                            <div className="chat-actions">
                              <button
                                className="action-icon"
                                onClick={(e) => handleChatMenuClick(e, conversation.id)}
                                title="Tùy chọn"
                              >
                                <FiMoreVertical />
                              </button>
                            </div>
                            {showChatMenu === conversation.id && (
                              <div className="chat-menu">
                                <button className="chat-menu-item" onClick={(e) => handleStartEditing(e, conversation)}>
                                  <FiEdit />
                                  <span>Đổi tên</span>
                                </button>
                                <button className="chat-menu-item" onClick={(e) => handleShareChat(conversation.id)}>
                                  <FontAwesomeIcon icon={faShare} />
                                  <span>Chia sẻ</span>
                                </button>
                                <button className="chat-menu-item" onClick={(e) => {
                                  e.stopPropagation();
                                  handleArchiveChat(conversation.id);
                                }}>
                                  <FiArchive />
                                  <span>Lưu trữ</span>
                                </button>
                                <button className="chat-menu-item delete" onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteChat(conversation.id);
                                }}>
                                  <FiTrash2 />
                                  <span>Xóa</span>
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="no-chat-history">
                    <p>{showArchivedChats ? "Chưa có chat đã lưu trữ" : "Chưa có lịch sử trò chuyện"}</p>
                  </div>
                )
              ) : (
                <div className="no-chat-history">
                  <p>Vui lòng đăng nhập để xem lịch sử trò chuyện</p>
                </div>
              )}
            </div>
          </div>
        )}

        {!showSettingsModal && (
          <div className="sidebar-footer">
            {user ? (
              <div className="user-section">
                <div
                  className="user-button"
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  role="button"
                  tabIndex={0}
                >
                  {user.photoURL ? (
                    <img 
                      src={user.photoURL} 
                      alt="Profile" 
                      className="user-avatar"
                    />
                  ) : (
                    <div className="user-avatar">
                      {getUserInfo().initial}
                    </div>
                  )}
                  <span className="user-name">{getUserInfo().displayName}</span>
                  <FiChevronDown className={`chevron ${showUserMenu ? 'rotate' : ''}`} />
                </div>
                
                {showUserMenu && (
                  <div className="user-menu">
                    <div className="menu-item" onClick={handleProfile} role="button" tabIndex={0}>
                      <FiUser />
                      <span>Profile</span>
                    </div>
                    <div className="menu-item" onClick={handleFAQ} role="button" tabIndex={0}>
                      <FiHelpCircle />
                      <span>FAQs</span>
                    </div>
                    <div className="menu-item" onClick={handleIssue} role="button" tabIndex={0}>
                      <FiMessageCircle />
                      <span>Góp ý</span>
                    </div>
                    <div className="menu-item" onClick={handleSettings} role="button" tabIndex={0}>
                      <FiSettings />
                      <span>Cài đặt</span>
                    </div>
                    <div className="menu-divider"></div>
                    <div className="theme-toggle-container">
                      <div
                        className={`theme-toggle-option ${theme === 'auto' ? 'selected' : ''}`}
                        onClick={() => {
                          setTheme('auto');
                          document.documentElement.setAttribute('data-theme', 'dark');
                          document.documentElement.classList.add('dark');
                          localStorage.setItem('selectedTheme', 'auto');
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        Auto
                      </div>
                      <div
                        className={`theme-toggle-option ${theme === 'light' ? 'selected' : ''}`}
                        onClick={() => {
                          setTheme('light');
                          document.documentElement.setAttribute('data-theme', 'light');
                          document.documentElement.classList.remove('dark');
                          localStorage.setItem('selectedTheme', 'light');
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <FiSun />
                      </div>
                      <div
                        className={`theme-toggle-option ${theme === 'dark' ? 'selected' : ''}`}
                        onClick={() => {
                          setTheme('dark');
                          document.documentElement.setAttribute('data-theme', 'dark');
                          document.documentElement.classList.add('dark');
                          localStorage.setItem('selectedTheme', 'dark');
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <FiMoon />
                      </div>
                    </div>
                    <div className="user-menu-footer">
                      <div className="menu-item" onClick={handleLogout} role="button" tabIndex={0}>
                        <FiLogOut />
                        <span>Đăng xuất</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div 
                className="user-button" 
                onClick={handleLogin}
                role="button"
                tabIndex={0}
              >
                <div className="user-avatar">
                  <FiUser />
                </div>
                <span className="user-name">Đăng nhập tài khoản</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="chat-container" style={showSettingsModal ? { filter: 'blur(2px)', pointerEvents: 'none' } : {}}>
        <div className="chat-header">
          <div className="model-select" style={{ position: 'relative' }}>
            <span className="model-name">Syllabus-Bot</span>
            <FiChevronDown 
              onClick={() => setShowProviderDropdown(!showProviderDropdown)}
              style={{ cursor: 'pointer' }}
            />
            {showProviderDropdown && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: '8px',
                backgroundColor: '#23272f',
                border: '1px solid #444',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                zIndex: 1000,
                minWidth: '200px',
                overflow: 'hidden'
              }}>
                <div style={{
                  padding: '8px 12px',
                  fontSize: '12px',
                  color: '#888',
                  borderBottom: '1px solid #444'
                }}>
                  Chọn LLM Provider
                </div>
                <div
                  style={{
                    padding: '10px 16px',
                    cursor: 'pointer',
                    backgroundColor: llmProvider === 'ollama' ? '#2a2f3a' : 'transparent',
                    color: llmProvider === 'ollama' ? '#fff' : '#ccc',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                  onClick={() => {
                    setLlmProvider('ollama');
                    localStorage.setItem('llmProvider', 'ollama');
                    setShowProviderDropdown(false);
                  }}
                  onMouseEnter={(e) => {
                    if (llmProvider !== 'ollama') e.target.style.backgroundColor = '#2a2f3a';
                  }}
                  onMouseLeave={(e) => {
                    if (llmProvider !== 'ollama') e.target.style.backgroundColor = 'transparent';
                  }}
                >
                  <span>Ollama</span>
                  {llmProvider === 'ollama' && <FiCheck style={{ color: '#4CAF50' }} />}
                </div>
                <div
                  style={{
                    padding: '10px 16px',
                    cursor: 'pointer',
                    backgroundColor: llmProvider === 'huggingface' ? '#2a2f3a' : 'transparent',
                    color: llmProvider === 'huggingface' ? '#fff' : '#ccc',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                  onClick={() => {
                    setLlmProvider('huggingface');
                    localStorage.setItem('llmProvider', 'huggingface');
                    setShowProviderDropdown(false);
                  }}
                  onMouseEnter={(e) => {
                    if (llmProvider !== 'huggingface') e.target.style.backgroundColor = '#2a2f3a';
                  }}
                  onMouseLeave={(e) => {
                    if (llmProvider !== 'huggingface') e.target.style.backgroundColor = 'transparent';
                  }}
                >
                  <span>Hugging Face</span>
                  {llmProvider === 'huggingface' && <FiCheck style={{ color: '#4CAF50' }} />}
                </div>
              </div>
            )}
          </div>
          <div className="header-actions">
            <button className="success-badge">HOẠT ĐỘNG</button>
            <span className="header-text">Chatbot hỗ trợ tra cứu môn học của Khoa công nghệ thông tin trường đại học Văn Lang.</span>
          </div>
        </div>

        <div className="chat-messages">
          {!user && (
            <div className="guest-message-limit">
              {guestMessageCount >= GUEST_MESSAGE_LIMIT ? (
                <p>Bạn đã sử dụng hết lượt. Vui lòng đăng nhập để tiếp tục trò chuyện.</p>
              ) : (
                <p>Bạn đang ở chế độ khách. Còn {GUEST_MESSAGE_LIMIT - guestMessageCount} tin nhắn. Vui lòng đăng nhập để thực hiện các tín năng của chat.</p>
              )}
            </div>
          )}
          
          {state.messages.length === 0 && (
            <>
              <div className="welcome-section">
                <div className="logo-container">
                  <img src={logo} alt="Syllabus-Bot" className="welcome-logo" />
                 </div>
                <h1 className="welcome-title">Tôi có thể giúp gì cho bạn?</h1>
                    </div>
              <div className="suggested-prompts">
                {suggestedPrompts.map((prompt, index) => (
                  <div 
                    key={index} 
                    className="prompt-card"
                    onClick={() => handlePromptClick(prompt)}
                  >
                    <h3>{prompt.title}</h3>
                    <p>{prompt.description}</p>
                  </div>
                ))}
                  </div>
            </>
          )}

          {state.messages.map((message, index) => (
            <div 
              key={index} 
              className={`message ${message.role === 'user' ? 'user' : 'assistant'}`}
            >
              <div className="message-content">
                {editingMessageIndex === index ? (
                  <div className="edit-message-container">
                    <textarea
                      value={editingMessageContent}
                      onChange={(e) => setEditingMessageContent(e.target.value)}
                      onKeyDown={(e) => handleEditInputKeyDown(e, index)}
                      className="edit-message-input"
                      autoFocus
                    />
                    <div className="edit-actions">
                      <button 
                        className="edit-save-button"
                        onClick={() => saveEditMessage(index)}
                      >
                        <FiCheck />
                      </button>
                      <button 
                        className="edit-cancel-button"
                        onClick={() => {
                          setEditingMessageIndex(null);
                          setEditingMessageContent("");
                        }}
                      >
                        <FiX />
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                    {message.role === 'assistant' && !message.content && (
                      <div className="typing-indicator">
                        <span>Vui lòng chờ trong giây lát </span>
                        <FontAwesomeIcon icon={faSpinner} className="spinner-icon" />
                      </div>
                    )}
                  </>
                )}
              </div>
              {/* Conditionally render icons based on showSources[index] */}
              {editingMessageIndex !== index && !showSources[index] && (
                <>
                  {message.role === 'user' ? (
                    <div className="message-actions">
                      <button
                        className="message-action-button"
                        onClick={() => handleEditMessage(index)}
                        title="Chỉnh sửa"
                      >
                        <FiEdit />
                      </button>
                      <button
                        className="message-action-button copy-button"
                        onClick={() => handleCopyMessage(message.content)}
                        title="Sao chép"
                      >
                        <FaRegCopy />
                      </button>
                    </div>
                  ) : (
                    <div className="assistant-copy-below">
                      <button
                        className="message-action-button copy-button"
                        onClick={() => handleCopyMessage(message.content)}
                        title="Sao chép"
                      >
                        <FaRegCopy />
                      </button>
                      {message.sources && message.sources.length > 0 && (
                        <button
                          className="message-action-button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSourceLabelClick(index);
                          }}
                          title="Tham khảo"
                        >
                          <FiInfo />
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
              {/* Conditionally render message-sources based on showSources[index] */}
              {message.role === 'assistant' && message.sources && message.sources.length > 0 && showSources[index] && (
                <div className="message-sources">
                  <span 
                    className="source-label" 
                    onClick={() => handleSourceLabelClick(index)}
                    style={{ cursor: 'pointer' }}
                  >
                    Tham khảo:
                  </span>
                  <div className="sources-list">
                    {message.sources.map((source, srcIndex) => (
                      <button 
                        key={srcIndex} 
                        className="source-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowSourceModal({ visible: true, content: source.content, source: source.source });
                        }}
                      >
                        {formatSourceName(source.source)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
          
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input-container">
          <div className="chat-input-wrapper">
                <textarea
              className="chat-input"
              value={state.promptInput}
              onChange={handleInputChange}
              placeholder="Nhập tin nhắn của bạn..."
              rows={1}
              onKeyDown={handleKeyDown}
            />
            <div className="input-actions">
                <button
                className="send-button"
                onClick={() => handleSendMessage(state.promptInput)}
                disabled={!state.promptInput.trim() || state.isLoading}
              >
                <FontAwesomeIcon icon={faPaperPlane} />
                </button>
            </div>
          </div>
        </div>
      </div>
      {showSettingsModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => e.stopPropagation()}>
          <div style={{ borderRadius: 24, boxShadow: '0 8px 32px rgba(0,0,0,0.25)', background: '#23272f', padding: 36, minWidth: 400, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
            <Settings onClose={() => setShowSettingsModal(false)} onSelectArchivedChat={handleSelectArchivedChat} />
          </div>
        </div>
      )}
      {showSourceModal.visible && (
        <div 
          className="source-modal-overlay"
          onClick={() => {
            setShowSourceModal({ visible: false, content: '', source: '' });
          }}
        >
          <div 
            className="source-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.2, color: '#1976d2' }}>
                  {formatSourceName(showSourceModal.source)}
                </div>
                <div style={{ fontSize: 15, color: '#888', fontWeight: 500, marginTop: 2 }}>
                  {isValidUrl(showSourceModal.source) && <>Nguồn: {new URL(showSourceModal.source).hostname.replace(/^www\./, '')}</>}
                </div>
              </div>
              <button
                onClick={() => setShowSourceModal({ visible: false, content: '', source: '' })}
                style={{ fontSize: 24, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1, marginLeft: 16 }}
                aria-label="Đóng"
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              <p>{showSourceModal.content}</p>
            </div>
            {showSourceModal.source && (
              <div className="modal-source-url" style={{ marginTop: '16px' }}>
                <span style={{ color: '#222', fontWeight: 500 }}>Thông tin chi tiết: </span>
                {isValidUrl(showSourceModal.source) ? (
                  <a href={showSourceModal.source} target="_blank" rel="noopener noreferrer" style={{ color: '#1a0dab', textDecoration: 'underline' }}>
                    {showSourceModal.source.startsWith('http://') || showSourceModal.source.startsWith('https://') ? showSourceModal.source : showSourceModal.source.split(/[\\/]/).filter(Boolean).pop() || showSourceModal.source}
                  </a>
                ) : (
                  <span style={{ color: '#888' }}>
                    {showSourceModal.source.split(/[\\/]/).filter(Boolean).pop() || showSourceModal.source}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      {showShareModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Chia sẻ đoạn chat</h3>
              <button className="close-button" onClick={handleCloseShareModal}>&times;</button>
            </div>
            <div className="modal-body">
              <p>Sao chép liên kết dưới đây để chia sẻ cuộc trò chuyện này:</p>
              <div className="share-link-container">
                <input type="text" value={shareLink} readOnly className="share-link-input" />
                <button onClick={handleCopyShareLink} className="copy-link-button">
                  <FaRegCopy /> Sao chép
                </button>
              </div>
              <p className="share-note">Tên, hướng dẫn tùy chỉnh và mọi tin nhắn bạn thêm sau khi chia sẻ sẽ được giữ kín.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatBot;
 