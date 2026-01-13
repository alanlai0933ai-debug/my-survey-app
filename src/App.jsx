import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { onAuthStateChanged, signInWithCustomToken, signInAnonymously } from 'firebase/auth';
import { doc, onSnapshot, collection, query, orderBy, setDoc, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase'; // 請確認 firebase.js 路徑
import { CheckSquare, ArrowLeft } from 'lucide-react';

// ✅ 引入剛剛拆分好的頁面與組件
import HomeView from './views/HomeView';
import AdminPanel from './views/AdminPanel'; // 假設您已經有這個了
import SurveyTaker from './views/SurveyTaker';
import ResultView from './views/ResultView';
import StatsDashboard from './views/StatsDashboard';
import AdminAuthWrapper from './components/AdminAuthWrapper';

const appId = typeof __app_id !== 'undefined' ? __app_id : 'my-survey-app';
const QUIZ_ID = 'global_shared_quiz_v2';

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('home'); 
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quizData, setQuizData] = useState({ title: "未命名問卷", questions: [] });
  const [responses, setResponses] = useState([]);
  const [myResult, setMyResult] = useState(null);

  // 1. Auth 初始化
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

  // 2. 監聽問卷資料
  useEffect(() => {
    const quizRef = doc(db, 'artifacts', appId, 'public', 'data', 'quizzes', QUIZ_ID);
    return onSnapshot(quizRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setQuizData({ ...data, questions: data.questions || [] });
      } else {
        setQuizData({ title: "新問卷 (v2)", questions: [] });
      }
    });
  }, []);

  // 3. 監聽回應資料 (僅用於 Admin 或 Stats)
  useEffect(() => {
    if (!user) { setResponses([]); return; }
    // 這裡可以優化：只有在 view === 'admin' 或 'stats' 時才監聽，節省流量
    const ref = collection(db, 'artifacts', appId, 'public', 'data', `responses_${QUIZ_ID}`);
    return onSnapshot(query(ref, orderBy('submittedAt', 'desc')), (snap) => {
      const data = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() }));
      setResponses(data);
    });
  }, [user]);

  // Actions
  const handleSaveQuiz = async (data) => {
    if(isSubmitting) return;
    setIsSubmitting(true);
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'quizzes', QUIZ_ID), data);
      alert("問卷已發布！(已使用雲端圖片儲存)");
      setView('home');
    } catch (e) { 
      alert("儲存失敗: " + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitResponse = async (ans, nickname, inputEmail, statsData, totalTime) => {
    if(isSubmitting) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', `responses_${QUIZ_ID}`), {
        answers: ans, 
        submittedAt: serverTimestamp(), 
        userId: user?.uid || 'anonymous', 
        userEmail: user?.email || 'anonymous',
        inputEmail: inputEmail,
        nickname: nickname,
        stats: statsData,
        totalTime: totalTime
      });
      setMyResult({ answers: ans, stats: statsData, totalTime: totalTime });
      setView('result');
    } catch (e) { 
      alert("提交失敗：" + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteResponse = async (responseId) => {
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', `responses_${QUIZ_ID}`, responseId));
    } catch (error) {
      alert("刪除失敗：" + error.message);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400 font-bold tracking-wider">系統載入中...</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 text-gray-800 font-sans print:bg-white overflow-x-hidden">
      <header className="bg-white/80 backdrop-blur-md shadow-sm sticky top-0 z-20 border-b border-slate-200 print:hidden">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => !isSubmitting && setView('home')}>
            <div className="bg-indigo-600 text-white p-2.5 rounded-xl shadow-lg shadow-indigo-200 group-hover:scale-110 transition-transform">
              <CheckSquare size={22} />
            </div>
            <h1 className="text-xl font-extrabold text-indigo-700 tracking-tight">互動挑戰實驗室</h1>
          </div>
          <div className="flex items-center gap-4">
            {user?.email ? (
               <span className="text-xs text-slate-500 font-medium bg-slate-100 px-3 py-1 rounded-full border border-slate-200">User: {user.email}</span>
            ) : (
               <span className="text-xs text-slate-500 font-medium bg-slate-100 px-3 py-1 rounded-full border border-slate-200">訪客模式</span>
            )}
            {view !== 'home' && !isSubmitting && (
              <button onClick={() => setView('home')} className="flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600 transition-colors font-medium">
                <ArrowLeft size={16} /> 返回大廳
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 print:p-0 print:max-w-none relative">
        <AnimatePresence mode="wait">
          {view === 'home' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <HomeView quizTitle={quizData.title} responseCount={responses.length} onNavigate={setView} isAdmin={true} />
            </motion.div>
          )}
          {view === 'admin' && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }}>
              <AdminAuthWrapper user={user} onCancel={() => setView('home')}>
                <AdminPanel 
                  initialData={quizData} 
                  onSave={handleSaveQuiz} 
                  isSubmitting={isSubmitting} 
                  responses={responses} 
                  onDeleteResponse={handleDeleteResponse}
                />
              </AdminAuthWrapper>
            </motion.div>
          )}
          {view === 'survey' && (
             <motion.div className="h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <SurveyTaker quizData={quizData} onSubmit={handleSubmitResponse} onCancel={() => setView('home')} isSubmitting={isSubmitting} />
            </motion.div>
          )}
          {view === 'result' && (
            <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }}>
              <ResultView quizData={quizData} userAnswers={myResult?.answers} stats={myResult?.stats} totalTime={myResult?.totalTime} onBack={() => setView('home')} />
            </motion.div>
          )}
          {view === 'stats' && (
            <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }}>
               <StatsDashboard quizData={quizData} responses={responses} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}