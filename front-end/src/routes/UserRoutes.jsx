import { Routes, Route, Navigate } from "react-router-dom";
import HomePage from "../user/pages/HomePage";
import FAQPage from "../user/pages/FAQPage";
import IssuePage from "../user/pages/IssuePage";
import Login from "../user/auth/Login";
import Register from "../user/auth/Register";
import ForgotPassword from "../user/auth/ForgotPassword";
import SettingsButton from "../user/components/Settings";
import Profile from "../user/components/Profile";
import PrivateRoute from "../user/components/PrivateRoute";
import ChatBot from "../user/components/ChatBot";
import SharedChat from "../user/components/SharedChat";
import UserLayout from "../user/layouts/UserLayout";

const UserRoutes = () => {
  return (
    <Routes>
      <Route element={<UserLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/chat" element={<ChatBot />} />
        <Route path="/shared-chat/:shareId" element={<SharedChat />} />
        <Route path="/issue" element={<IssuePage />} />
        <Route path="/faq" element={<FAQPage />} />
        <Route path="/settings" element={<SettingsButton />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route 
          path="/profile" 
          element={
            <PrivateRoute>
              <Profile />
            </PrivateRoute>
          } 
        />
        <Route path="*" element={<Navigate to="/" />} />
      </Route>
    </Routes>
  );
};

export default UserRoutes; 