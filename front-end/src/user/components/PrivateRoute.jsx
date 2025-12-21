import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

function PrivateRoute({ children }) {
  const { user } = useAuth();

  if (!user) {
    // Nếu người dùng chưa đăng nhập, chuyển hướng đến trang đăng nhập
    return <Navigate to="/login" />;
  }

  // Nếu người dùng đã đăng nhập, hiển thị component con
  return children;
}

export default PrivateRoute; 