// src/App.jsx
import React, { Suspense, lazy } from 'react'; // 👈 1. 引入 Suspense 和 lazy
import { Routes, Route, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckSquare, ArrowLeft } from 'lucide-react';
import { Toaster } from 'react-hot-toast';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { QuizProvider, useQuiz } from './contexts/QuizContext';
import PageLoader from './components/PageLoader';
import AdminAuthWrapper from './components/AdminAuthWrapper';

// ❌ 移除舊的靜態引入 (這樣會導致所有頁面一次載入)
// import HomeView from './views/HomeView';
// import AdminPanel from './views/AdminPanel';
// import SurveyTaker from './views/SurveyTaker';
// import ResultView from './views/ResultView';
// import StatsDashboard from './views/StatsDashboard';

// ✅ 2. 改用 Lazy Loading (動態引入)
// 只有當使用者切換到該路由時，瀏覽器才會去下載那個檔案
const HomeView = lazy(() => import('./views/HomeView'));
const AdminPanel = lazy(() => import('./views/AdminPanel'));
const SurveyTaker = lazy(() => import('./views/SurveyTaker'));
const ResultView = lazy(() => import('./views/ResultView'));
const StatsDashboard = lazy(() => import('./views/StatsDashboard'));

const pageVariants = {
  initial: { opacity: 0, y: 20, scale: 0.98 },
  in: { opacity: 1, y: 0, scale: 1 },
  out: { opacity: 0, y: -20, scale: 0.98 }
};

const pageTransition = {
  type: "tween",
  ease: "anticipate",
  duration: 0.4
};

function PageWrapper({ children }) {
  return (
    <motion.div
      initial="initial"
      animate="in"
      exit="out"
      variants={pageVariants}
      transition={pageTransition}
      className="w-full"
    >
      {children}
    </motion.div>
  );
}

function AppContent() {
  const { user, loading } = useAuth();
  const { quizData, responses, isSubmitting, myResult, saveQuiz, submitResponse, deleteResponse } = useQuiz();
  
  const navigate = useNavigate();
  const location = useLocation();

  if (loading) return <PageLoader text="正在驗證身份..." />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 text-gray-800 font-sans print:bg-white overflow-x-hidden">
      <header className="bg-white/80 backdrop-blur-md shadow-sm sticky top-0 z-20 border-b border-slate-200 print:hidden">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => !isSubmitting && navigate('/')}>
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
            {location.pathname !== '/' && !isSubmitting && (
              <button onClick={() => navigate('/')} className="flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600 transition-colors font-medium">
                <ArrowLeft size={16} /> 返回大廳
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 print:p-0 print:max-w-none relative">
        {/* ✅ 3. 加入 Suspense 保護罩 */}
        {/* 當 lazy 的組件還在下載時，顯示 fallback 裡面的內容 (這裡復用我們的 PageLoader) */}
        <Suspense fallback={<PageLoader text="載入頁面模組中..." />}>
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              
              <Route path="/" element={
                <PageWrapper>
                  <HomeView quizTitle={quizData.title} responseCount={responses.length} isAdmin={true} />
                </PageWrapper>
              } />

              <Route path="/admin" element={
                <AdminAuthWrapper user={user} onCancel={() => navigate('/')}>
                  <PageWrapper>
                    <AdminPanel 
                      initialData={quizData} 
                      onSave={saveQuiz} 
                      isSubmitting={isSubmitting} 
                      responses={responses} 
                      onDeleteResponse={deleteResponse}
                    />
                  </PageWrapper>
                </AdminAuthWrapper>
              } />

              <Route path="/survey" element={
                <PageWrapper>
                  <SurveyTaker quizData={quizData} onSubmit={submitResponse} onCancel={() => navigate('/')} isSubmitting={isSubmitting} />
                </PageWrapper>
              } />

              <Route path="/result" element={
                myResult ? (
                  <PageWrapper>
                    <ResultView quizData={quizData} userAnswers={myResult.answers} stats={myResult.stats} totalTime={myResult.totalTime} nickname={myResult.nickname}
                    inputEmail={myResult.inputEmail} onBack={() => navigate('/')} />
                  </PageWrapper>
                ) : <Navigate to="/" replace />
              } />

              <Route path="/stats" element={
                 <PageWrapper>
                   <StatsDashboard quizData={quizData} responses={responses} />
                 </PageWrapper>
              } />
              
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AnimatePresence>
        </Suspense>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <QuizProvider>
        <AppContent />
        <Toaster 
          position="top-center" 
          toastOptions={{
            duration: 3000,
            style: { background: '#333', color: '#fff', borderRadius: '10px' },
          }} 
        />
      </QuizProvider>
    </AuthProvider>
  );
}