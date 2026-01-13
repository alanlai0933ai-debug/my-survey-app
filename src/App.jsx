import React from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { CheckSquare, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// 引入 Providers
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { QuizProvider, useQuiz } from './contexts/QuizContext';

// 引入 Views
import HomeView from './views/HomeView';
import AdminPanel from './views/AdminPanel';
import SurveyTaker from './views/SurveyTaker';
import ResultView from './views/ResultView';
import StatsDashboard from './views/StatsDashboard';
import AdminAuthWrapper from './components/AdminAuthWrapper';

// 👇 我們建立一個內部組件來處理 Header 和 Routing，因為它們需要用到 Context
function AppContent() {
  const { user, loading } = useAuth();
  const { quizData, responses, isSubmitting, myResult, saveQuiz, submitResponse, deleteResponse } = useQuiz();
  
  const navigate = useNavigate();
  const location = useLocation();

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400 font-bold tracking-wider">系統載入中...</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 text-gray-800 font-sans print:bg-white overflow-x-hidden">
      {/* Header */}
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
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            {/* 👇 注意：這裡的 Props 大幅減少了！很多組件其實可以直接進去自己 call hook，但為了相容現有寫法，我們先傳進去 */}
            <Route path="/" element={
              <HomeView quizTitle={quizData.title} responseCount={responses.length} isAdmin={true} />
            } />

            <Route path="/admin" element={
              <AdminAuthWrapper user={user} onCancel={() => navigate('/')}>
                <AdminPanel 
                  initialData={quizData} 
                  onSave={saveQuiz} 
                  isSubmitting={isSubmitting} 
                  responses={responses} 
                  onDeleteResponse={deleteResponse}
                />
              </AdminAuthWrapper>
            } />

            <Route path="/survey" element={
              <SurveyTaker quizData={quizData} onSubmit={submitResponse} onCancel={() => navigate('/')} isSubmitting={isSubmitting} />
            } />

            <Route path="/result" element={
              myResult ? (
                <ResultView quizData={quizData} userAnswers={myResult.answers} stats={myResult.stats} totalTime={myResult.totalTime} onBack={() => navigate('/')} />
              ) : <Navigate to="/" replace />
            } />

            <Route path="/stats" element={
               <StatsDashboard quizData={quizData} responses={responses} />
            } />
            
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AnimatePresence>
      </main>
    </div>
  );
}

// 主入口：負責包裹 Context
export default function App() {
  return (
    <AuthProvider>
      <QuizProvider>
        <AppContent />
      </QuizProvider>
    </AuthProvider>
  );
}