import { useState, useEffect, useRef } from "react";
import { IoClose } from "react-icons/io5";
import { useNavigate } from "react-router-dom";
import { getAuth } from "firebase/auth";
import { FaSyncAlt } from "react-icons/fa";

function AdminAnalysisPage() {
  const [analysis, setAnalysis] = useState(() => {
    // Try to get cached data from localStorage
    const cachedData = localStorage.getItem('analysisData');
    return cachedData ? JSON.parse(cachedData) : { top_questions: [] };
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showImage, setShowImage] = useState(false); // State to manage image visibility
  const navigate = useNavigate();
  const auth = getAuth();

  useEffect(() => {
    // Check if user is admin
    const user = auth.currentUser;
    if (!user) {
      navigate("/login");
      return;
    }
  }, []);

  const fetchAnalysis = async () => {
    try {
      setLoading(true);
      const user = auth.currentUser;
      if (!user) {
        throw new Error("User not authenticated");
      }
      
      const token = await user.getIdToken();
      console.log("Fetching analysis data...");
      const response = await fetch("http://localhost:8000/admin/analysis", {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error response:", errorData);
        throw new Error(errorData.detail || "Failed to fetch analysis");
      }
      
      const data = await response.json();
      console.log("Received data:", data);
      
      // Validate response format
      if (!data || typeof data !== 'object') {
        throw new Error("Invalid response: not an object");
      }
      
      if (!Array.isArray(data.top_questions)) {
        throw new Error("Invalid response: top_questions is not an array");
      }
      
      // Validate each question object
      const validQuestions = data.top_questions.every(q => 
        q && 
        typeof q === 'object' && 
        typeof q.question === 'string' && 
        typeof q.count === 'number'
      );
      
      if (!validQuestions) {
        throw new Error("Invalid response: questions have incorrect format");
      }
      
      // Cache the data in localStorage
      localStorage.setItem('analysisData', JSON.stringify(data));
      setAnalysis(data);
    } catch (err) {
      console.error("Error in fetchAnalysis:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleImage = () => {
    setShowImage(!showImage);
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
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 pt-12 pb-6 sm:px-0">
          <h1 className="text-3xl font-bold mb-6 text-gray-900">
              Phân tích câu hỏi người dùng
              </h1>
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="overflow-x-auto">
          {/* Top Questions Table */}
          <div className="mt-8 bg-white rounded-lg shadow-lg overflow-hidden w-full">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-semibold m-0 text-gray-900">
                Top 20 câu hỏi phổ biến nhất
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={fetchAnalysis}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
                >
                  <FaSyncAlt className="mr-2" />
                  Cập nhật dữ liệu
                </button>
                <button
                  onClick={toggleImage}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                >
                  {showImage ? 'Ẩn Biểu đồ' : 'Hiển thị Biểu đồ'}
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      STT
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Câu hỏi
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Số lần xuất hiện
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-900 uppercase tracking-wider">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {analysis.top_questions && analysis.top_questions.map((item, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {index + 1}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {item.question}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                        {item.count}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-center">
                        <button className="text-red-600 hover:text-red-900 transition-colors">Xóa</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

           {/* Image Container */}
          {showImage && (
            <div className="mt-4 mb-8 bg-white rounded-lg shadow-lg p-6 w-full">
              <h2 className="text-xl font-semibold mb-4 text-gray-900">
                Biểu đồ phân tích
              </h2>
              <div className="aspect-w-16 aspect-h-9">
                <img
                  src={`http://localhost:8000/static/top_questions.png?t=${new Date().getTime()}`} // Append timestamp to prevent caching
                  alt="Top Questions Visualization"
                  className="object-contain w-full h-full"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </div>
    </div>
  );
}

export default AdminAnalysisPage; 