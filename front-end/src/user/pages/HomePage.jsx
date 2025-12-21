import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import '../../styles/HomePage.css';
import logo from '../../assets/LOGO.png';
import slider1 from '../../assets/slider/1.png';
import slider2 from '../../assets/slider/2.jpg';
import slider3 from '../../assets/slider/3.jpg';
import { useAuth } from '../../context/AuthContext';
import { FiUser, FiChevronDown, FiLogOut } from 'react-icons/fi';
import WelcomeModal from '../components/WelcomeModal';

const backgroundImages = [
  slider1,
  slider2,
  slider3
];

// Dark Mode Wrapper Component
const DarkModeWrapper = ({ children }) => {
  useEffect(() => {
    // Lưu theme hiện tại
    const currentTheme = document.documentElement.getAttribute('data-theme');
    
    // Force dark mode
    document.documentElement.setAttribute('data-theme', 'dark');
    
    // Cleanup: khôi phục theme cũ khi rời trang
    return () => {
      document.documentElement.setAttribute('data-theme', currentTheme || 'light');
    };
  }, []);

  return children;
};

function HomePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prevIndex) => 
        (prevIndex + 1) % backgroundImages.length
      );
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error("Lỗi đăng xuất:", error);
    }
  };

  return (
    <DarkModeWrapper>
      <div className="hero-container" style={{
        backgroundImage: `linear-gradient(to bottom, rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.9)),
                         url(${backgroundImages[currentImageIndex]})`
      }}>
        <nav className="nav-bar">
          <button className="logo-button ml-1 nav-logo" onClick={() => navigate('/')}
            tabIndex={0}>
            <img src={logo} alt="Logo" className="logo-image" />
          </button>
          <div className="nav-links">
            <Link to="/resources" className="nav-link"></Link>
            {user ? (
              user.emailVerified ? (
              <div className="user-menu-container">
                <button
                  className="user-button"
                  onClick={() => setShowUserMenu(!showUserMenu)}
                >
                  {user.photoURL ? (
                    <img 
                      src={user.photoURL} 
                      alt="Profile" 
                      className="user-avatar"
                    />
                  ) : (
                    <div className="user-avatar">
                      {user.displayName ? user.displayName[0].toUpperCase() : user.email[0].toUpperCase()}
                    </div>
                  )}
                  <span className="user-name">
                    {user.displayName || user.email.split('@')[0]}
                  </span>
                  <FiChevronDown className={`chevron ${showUserMenu ? 'rotate' : ''}`} />
                </button>
                
                {showUserMenu && (
                  <div className="user-dropdown-menu">
                    <Link to="/chat" className="menu-item">
                      <FiUser />
                      <span>Chat Bot</span>
                    </Link>
                    <button className="menu-item" onClick={handleLogout}>
                      <FiLogOut />
                      <span>Đăng xuất</span>
                    </button>
                  </div>
                )}
              </div>
              ) : (
                <button 
                  className="nav-link" 
                  onClick={() => navigate('/login')}
                >
                  Đăng nhập
                </button>
              )
            ) : (
              <button 
                className="nav-link" 
                onClick={() => setShowWelcomeModal(true)}
              >
                Đăng nhập
              </button>
            )}
          </div>
        </nav>
        
        <div className="hero-content">
          <h1 className="hero-heading">Chat with Syllabus-Bot </h1>
          <p className="hero-description">
          Chatbot Syllabus-Bot tra cứu môn học của khoa công nghệ thông tin trường đại học Văn Lang luôn sẵn sàng đồng hành, 
          giúp bạn dễ dàng tiếp cận thông tin học tập mọi lúc, mọi nơi.
          </p>
          <div className="cta-section">
            <Link to="/chat">
              <button className="primary-button">Chat ngay</button>
            </Link>
            <div className="community-info">
              <a href="https://www.vlu.edu.vn/faculty/khoa-cong-nghe-thong-tin" className="community-link" target="_blank" rel="noopener noreferrer">  
                Khám phá Khoa Công nghệ Thông tin - Văn Lang
              </a>
              <p className="enterprise-text">
                Nhắn ngay để được hỗ trợ từ đội ngũ tư vấn viên của chúng tôi!
              </p>
            </div>
          </div>
        </div>
      </div>
      <WelcomeModal 
        show={showWelcomeModal} 
        onClose={() => setShowWelcomeModal(false)} 
      />
    </DarkModeWrapper>
  );
}

export default HomePage; 