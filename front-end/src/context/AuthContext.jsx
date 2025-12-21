// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from "react";
import { auth, signInWithGoogle } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, 
      (user) => {
        console.log("Auth state changed:", user ? { uid: user.uid, email: user.email } : "No user");
        setUser(user);
        setLoading(false);
        setError(null);
      },
      (error) => {
        console.error("Auth state change error:", error);
        setError(error.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  const login = async () => {
    try {
      setError(null);
      const result = await signInWithGoogle();
      console.log("Login successful:", result.user.uid);
      return result;
    } catch (error) {
      console.error("Login error:", error);
      setError(error.message);
      throw error;
    }
  };

  const logout = async () => {
    try {
      setError(null);
      await auth.signOut();
      console.log("Logout successful");
    } catch (error) {
      console.error("Logout error:", error);
      setError(error.message);
      throw error;
    }
  };

  const value = {
    user,
    login,
    logout,
    error,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
