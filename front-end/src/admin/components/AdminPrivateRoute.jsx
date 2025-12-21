import { Navigate } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import { useEffect, useState } from 'react';

function AdminPrivateRoute({ children }) {
  const auth = getAuth();
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

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!auth.currentUser) {
    // If not logged in, redirect to admin login
    return <Navigate to="/admin" replace />;
  }

  if (!isAdmin) {
    // If logged in but not admin, redirect to admin login
    return <Navigate to="/admin" replace />;
  }

  // If logged in and is admin, show the protected content
  return children;
}

export default AdminPrivateRoute; 