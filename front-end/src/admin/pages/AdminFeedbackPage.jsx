import { useState, useEffect } from "react";
import API_URL from '../../config/api';
import { IoClose } from "react-icons/io5";
import { useNavigate } from "react-router-dom";
import { getAuth } from "firebase/auth";

// Helper function to format timestamp
const formatTimestamp = (timestamp) => {
  if (!timestamp) return 'N/A';
  const date = new Date(timestamp);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Month is 0-indexed
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
};

function AdminFeedbackPage() {
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeFilter, setTimeFilter] = useState('most_recent');
  const navigate = useNavigate();
  const auth = getAuth();

  useEffect(() => {
    // Check if user is admin
    const user = auth.currentUser;
    if (!user) {
      navigate("/login");
      return;
    }

    // TODO: Add admin check here
    fetchFeedbacks();
  }, [timeFilter]);

  
const fetchFeedbacks = async () => {  try {    setLoading(true);    const user = auth.currentUser;    if (!user) throw new Error("User not authenticated");    const token = await user.getIdToken();    const response = await fetch(`${API_URL}/admin/feedbacks`, {      headers: { "Authorization": `Bearer ${token}` }    });    const contentType = response.headers.get("content-type") || "";    if (!response.ok) {      if (contentType.includes("application/json")) {        const errorData = await response.json();        throw new Error(errorData.detail || "Failed to fetch feedbacks");      } else {        const text = await response.text();        throw new Error("Không nhận được JSON từ backend:\n" + text);      }    }    if (contentType.includes("application/json")) {      const data = await response.json();      let sortedFeedbacks = data.feedbacks.sort((a, b) => {        const dateA = new Date(a.timestamp || a.created_at);        const dateB = new Date(b.timestamp || b.created_at);        return dateB - dateA;      });      if (timeFilter === 'last_week') {        const now = new Date();        const startOfLastWeek = new Date(now);        startOfLastWeek.setDate(now.getDate() - now.getDay() - 7);        startOfLastWeek.setHours(0, 0, 0, 0);        const endOfLastWeek = new Date(startOfLastWeek);        endOfLastWeek.setDate(startOfLastWeek.getDate() + 6);        endOfLastWeek.setHours(23, 59, 59, 999);        sortedFeedbacks = sortedFeedbacks.filter(feedback => {          const feedbackDate = new Date(feedback.timestamp || feedback.created_at);          return feedbackDate >= startOfLastWeek && feedbackDate <= endOfLastWeek;        });      } else if (timeFilter === 'last_month') {        const now = new Date();        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);        sortedFeedbacks = sortedFeedbacks.filter(feedback => {          const feedbackDate = new Date(feedback.timestamp || feedback.created_at);          return feedbackDate >= startOfLastMonth && feedbackDate <= endOfLastMonth;        });      }      setFeedbacks(sortedFeedbacks);    }  } catch (err) {    setError(err.message);  } finally {    setLoading(false);  }};


  const updateStatus = async (feedbackId, newStatus) => {
    try {
      setLoading(true);
      const user = auth.currentUser;
      if (!user) {
        throw new Error("User not authenticated");
      }
      
      const token = await user.getIdToken();
      const response = await fetch(`${API_URL}/admin/feedbacks/${feedbackId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus }),
      });
      const contentType = response.headers.get("content-type") || "";
      if (!response.ok) {
        if (contentType.includes("application/json")) {
          const errorData = await response.json();
          throw new Error(errorData.detail || "Failed to update status");
        } else {
          const text = await response.text();
          throw new Error("Không nhận được JSON từ backend:\n" + text);
        }
      }

      // Refresh feedbacks after update
      await fetchFeedbacks();
    } catch (err) {
      setError(err.message);
      // Reset error after 3 seconds
      setTimeout(() => setError(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  const deleteFeedback = async (feedbackId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa góp ý này?')) {
      return;
    }

    try {
      setLoading(true);
      const user = auth.currentUser;
      if (!user) {
        throw new Error("User not authenticated");
      }
      
      const token = await user.getIdToken();
      const response = await fetch(`${API_URL}/admin/feedbacks/${feedbackId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to delete feedback");
      }

      // Refresh feedbacks after delete
      await fetchFeedbacks();
    } catch (err) {
      setError(err.message);
      // Reset error after 3 seconds
      setTimeout(() => setError(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "approved":
        return "bg-emerald-100 text-emerald-800 border border-emerald-200";
      case "rejected":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case "pending":
        return "Đang xử lý";
      case "approved":
        return "Đã duyệt";
      case "rejected":
        return "Từ chối";
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-red-500 bg-red-100 p-4 rounded-lg shadow-lg">
          <p className="font-bold">Error:</p>
          <p>{error}</p>
          <button 
            className="mt-2 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            onClick={() => setError(null)}
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 pt-12 pb-6 sm:px-0">
          <h1 className="text-3xl font-bold mb-6 text-gray-900">
            Quản lý góp ý
          </h1>
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                      Nội dung
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                      <div className="flex items-center">
                        <select
                          className="ml-2 text-xs text-gray-900 uppercase tracking-wider bg-transparent border-none "
                          value={timeFilter}
                          onChange={(e) => setTimeFilter(e.target.value)}
                        >
                          <option value="most_recent">Gần nhất</option>
                          <option value="last_week">Tuần trước</option>
                          <option value="last_month">Tháng trước</option>
                        </select>
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                      Trạng thái
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                      Cập nhật trạng thái
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-900 uppercase tracking-wider">
                      Xóa
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {feedbacks.map((feedback) => (
                    <tr key={feedback.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {feedback.user_email}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {feedback.content || feedback.message}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatTimestamp(feedback.updated_at || feedback.timestamp || feedback.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                            feedback.status
                          )}`}
                        >
                          {getStatusText(feedback.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <select
                          className="bg-white border border-gray-300 rounded-md px-2 py-1 text-sm text-gray-900"
                          value={feedback.status}
                          onChange={(e) => updateStatus(feedback.id, e.target.value)}
                        >
                          <option value="pending" className="text-gray-900">Đang xử lý</option>
                          <option value="approved" className="text-gray-900">Đã duyệt</option>
                          <option value="rejected" className="text-gray-900">Từ chối</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => deleteFeedback(feedback.id)}
                          className="text-red-600 hover:text-red-900 font-medium"
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
    </div>
  );
}

export default AdminFeedbackPage; 