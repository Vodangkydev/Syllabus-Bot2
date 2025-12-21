import { Routes, Route } from "react-router-dom";
import AdminLogin from "../admin/auth/AdminLogin";
import AdminPage from "../admin/pages/AdminPage";
import AdminFeedbackPage from "../admin/pages/AdminFeedbackPage";
import AdminAnalysisPage from "../admin/pages/AdminAnalysisPage";
import AdminChromaPage from "../admin/pages/AdminChromaPage";
import AdminLayout from "../admin/layouts/AdminLayout";
import AdminPrivateRoute from "../admin/components/AdminPrivateRoute";

const AdminRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<AdminLogin />} />
      <Route element={
        <AdminPrivateRoute>
          <AdminLayout />
        </AdminPrivateRoute>
      }>
        {/* Management */}
        <Route path="/dashboard" element={<AdminPage />} />
        <Route path="/feedbacks" element={<AdminFeedbackPage />} />
        <Route path="/analysis" element={<AdminAnalysisPage />} />
        <Route path="/chroma" element={<AdminChromaPage />} />
      </Route>
    </Routes>
  );
};

export default AdminRoutes; 