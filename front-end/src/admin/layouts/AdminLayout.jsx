import { Outlet, Navigate, useNavigate } from 'react-router-dom';
import { getAuth, signOut } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const AdminLayout = () => {
  const auth = getAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdminStatus = async () => {
      const user = auth.currentUser;
      if (user) {
        const idTokenResult = await user.getIdTokenResult();
        setIsAdmin(idTokenResult.claims.admin === true);
      }
      setLoading(false);
    };

    checkAdminStatus();
  }, [auth]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/admin');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm w-full fixed top-0 left-0 z-50">
        <div className="px-4 sm:px-6 lg:px-8 w-full flex items-center justify-between h-16">
          <div className="flex-shrink-0 order-1">
            <span className="text-lg font-bold ml-4 text-gray-900">Admin Syllabus-Bot</span>
          </div>
          <div className="flex-1 flex justify-center order-2 items-center">
            <div className="flex space-x-6">
              <Link
                to="/admin/dashboard"
                className="mt-1 border-transparent text-gray-900 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-3 py-2 border-b-2 text-base font-medium"
              >
                Quản lý người dùng
              </Link>
              <Link
                to="/admin/feedbacks"
                className="mt-1 border-transparent text-gray-900 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-3 py-2 border-b-2 text-base font-medium"
              >
                Feedbacks
              </Link>
              <Link
                to="/admin/analysis"
                className="mt-1 border-transparent text-gray-900 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-3 py-2 border-b-2 text-base font-medium"
              >
                Analysis
              </Link>
              <Link
                to="/admin/chroma"
                className="mt-1 border-transparent text-gray-900 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-3 py-2 border-b-2 text-base font-medium"
              >
                Chroma
              </Link>
            </div>
          </div>
          <div className="order-3">
            <button
              onClick={handleLogout}
              className="ml-4 px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </nav>
      <main className="py-6 sm:px-6 lg:px-8 w-full">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout; 