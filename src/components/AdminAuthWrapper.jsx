import React from 'react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../firebase'; // ⚠️ 注意這裡的路徑，假設 firebase.js 還在 src 根目錄
import { Lock } from 'lucide-react';

const ADMIN_EMAILS = ["alanlai0933.ai@gmail.com", "alanlai0933@gmail.com","coastalcleanup00@gmail.com"];

export default function AdminAuthWrapper({ children, onCancel, user }) {
  const handleLogin = () => signInWithPopup(auth, new GoogleAuthProvider());

  if (!user || !ADMIN_EMAILS.includes(user.email)) {
    return (
      <div className="max-w-md mx-auto bg-white p-10 rounded-3xl shadow-2xl text-center mt-10">
        <Lock className="mx-auto mb-4 text-indigo-600" size={48} />
        <h2 className="text-2xl font-bold mb-8">管理員授權</h2>
        <button onClick={handleLogin} className="w-full py-4 border-2 rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-slate-50 transition-colors">
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6" alt="Google" /> Google 登入
        </button>
        <button onClick={onCancel} className="mt-6 text-gray-400 hover:text-gray-600">返回</button>
      </div>
    );
  }
  return children;
}