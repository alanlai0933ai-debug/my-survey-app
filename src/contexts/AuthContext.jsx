import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signInWithCustomToken, 
  signInAnonymously,
  signInWithPopup,
  GoogleAuthProvider
} from 'firebase/auth';
import { auth } from '../firebase'; // 請確認路徑

// 1. 建立 Context
const AuthContext = createContext();

// 2. 建立 Provider (基地台)
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // 初始化監聽
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth Init Error:", error);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 提供給外部的登入功能
  const loginAdmin = () => signInWithPopup(auth, new GoogleAuthProvider());

  const value = {
    user,
    loading,
    loginAdmin,
    isAdmin: user && ["alanlai0933.ai@gmail.com", "alanlai0933@gmail.com","coastalcleanup00@gmail.com"].includes(user.email) // 這裡可以集中管理管理員邏輯
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

// 3. 建立自定義 Hook (接收器)
export function useAuth() {
  return useContext(AuthContext);
}