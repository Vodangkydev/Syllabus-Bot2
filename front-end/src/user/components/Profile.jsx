import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { updateProfile } from 'firebase/auth';
import { FiEdit2 } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { uploadCompressedImage } from '../../utils/imageUpload';
import '../../styles/Profile.css';

function Profile() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [photoURL, setPhotoURL] = useState(user?.photoURL || '');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  // Function to process Google profile image URL
  const processGooglePhotoURL = (url) => {
    if (!url) return '';
    // If it's a Google profile image URL, ensure it has the correct size parameter
    if (url.includes('googleusercontent.com')) {
      // Check if a size parameter already exists
      if (!url.match(/=s\d+(-c)?/)) {
        // If no size parameter, add the desired size parameter (96x96 pixels)
        url = `${url}=s96-c`;
      }
    }
    return url;
  };

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || '');
      setPhotoURL(processGooglePhotoURL(user.photoURL) || '');
    }
  }, [user]);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      setIsUploading(true);
      setError('');

      const imageUrl = await uploadCompressedImage(
        file,
        user.uid,
        (progress) => setUploadProgress(progress),
        (preview) => setPhotoURL(preview)
      );
      
      await updateProfile(user, {
        photoURL: imageUrl
      });

      setPhotoURL(imageUrl);
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.message || 'Không thể tải ảnh lên. Vui lòng thử lại.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleUpdateProfile = async () => {
    try {
      setError('');
      await updateProfile(user, {
        displayName: displayName
      });
      navigate('/chat');
    } catch (err) {
      setError('Không thể cập nhật thông tin');
    }
  };

  return (
    <div className="profile-page">
      <div className="profile-header">
        <h1>Hồ sơ</h1>
      </div>

      <div className="profile-card">
        <div className="profile-info">
          <div className="profile-avatar-section">
            <div className="avatar-container">
              {photoURL ? (
                <img 
                  src={photoURL} 
                  alt="Avatar" 
                  className="profile-avatar"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.style.display = 'none';
                    e.target.parentElement.querySelector('.profile-avatar-placeholder').style.display = 'flex';
                  }}
                />
              ) : null}
              <div 
                className="profile-avatar-placeholder"
                style={{ display: photoURL ? 'none' : 'flex' }}
              >
                {displayName?.charAt(0) || user?.email?.charAt(0) || '?'}
              </div>
              <button 
                className="avatar-edit-button"
                onClick={() => fileInputRef.current.click()}
                disabled={isUploading}
              >
                <FiEdit2 size={16} />
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="image/*"
                style={{ display: 'none' }}
              />
            </div>
            {isUploading && (
              <div className="upload-progress">
                <div 
                  className="progress-bar" 
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}
          </div>

          <div className="profile-details">
            <div className="profile-name">
              <h2>{displayName || 'Chưa đặt tên'}</h2>
              <span className="profile-username">@{user?.email?.split('@')[0]}</span>
            </div>
            <div className="profile-meta">
              <span className="join-date">
                Tham gia tháng {new Date().getMonth() + 1} năm {new Date().getFullYear()}
              </span>
            </div>
          </div>
        </div>

        <div className="profile-edit-section">
          <h3>Chỉnh sửa hồ sơ</h3>
          
          <div className="form-group">
            <label>Email</label>
            <input
              type="text"
              value={user?.email || ''}
              disabled
              className="input-disabled"
            />
          </div>

          <div className="form-group">
            <label>Tên hiển thị</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Nhập tên của bạn"
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="profile-actions">
            <button 
              className="cancel-button"
              onClick={() => navigate('/chat')}
            >
              Hủy
            </button>
            <button 
              className="save-button"
              onClick={handleUpdateProfile}
            >
              Lưu thay đổi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Profile; 