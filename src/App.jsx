import React from 'react';
import { Routes, Route, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion'; // ✅ 補上 motion
import { CheckSquare, ArrowLeft } from 'lucide-react';

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

// ✅ 1. 引入剛剛做好的全域載入元件
import PageLoader from './components/PageLoader';

// ✅ 2. 定義統一的轉場動畫參數 (絲滑切換的關鍵)
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

// ✅ 3. 建立包裝器：讓每個頁面自動套用動畫
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

  // ✅ 4. 使用漂亮的 PageLoader 取代純文字
  if (loading) return <PageLoader text="正在驗證身份..." />;

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
          {/* ✅ 5. 這裡加上 location 與 key，觸發路由切換動畫 */}
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
                  <ResultView quizData={quizData} userAnswers={myResult.answers} stats={myResult.stats} totalTime={myResult.totalTime} onBack={() => navigate('/')} />
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