// 2.50.0
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { PageStateProvider } from "./context/PageStateContext";
import WelcomeModal from "./user/components/WelcomeModal";
import UserRoutes from "./routes/UserRoutes";
import AdminRoutes from "./routes/AdminRoutes";

function App() {
  return (
    <Router>
      <AuthProvider>
        <PageStateProvider>
          <div className="overflow-hidden">
            <WelcomeModal />
            <Routes>
              <Route path="/admin/*" element={<AdminRoutes />} />
              <Route path="/*" element={<UserRoutes />} />
            </Routes>
          </div>
        </PageStateProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
