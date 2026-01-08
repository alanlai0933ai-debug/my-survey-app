import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  signInWithCustomToken,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { 
  LayoutDashboard, 
  Edit3, 
  BarChart3, 
  CheckSquare, 
  Plus, 
  Trash2, 
  Save, 
  Image as ImageIcon, 
  Share2, 
  ArrowLeft,
  CheckCircle,
  Users,
  Download,
  Lock,
  Upload,
  AlertCircle,
  LogOut,
  ShieldAlert
} from 'lucide-react';

// --- 1. Firebase 初始化 ---
// ⚠️ 注意：在本地端 (VS Code) 開發時，請將下方的 config 換回您自己的設定 (icc-test)
// ⚠️ 否則在 localhost 可能會無法連線
let firebaseConfig;
try {
  firebaseConfig = JSON.parse(__firebase_config);
} catch (e) {
  // 本地端 fallback (示意用，請填入您真實的 config)
  firebaseConfig = {
  apiKey: "AIzaSyAKCRTN4BWMqpL2e6svx1FLN5RiJIdYRtk", // 這是您專案真實的 Key
  authDomain: "icc-test-4286c.firebaseapp.com",
  projectId: "icc-test-4286c",
  storageBucket: "icc-test-4286c.firebasestorage.app",
  messagingSenderId: "353118805586",
  appId: "1:353118805586:web:dd46d68792746c4b33c98b",
  measurementId: "G-J3L4C7B70P"
  };
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
// ⚠️ 在本地端請將 appId 改為固定字串，例如: const appId = 'my-survey-app';
const appId = 'my-survey-app';

// --- 安全設定 ---
const QUIZ_ID = 'global_shared_quiz'; 
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

// 🛡️ 管理員白名單：請在此輸入允許進入後台的 Google Email
const ADMIN_EMAILS = [
  "your.email@gmail.com", // <--- 請修改這裡為您的 Email
  "admin@example.com"
];

// --- 2. 輔助函數 ---

// 圖片壓縮轉 Base64
const compressImage = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 500; 
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

// 匯出 CSV (支援繁體中文 BOM)
const exportToCSV = (quizData, responses) => {
  const headers = ['提交時間', '使用者ID', 'Email (若有)'];
  quizData.questions.forEach((q, idx) => {
    headers.push(`Q${idx + 1}: ${q.text}`);
  });

  const rows = responses.map(r => {
    const date = r.submittedAt ? new Date(r.submittedAt.seconds * 1000).toLocaleString('zh-TW') : 'N/A';
    const email = r.userEmail || 'Anonymous';
    const rowData = [date, r.userId || 'Unknown', email];
    
    quizData.questions.forEach(q => {
      let ans = r.answers[q.id];
      if (Array.isArray(ans)) ans = ans.join('; ');
      if (!ans) ans = '';
      rowData.push(`"${String(ans).replace(/"/g, '""')}"`);
    });
    return rowData.join(',');
  });

  const csvContent = '\uFEFF' + headers.join(',') + '\n' + rows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `問卷結果_${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// --- 3. 主要 App 元件 ---
export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('home'); 
  const [loading, setLoading] = useState(true);
  
  const [quizData, setQuizData] = useState({ title: "未命名問卷", questions: [] });
  const [responses, setResponses] = useState([]);

  // --- Auth & Data 監聽 ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        // 在預覽環境使用 Token，在本地端若無 token 則保持未登入狀態等待使用者操作
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          // 本地端不自動匿名登入，讓使用者自己選擇登入方式 (Admin 用 Google，User 用匿名或直接填寫)
          // 若需 User 匿名填寫，可在 SurveyTaker 內處理
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth error:", error);
      }
    };
    initAuth();

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) setLoading(false);
    });

    return () => unsubscribeAuth();
  }, []);

  // 讀取問卷資料
  useEffect(() => {
    // 允許未登入讀取 (取決於 Firestore Rules，通常公開資料 public 設為 allow read)
    const quizRef = doc(db, 'artifacts', appId, 'public', 'data', 'quizzes', QUIZ_ID);
    const unsubscribeQuiz = onSnapshot(quizRef, (docSnap) => {
      if (docSnap.exists()) {
        setQuizData(docSnap.data());
      } else {
        const defaultQuiz = {
          title: "新問卷調查",
          description: "請填寫問卷描述",
          questions: []
        };
        // 只有 Admin 能寫入，這裡僅做防呆，實際寫入需靠 AdminPanel
        setQuizData(defaultQuiz);
      }
      setLoading(false);
    }, (error) => console.error("Quiz fetch error:", error));
    return () => unsubscribeQuiz();
  }, []);

  // 讀取回覆資料
  useEffect(() => {
    const responsesRef = collection(db, 'artifacts', appId, 'public', 'data', `responses_${QUIZ_ID}`);
    const q = query(responsesRef);
    const unsubscribeResponses = onSnapshot(q, (snapshot) => {
      const loadedResponses = [];
      snapshot.forEach(doc => {
        loadedResponses.push({ id: doc.id, ...doc.data() });
      });
      setResponses(loadedResponses);
    }, (error) => console.error("Responses fetch error:", error));
    return () => unsubscribeResponses();
  }, []);

  // --- 操作處理 ---
  const handleSaveQuiz = async (newQuizData) => {
    if (!user) {
      alert("請先登入");
      return;
    }
    // 二重驗證：前端再次檢查 Email
    if (!ADMIN_EMAILS.includes(user.email)) {
      alert("您沒有權限儲存變更");
      return;
    }

    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'quizzes', QUIZ_ID), newQuizData);
      alert("問卷已儲存並發布！");
      setView('home');
    } catch (error) {
      console.error("Save error:", error);
      alert("儲存失敗，請檢查權限或網路。");
    }
  };

  const handleSubmitResponse = async (answers) => {
    // 提交問卷不需要特定權限，匿名使用者也可
    const submitUser = auth.currentUser; 
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', `responses_${QUIZ_ID}`), {
        answers,
        submittedAt: serverTimestamp(),
        userId: submitUser ? submitUser.uid : 'anonymous',
        userEmail: submitUser && submitUser.email ? submitUser.email : 'anonymous'
      });
      alert("感謝您的填寫！");
      setView('home');
    } catch (error) {
      console.error("Submit error:", error);
      alert("提交失敗，請重試。");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-12 w-12 bg-blue-200 rounded-full mb-4"></div>
          系統連線中...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 text-gray-800 font-sans">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
          <div 
            className="flex items-center gap-2 cursor-pointer" 
            onClick={() => setView('home')}
          >
            <div className="bg-blue-600 text-white p-2 rounded-lg">
              <CheckSquare size={20} />
            </div>
            <h1 className="text-xl font-bold text-gray-800 hidden sm:block">雲端問卷大師</h1>
          </div>
          
          <div className="flex items-center gap-2">
            {user && user.email && (
               <span className="text-xs text-gray-500 hidden sm:block">
                 已登入: {user.email}
               </span>
            )}
            {view !== 'home' && (
              <button 
                onClick={() => setView('home')}
                className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-md transition-colors flex items-center gap-1"
              >
                <ArrowLeft size={16} /> 返回首頁
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {view === 'home' && (
          <HomeView 
            quizTitle={quizData.title} 
            responseCount={responses.length}
            onNavigate={setView} 
          />
        )}
        {view === 'admin' && (
          <AdminAuthWrapper user={user} onCancel={() => setView('home')}>
             <AdminPanel 
              initialData={quizData} 
              onSave={handleSaveQuiz} 
            />
          </AdminAuthWrapper>
        )}
        {view === 'survey' && (
          <SurveyTaker 
            quizData={quizData} 
            onSubmit={handleSubmitResponse}
            onCancel={() => setView('home')}
          />
        )}
        {view === 'stats' && (
          <StatsDashboard 
            quizData={quizData} 
            responses={responses} 
            onBack={() => setView('home')}
          />
        )}
      </main>
    </div>
  );
}

// --- 子元件區塊 ---

// 🛡️ 管理員 Google 驗證元件
function AdminAuthWrapper({ children, onCancel, user }) {
  const [errorMsg, setErrorMsg] = useState("");

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      setErrorMsg(""); 
    } catch (err) {
      console.error(err);
      setErrorMsg("登入失敗: " + err.message);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    // 登出後可能需要重新匿名登入以確保一般功能正常，但在 AdminWrapper 內只要登出即可
  };

  // 1. 尚未登入
  if (!user || !user.email) {
    return (
      <div className="max-w-md mx-auto bg-white p-8 rounded-xl shadow-lg border border-gray-100 mt-10 text-center">
        <div className="w-16 h-16 bg-blue-100 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <Lock size={32} />
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">管理員驗證</h2>
        <p className="text-gray-500 mb-6">請使用 Google 帳號登入以存取後台</p>
        
        <button 
          onClick={handleGoogleLogin}
          className="w-full py-3 border border-gray-300 rounded-lg flex items-center justify-center gap-3 hover:bg-gray-50 transition-colors font-bold text-gray-700 mb-4"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="G" className="w-5 h-5" />
          使用 Google 登入
        </button>
        
        {errorMsg && <p className="text-red-500 text-sm mb-4">{errorMsg}</p>}
        
        <button onClick={onCancel} className="text-gray-400 text-sm hover:underline">
          返回首頁
        </button>
      </div>
    );
  }

  // 2. 已登入，但 Email 不在白名單內
  if (!ADMIN_EMAILS.includes(user.email)) {
    return (
      <div className="max-w-md mx-auto bg-white p-8 rounded-xl shadow-lg border border-red-100 mt-10 text-center">
        <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <ShieldAlert size={32} />
        </div>
        <h2 className="text-xl font-bold text-red-600 mb-2">無存取權限</h2>
        <p className="text-gray-600 mb-2">帳號: <span className="font-mono bg-gray-100 px-1">{user.email}</span></p>
        <p className="text-gray-500 text-sm mb-6">此帳號未被列入管理員名單。</p>
        
        <button 
          onClick={handleLogout}
          className="w-full py-2 bg-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-300 mb-3 flex items-center justify-center gap-2"
        >
          <LogOut size={16} /> 登出並切換帳號
        </button>
        <button onClick={onCancel} className="text-gray-400 text-sm hover:underline">
          返回首頁
        </button>
      </div>
    );
  }

  // 3. 驗證通過
  return (
    <div>
       <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg mb-4 flex justify-between items-center">
         <span className="flex items-center gap-2 text-sm font-bold">
           <CheckCircle size={16} /> 管理員身份驗證通過: {user.email}
         </span>
         <button onClick={handleLogout} className="text-sm underline hover:text-green-900">
           登出
         </button>
       </div>
       {children}
    </div>
  );
}

function HomeView({ quizTitle, responseCount, onNavigate }) {
  return (
    <div className="space-y-8">
      <div className="text-center py-10">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">{quizTitle}</h2>
        <p className="text-gray-500">目前的總回覆數：<span className="font-bold text-blue-600">{responseCount}</span> 份</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div 
          onClick={() => onNavigate('admin')}
          className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer border border-gray-100 group"
        >
          <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Edit3 size={24} />
          </div>
          <h3 className="text-lg font-bold mb-2">後台管理 (題目設計)</h3>
          <p className="text-sm text-gray-500">管理者專用。設計問卷、上傳圖片與設定題型。</p>
        </div>

        <div 
          onClick={() => onNavigate('survey')}
          className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer border border-gray-100 group"
        >
          <div className="w-12 h-12 bg-green-100 text-green-600 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <CheckSquare size={24} />
          </div>
          <h3 className="text-lg font-bold mb-2">填寫問卷 (使用者)</h3>
          <p className="text-sm text-gray-500">分享此連結。使用者可在此預覽並填寫問卷。</p>
        </div>

        <div 
          onClick={() => onNavigate('stats')}
          className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer border border-gray-100 group"
        >
          <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <BarChart3 size={24} />
          </div>
          <h3 className="text-lg font-bold mb-2">統計圖表與報表</h3>
          <p className="text-sm text-gray-500">查看視覺化圖表，並匯出 Excel (CSV) 報表。</p>
        </div>
      </div>

      <div className="mt-8 bg-blue-50 border border-blue-100 p-4 rounded-lg flex items-start gap-3">
        <Share2 className="text-blue-500 mt-1 flex-shrink-0" size={20} />
        <div>
          <h4 className="font-semibold text-blue-800">關於分享</h4>
          <p className="text-sm text-blue-600">
            請直接複製瀏覽器上方的網址分享給使用者。此連結是固定的，所有人看到的內容都會同步更新。
          </p>
        </div>
      </div>
    </div>
  );
}

function AdminPanel({ initialData, onSave }) {
  const [title, setTitle] = useState(initialData.title || "");
  const [description, setDescription] = useState(initialData.description || "");
  const [questions, setQuestions] = useState(initialData.questions || []);

  const addQuestion = () => {
    const newId = Date.now().toString();
    setQuestions([...questions, {
      id: newId,
      text: "新問題",
      type: "single", 
      hasImages: false,
      options: ["選項 1", "選項 2"],
      images: ["", "", "", ""] 
    }]);
  };

  const updateQuestion = (index, field, value) => {
    const newQuestions = [...questions];
    newQuestions[index][field] = value;
    setQuestions(newQuestions);
  };

  const updateOption = (qIndex, oIndex, value) => {
    const newQuestions = [...questions];
    newQuestions[qIndex].options[oIndex] = value;
    setQuestions(newQuestions);
  };

  const addOption = (qIndex) => {
    const newQuestions = [...questions];
    newQuestions[qIndex].options.push(`選項 ${newQuestions[qIndex].options.length + 1}`);
    setQuestions(newQuestions);
  };

  const removeOption = (qIndex, oIndex) => {
    const newQuestions = [...questions];
    newQuestions[qIndex].options.splice(oIndex, 1);
    setQuestions(newQuestions);
  };

  const removeQuestion = (index) => {
    const newQuestions = [...questions];
    newQuestions.splice(index, 1);
    setQuestions(newQuestions);
  };

  // 圖片處理邏輯
  const handleImageUpload = async (qIndex, imgIndex, file) => {
    if (!file) return;
    try {
      const base64 = await compressImage(file);
      const newQuestions = [...questions];
      newQuestions[qIndex].images[imgIndex] = base64;
      setQuestions(newQuestions);
    } catch (err) {
      console.error("Image process error", err);
      alert("圖片處理失敗，請試著換一張圖片。");
    }
  };

  const updateImageText = (qIndex, imgIndex, value) => {
    const newQuestions = [...questions];
    newQuestions[qIndex].images[imgIndex] = value;
    setQuestions(newQuestions);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      <div className="bg-indigo-600 px-6 py-4 flex justify-between items-center text-white">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Edit3 size={20} /> 問卷編輯後台
        </h2>
        <button onClick={() => onSave({ title, description, questions })} className="bg-white text-indigo-600 px-4 py-2 rounded-lg font-bold hover:bg-indigo-50 flex items-center gap-2">
          <Save size={18} /> 儲存發布
        </button>
      </div>
      
      <div className="p-6 space-y-6">
        <div className="space-y-4 border-b border-gray-100 pb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">問卷標題</label>
            <input 
              type="text" 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              placeholder="輸入問卷標題..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">問卷說明</label>
            <textarea 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              rows="2"
              placeholder="輸入問卷說明..."
            />
          </div>
        </div>

        <div className="space-y-8">
          {questions.map((q, qIndex) => (
            <div key={q.id} className="bg-gray-50 p-6 rounded-lg border border-gray-200 relative group">
              <button 
                onClick={() => removeQuestion(qIndex)}
                className="absolute top-4 right-4 text-gray-400 hover:text-red-500 p-1"
                title="刪除問題"
              >
                <Trash2 size={20} />
              </button>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div className="md:col-span-3">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">問題內容</label>
                  <input 
                    type="text" 
                    value={q.text} 
                    onChange={(e) => updateQuestion(qIndex, 'text', e.target.value)} 
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">題型</label>
                  <select 
                    value={q.type} 
                    onChange={(e) => updateQuestion(qIndex, 'type', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none"
                  >
                    <option value="single">單選題</option>
                    <option value="multi">複選題</option>
                  </select>
                </div>
              </div>

              <div className="mb-4">
                <label className="flex items-center gap-2 cursor-pointer w-fit">
                  <input 
                    type="checkbox" 
                    checked={q.hasImages} 
                    onChange={(e) => updateQuestion(qIndex, 'hasImages', e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <span className="text-sm font-medium text-gray-700 flex items-center gap-1">
                    <ImageIcon size={16} /> 啟用圖片選項 (1-4張)
                  </span>
                </label>
              </div>

              {q.hasImages && (
                <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-3 bg-white p-3 rounded border border-dashed border-gray-300">
                  {[0, 1, 2, 3].map((imgIndex) => (
                    <div key={imgIndex} className="space-y-2">
                      <div className="aspect-square bg-gray-100 rounded flex items-center justify-center overflow-hidden relative group/img">
                         {q.images[imgIndex] ? (
                           <img src={q.images[imgIndex]} alt="Preview" className="w-full h-full object-cover" onError={(e) => e.target.src = 'https://placehold.co/100?text=Error'} />
                         ) : (
                           <div className="flex flex-col items-center text-gray-400">
                             <Upload size={24} />
                             <span className="text-xs mt-1">上傳/貼網址</span>
                           </div>
                         )}
                         <label className="absolute inset-0 bg-black bg-opacity-0 group-hover/img:bg-opacity-50 flex items-center justify-center cursor-pointer transition-all">
                           <input 
                             type="file" 
                             accept="image/*" 
                             className="hidden" 
                             onChange={(e) => handleImageUpload(qIndex, imgIndex, e.target.files[0])}
                           />
                           <Upload className="text-white opacity-0 group-hover/img:opacity-100" size={24} />
                         </label>
                      </div>
                      <input 
                        type="text" 
                        placeholder="或貼上圖片 URL" 
                        value={q.images[imgIndex] && q.images[imgIndex].startsWith('data:') ? '(已上傳圖片)' : q.images[imgIndex]}
                        onChange={(e) => updateImageText(qIndex, imgIndex, e.target.value)}
                        className="w-full text-xs px-2 py-1 border rounded text-gray-500"
                        disabled={q.images[imgIndex] && q.images[imgIndex].startsWith('data:')}
                      />
                      {q.images[imgIndex] && q.images[imgIndex].startsWith('data:') && (
                        <button 
                          onClick={() => updateImageText(qIndex, imgIndex, '')}
                          className="text-xs text-red-500 hover:text-red-700 w-full text-center"
                        >
                          移除圖片
                        </button>
                      )}
                    </div>
                  ))}
                  <p className="col-span-full text-xs text-gray-500">
                    提示：點擊方塊可「上傳圖片」 (會自動壓縮存檔)，或直接在下方欄位貼上圖片網址。
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-500 uppercase">文字選項</label>
                {q.options.map((opt, oIndex) => (
                  <div key={oIndex} className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full border border-gray-300 ${q.type === 'multi' ? 'rounded-sm' : ''}`}></div>
                    <input 
                      type="text" 
                      value={opt} 
                      onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                      className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
                    />
                    <button onClick={() => removeOption(qIndex, oIndex)} className="text-gray-400 hover:text-red-500">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                <button 
                  onClick={() => addOption(qIndex)}
                  className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 mt-2"
                >
                  <Plus size={16} /> 新增選項
                </button>
              </div>
            </div>
          ))}

          <button 
            onClick={addQuestion}
            className="w-full py-4 border-2 border-dashed border-indigo-200 rounded-lg text-indigo-500 hover:bg-indigo-50 hover:border-indigo-400 transition-colors font-bold flex items-center justify-center gap-2"
          >
            <Plus size={20} /> 新增題目
          </button>
        </div>
      </div>
    </div>
  );
}

function SurveyTaker({ quizData, onSubmit, onCancel }) {
  const [answers, setAnswers] = useState({}); 

  const handleOptionChange = (qId, type, value, isImageSelection = false) => {
    const finalValue = isImageSelection ? `Image #${value + 1}` : value;

    if (type === 'single') {
      setAnswers(prev => ({ ...prev, [qId]: finalValue }));
    } else {
      setAnswers(prev => {
        const current = prev[qId] || [];
        if (current.includes(finalValue)) {
          return { ...prev, [qId]: current.filter(v => v !== finalValue) };
        } else {
          return { ...prev, [qId]: [...current, finalValue] };
        }
      });
    }
  };

  const isSelected = (qId, val, isImage = false) => {
    const checkVal = isImage ? `Image #${val + 1}` : val;
    const current = answers[qId];
    if (Array.isArray(current)) return current.includes(checkVal);
    return current === checkVal;
  };

  const canSubmit = quizData.questions.length > 0 && quizData.questions.every(q => {
     const ans = answers[q.id];
     return ans && (Array.isArray(ans) ? ans.length > 0 : true);
  });

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-t-xl shadow-sm border border-gray-200 border-t-8 border-t-blue-600 p-8 mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">{quizData.title}</h1>
        <p className="text-gray-600 whitespace-pre-wrap">{quizData.description}</p>
        <div className="mt-4 pt-4 border-t text-sm text-gray-500 flex items-center gap-2">
          <Users size={16} /> 此問卷採匿名填寫
        </div>
      </div>

      <div className="space-y-6">
        {quizData.questions.map((q, index) => (
          <div key={q.id} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-medium text-gray-800 mb-2">
              <span className="font-bold mr-2">{index + 1}.</span>
              {q.text}
              <span className="ml-2 text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                {q.type === 'single' ? '單選' : '複選'}
              </span>
            </h3>

            {q.hasImages && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                {[0, 1, 2, 3].map(imgIdx => {
                  if (!q.images[imgIdx]) return null;
                  const selected = isSelected(q.id, imgIdx, true);
                  return (
                    <div 
                      key={imgIdx}
                      onClick={() => handleOptionChange(q.id, q.type, imgIdx, true)}
                      className={`
                        relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all group
                        ${selected ? 'border-blue-600 ring-2 ring-blue-100' : 'border-transparent hover:border-gray-300'}
                      `}
                    >
                      <div className="aspect-square bg-gray-100">
                        <img src={q.images[imgIdx]} alt={`Option ${imgIdx + 1}`} className="w-full h-full object-cover" />
                      </div>
                      <div className={`
                        absolute inset-0 flex items-center justify-center bg-black bg-opacity-20 transition-opacity
                        ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
                      `}>
                        {selected && <CheckCircle className="text-white drop-shadow-md" size={32} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="space-y-2">
              {q.options.map((opt, oIndex) => {
                const selected = isSelected(q.id, opt, false);
                return (
                  <div 
                    key={oIndex}
                    onClick={() => handleOptionChange(q.id, q.type, opt, false)}
                    className={`
                      flex items-center p-3 rounded-lg border cursor-pointer transition-colors
                      ${selected ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200 hover:bg-gray-50'}
                    `}
                  >
                    <div className={`
                      w-5 h-5 flex items-center justify-center border rounded mr-3
                      ${q.type === 'single' ? 'rounded-full' : 'rounded'}
                      ${selected ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-400'}
                    `}>
                      {selected && <CheckSquare size={12} />}
                    </div>
                    <span className={selected ? 'text-blue-900 font-medium' : 'text-gray-700'}>{opt}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 flex gap-4">
        <button 
          onClick={onCancel}
          className="flex-1 py-3 bg-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-300 transition-colors"
        >
          取消
        </button>
        <button 
          onClick={() => onSubmit(answers)}
          disabled={!canSubmit}
          className={`
            flex-1 py-3 font-bold rounded-lg text-white transition-colors shadow-lg
            ${canSubmit ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-300 cursor-not-allowed'}
          `}
        >
          提交問卷
        </button>
      </div>
    </div>
  );
}

function StatsDashboard({ quizData, responses, onBack }) {
  const stats = useMemo(() => {
    return quizData.questions.map(q => {
      const counts = {};
      
      q.options.forEach(opt => counts[opt] = 0);
      if (q.hasImages) {
        [0,1,2,3].forEach(i => { if(q.images[i]) counts[`Image #${i+1}`] = 0; });
      }

      responses.forEach(r => {
        const ans = r.answers[q.id];
        if (Array.isArray(ans)) {
          ans.forEach(val => counts[val] = (counts[val] || 0) + 1);
        } else if (ans) {
          counts[ans] = (counts[ans] || 0) + 1;
        }
      });

      return {
        id: q.id,
        title: q.text,
        data: Object.keys(counts).map(k => ({ name: k, count: counts[k] }))
      };
    });
  }, [quizData, responses]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
         <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
           <BarChart3 className="text-orange-500" /> 結果分析 ({responses.length} 份回覆)
         </h2>
         <div className="flex gap-2">
            <button 
              onClick={() => exportToCSV(quizData, responses)}
              className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-green-700 flex items-center gap-2"
            >
              <Download size={18} /> 匯出 Excel (CSV)
            </button>
         </div>
      </div>

      {responses.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-500 text-lg">目前尚無回收數據。</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8">
          {stats.map((stat, index) => (
            <div key={stat.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-800 mb-4 pl-3 border-l-4 border-blue-500">
                Q{index + 1}: {stat.title}
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-64 md:h-80">
                {/* Bar Chart */}
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stat.data} layout="vertical" margin={{ left: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis dataKey="name" type="category" width={80} tick={{fontSize: 12}} />
                    <Tooltip cursor={{fill: 'transparent'}} />
                    <Bar dataKey="count" fill="#3B82F6" radius={[0, 4, 4, 0]} name="人數" barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
                
                {/* Pie Chart */}
                <ResponsiveContainer width="100%" height="100%">
                   <PieChart>
                    <Pie
                      data={stat.data}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={80}
                      fill="#8884d8"
                      paddingAngle={5}
                      dataKey="count"
                      label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {stat.data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}