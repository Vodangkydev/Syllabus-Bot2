import React, { useState, useEffect } from 'react';
import API_URL from '../../config/api';
import { getAuth } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { IoClose } from "react-icons/io5";
import { FaSort, FaSortUp, FaSortDown } from "react-icons/fa";

const AdminPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatingUser, setUpdatingUser] = useState(null);
  const [sortConfig, setSortConfig] = useState({
    key: 'lastSignInTime',
    direction: 'desc'
  });
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [roleFilter, setRoleFilter] = useState('all'); // 'all', 'admin', 'user'
  const [timeFilter, setTimeFilter] = useState('all');
  const [deleteModal, setDeleteModal] = useState({ show: false, userId: null, userName: '' });
  const navigate = useNavigate();
  const auth = getAuth();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error("User not authenticated");
      }
      
      const token = await user.getIdToken();
      const response = await fetch(`${API_URL}/admin/users`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to fetch users");
      }
      
      const data = await response.json();
      setUsers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });

    const sortedUsers = [...users].sort((a, b) => {
      if (key === 'lastSignInTime') {
        const timeA = a.lastSignInTimestamp || 0;
        const timeB = b.lastSignInTimestamp || 0;
        return direction === 'asc' ? timeA - timeB : timeB - timeA;
      }
      if (key === 'isAdmin') {
        const timeA = a.lastSignInTimestamp || 0;
        const timeB = b.lastSignInTimestamp || 0;
        if (timeA !== timeB) {
          return direction === 'asc' ? timeA - timeB : timeB - timeA;
        }
        return direction === 'asc' 
          ? (a.isAdmin === b.isAdmin ? 0 : a.isAdmin ? 1 : -1)
          : (a.isAdmin === b.isAdmin ? 0 : a.isAdmin ? -1 : 1);
      }
      return direction === 'asc'
        ? (a[key] || '').localeCompare(b[key] || '')
        : (b[key] || '').localeCompare(a[key] || '');
    });

    setUsers(sortedUsers);
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return <FaSort className="ml-1" />;
    return sortConfig.direction === 'asc' 
      ? <FaSortUp className="ml-1" /> 
      : <FaSortDown className="ml-1" />;
  };

  const handleToggleAdmin = async (userId, makeAdmin, userName) => {
    const action = makeAdmin ? 'cấp' : 'thu hồi';
    if (window.confirm(`Bạn có chắc chắn muốn ${action} quyền admin cho người dùng ${userName || 'này'}?`)) {
      try {
        setUpdatingUser(userId);
        // Close the dropdown
        setOpenDropdownId(null);
        const user = auth.currentUser;
        if (!user) {
          throw new Error("User not authenticated");
        }

        const token = await user.getIdToken();
        const response = await fetch(`${API_URL}/admin/users/${userId}/admin`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ is_admin: makeAdmin })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || "Failed to update admin status");
        }

        await fetchUsers();
      } catch (err) {
        setError(err.message);
      } finally {
        setUpdatingUser(null);
      }
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    setDeleteModal({ show: true, userId, userName });
  };

  const confirmDelete = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error("User not authenticated");
      }
      
      const token = await user.getIdToken();
      const response = await fetch(`${API_URL}/admin/users/${deleteModal.userId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to delete user");
      }

      await fetchUsers();
      setDeleteModal({ show: false, userId: null, userName: '' });
    } catch (err) {
      setError(err.message);
    }
  };

  const cancelDelete = () => {
    setDeleteModal({ show: false, userId: null, userName: '' });
  };

  const handleLogout = () => {
    navigate('/admin');
  };

  const filteredUsers = users.filter(user => {
    // Role filter
    if (roleFilter === 'admin' && !user.isAdmin) return false;
    if (roleFilter === 'user' && user.isAdmin) return false;

    // Time filter
    if (timeFilter === 'all') return true;
    
    const lastSignIn = user.lastSignInTimestamp || 0;
    const now = Date.now();
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    const oneMonth = 30 * 24 * 60 * 60 * 1000;

    switch (timeFilter) {
      case 'week':
        // Last week's data
        const lastWeekStart = now - (2 * oneWeek);
        const lastWeekEnd = now - oneWeek;
        return lastSignIn >= lastWeekStart && lastSignIn <= lastWeekEnd;
      case 'month':
        // Last month's data
        const lastMonthStart = now - (2 * oneMonth);
        const lastMonthEnd = now - oneMonth;
        return lastSignIn >= lastMonthStart && lastSignIn <= lastMonthEnd;
      default:
        return true;
    }
  });

  // Sort users by lastSignInTime in descending order
  const sortedUsers = [...filteredUsers].sort((a, b) => {
    const timeA = a.lastSignInTimestamp || 0;
    const timeB = b.lastSignInTimestamp || 0;
    return timeB - timeA;
  });

  const formatDateTime = (timestamp) => {
    if (!timestamp) return 'Chưa có';
    const date = new Date(timestamp);
    return date.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-gray-900">Đang tải...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-500 text-xl">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {deleteModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center pt-20 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Xác nhận xóa</h3>
              <button
                onClick={cancelDelete}
                className="text-gray-400 hover:text-gray-500"
              >
                <IoClose className="h-6 w-6" />
              </button>
            </div>
            <p className="text-gray-600 mb-6">
              Bạn có chắc chắn muốn xóa người dùng {deleteModal.userName || 'này'}?
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={cancelDelete}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
              >
                Hủy
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md"
              >
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 pt-12 pb-6 sm:px-0">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center space-x-4">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">Quản lý người dùng</h1>
            </div>
          </div>
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-900 uppercase tracking-wider">
                    STT
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                    Người dùng
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                    <select
                      value={roleFilter}
                      onChange={(e) => setRoleFilter(e.target.value)}
                      className="text-xs font-medium text-black uppercase tracking-wider bg-transparent border-none focus:ring-0 focus:border-none cursor-pointer text-gray-900 inline-block"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value="all" className="text-gray-900">Tất cả</option>
                      <option value="admin" className="text-gray-900">Admin</option>
                      <option value="user" className="text-gray-900">User</option>
                    </select>
                  </th>
                  <th className="px-6 py-3  uppercase ">
                    <select
                      value={timeFilter}
                      onChange={(e) => setTimeFilter(e.target.value)}
                      className="text-xs font-medium text-black uppercase bg-transparent inline-block p-0 m-0 leading-none focus:border-none border-none outline-none cursor-pointer text-gray-900"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value="all" className="text-gray-900">Ngày tạo</option>
                      <option value="week" className="text-gray-900">Tuần trước</option>
                      <option value="month" className="text-gray-900">Tháng trước</option>
                    </select>
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-900 uppercase tracking-wider">
                    Xóa
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedUsers.map((user, index) => (
                  <tr key={user.uid} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-sm text-gray-900">{index + 1}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          {user.photoURL ? (
                            <img
                              className="h-10 w-10 rounded-full"
                              src={user.photoURL}
                              alt="User avatar"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center text-gray-800 font-semibold text-sm">
                              {(user.displayName || user.email || '').charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {user.displayName || 'Chưa có tên'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{user.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div 
                        className={`text-sm px-3 py-1 rounded-full cursor-pointer inline-block ${
                          user.isAdmin 
                            ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                            : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                        }`}
                        onClick={() => handleToggleAdmin(user.uid, !user.isAdmin, user.displayName || user.email)}
                      >
                        {user.isAdmin ? 'Admin' : 'User'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-sm text-gray-900">
                        {formatDateTime(user.lastSignInTimestamp)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button
                        onClick={() => setDeleteModal({ show: true, userId: user.uid, userName: user.displayName || user.email })}
                        className="text-red-600 hover:text-red-900"
                      >
                        Xóa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPage;