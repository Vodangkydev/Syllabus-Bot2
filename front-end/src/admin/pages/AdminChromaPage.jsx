import { useState, useEffect } from "react";
import { IoClose } from "react-icons/io5";
import { useNavigate } from "react-router-dom";
import { getAuth } from "firebase/auth";

function AdminChromaPage() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadMessage, setUploadMessage] = useState(null);
  const navigate = useNavigate();
  const auth = getAuth();

  useEffect(() => {
    // Check if user is admin
    const user = auth.currentUser;
    if (!user) {
      navigate("/login");
      return;
    }

    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error("User not authenticated");
      }
      
      const token = await user.getIdToken();
      const response = await fetch("http://localhost:8000/admin/documents", {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to fetch documents");
      }
      
      const data = await response.json();
      setDocuments(data.documents);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Get just the filename without the path
      const filename = file.name.split('\\').pop().split('/').pop();
      setSelectedFile(new File([file], filename, { type: file.type }));
      setUploadMessage(null); // Clear any previous messages
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError("Vui lòng chọn file trước");
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError(null);
    setUploadMessage(null);

    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error("User not authenticated");
      }

      const token = await user.getIdToken();
      const formData = new FormData();
      formData.append("file", selectedFile);

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 200);

      const response = await fetch("http://localhost:8000/admin/upload", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        },
        body: formData
      });

      clearInterval(progressInterval);

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || "Failed to upload file");
      }

      setUploadProgress(100);
      setUploadMessage({
        type: "success",
        message: data.message
      });
      
      // Refresh document list
      await fetchDocuments();
      
      // Reset file selection
      setSelectedFile(null);
      document.getElementById("fileInput").value = "";
      
    } catch (err) {
      setError(err.message);
      setUploadMessage({
        type: "error",
        message: err.message
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      fetchDocuments();
      return;
    }

    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error("User not authenticated");
      }
      
      const token = await user.getIdToken();
      const response = await fetch(`http://localhost:8000/admin/search?q=${encodeURIComponent(searchQuery)}`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to search documents");
      }
      
      const data = await response.json();
      setDocuments(data.documents);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (source) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa tài liệu này?")) {
      return;
    }

    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error("User not authenticated");
      }
      
      const token = await user.getIdToken();
      const response = await fetch(`http://localhost:8000/admin/delete?source=${encodeURIComponent(source)}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to delete document");
      }
      
      // Refresh the document list
      fetchDocuments();
    } catch (err) {
      setError(err.message);
    }
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
            Quản lý Chroma
          </h1>
          {/* Upload Section */}
          <div className="mb-6 bg-white rounded-lg shadow-lg p-6 w-full">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Upload Tài liệu
            </h2>
            <div className="flex flex-col gap-4">
              <div className="flex gap-4 items-center">
                <input
                  type="file"
                  id="fileInput"
                  onChange={handleFileSelect}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  accept=".txt,.pdf,.doc,.docx"
                />
                <button
                  onClick={handleUpload}
                  disabled={!selectedFile || uploading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400"
                >
                  {uploading ? 'Đang upload...' : 'Upload'}
                </button>
              </div>
              {selectedFile && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>File đã chọn: {selectedFile.name}</span>
                  <button
                    onClick={() => {
                      setSelectedFile(null);
                      document.getElementById("fileInput").value = "";
                    }}
                    className="text-red-500 hover:text-red-700"
                  >
                    <IoClose size={20} />
                  </button>
                </div>
              )}
              {uploading && (
                <div className="mt-2">
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
              {uploadMessage && (
                <div className={`mt-2 p-3 rounded-lg ${
                  uploadMessage.type === "success" 
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }`}>
                  {uploadMessage.message}
                </div>
              )}
            </div>
          </div>
          {/* Search Section */}
          <form onSubmit={handleSearch} className="mb-6 flex gap-4 w-full">
            <input
              type="text"
              placeholder="Tìm kiếm tài liệu..."
              className="flex-1 px-4 py-2 rounded bg-white text-gray-900 border border-gray-300 focus:outline-none"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Tìm kiếm</button>
          </form>
          {/* Table Section */}
          <div className="bg-white rounded-lg shadow-lg overflow-x-auto w-full">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tên file
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nội dung
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nguồn
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {documents.map((doc, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {doc.filename}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {doc.content}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {doc.source}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <button
                          onClick={() => handleDelete(doc.source)}
                          className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
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

export default AdminChromaPage; 