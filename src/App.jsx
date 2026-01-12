import ReactDOM from 'react-dom'
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged, 
  signInWithCustomToken,
  signInWithPopup,
  GoogleAuthProvider
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  serverTimestamp, 
  orderBy 
} from 'firebase/firestore';
// 🆕 新增：引入 Storage 相關工具
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Radar, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  Legend
} from 'recharts';
import { 
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
  LogOut, 
  ShieldAlert, 
  ChevronRight, 
  ChevronLeft, 
  FileText, 
  Printer, 
  Target, 
  Move, 
  MousePointer2, 
  XCircle, 
  Award, 
  RefreshCw, 
  LayoutGrid, 
  Maximize, 
  X, 
  User, 
  Play, 
  Search, 
  Star, 
  Clock, 
  AlertCircle, 
  Loader2, 
  Zap, 
  PenTool, 
  Database, 
  Mail
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- 1. Firebase 配置 ---
let firebaseConfig;
try {
  if (typeof __firebase_config !== 'undefined') {
    firebaseConfig = JSON.parse(__firebase_config);
  } else {
    throw new Error('Local config');
  }
} catch (e) {
  firebaseConfig = {
    apiKey: "AIzaSyAKCRTN4BWMqpL2e6svx1FLN5RiJIdYRtk",
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
const storage = getStorage(app); // 🆕 啟動 Storage

const appId = typeof __app_id !== 'undefined' ? __app_id : 'my-survey-app';
// 🆕 為了避免被舊的 3.9MB 資料卡住，我們換一個全新的 ID，像是一個全新的開始
const QUIZ_ID = 'global_shared_quiz_v2'; 
const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
const ADMIN_EMAILS = ["alanlai0933.ai@gmail.com", "alanlai0933@gmail.com"];

// --- 2. 輔助函數 (升級：高畫質雲端上傳版) ---
const uploadImageToStorage = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        
        // 🟢 修改 1：將最大寬度提升到 1280 (HD 畫質)
        // 這樣在手機或電腦上觀看都非常清晰，不會有馬賽克
        const MAX_WIDTH = 1280; 
        
        let width = img.width;
        let height = img.height;

        // 只有當圖片「超過」1280 時才縮小，不然保持原樣
        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // 🟢 修改 2：品質提升到 0.9 (接近原圖畫質)
        canvas.toBlob(async (blob) => {
          if (!blob) {
            reject(new Error("圖片處理失敗"));
            return;
          }
          try {
            // 設定上傳路徑
            const fileName = `images/${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
            const storageRef = ref(storage, fileName);
            
            // 開始上傳
            await uploadBytes(storageRef, blob);
            
            // 拿到下載網址
            const downloadURL = await getDownloadURL(storageRef);
            resolve(downloadURL);
          } catch (error) {
            console.error("上傳失敗:", error);
            reject(error);
          }
        }, 'image/jpeg', 0.9); // <--- 這裡改成了 0.9
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
};

const isPointInPolygon = (point, vs) => {
  if (!vs || vs.length === 0) return false;
  let x = point.x, y = point.y;
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    let xi = vs[i].x, yi = vs[i].y;
    let xj = vs[j].x, yj = vs[j].y;
    let intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const exportToCSV = (quizData, responses) => {
  const headers = ['提交時間', '暱稱', 'Email', '總耗時(秒)', '總得分'];
  quizData.questions.forEach((q, idx) => headers.push(`Q${idx + 1}: ${q.text}`));
  
  const rows = responses.map(r => {
    const date = r.submittedAt ? new Date(r.submittedAt.seconds * 1000).toLocaleString('zh-TW') : 'N/A';
    const totalTime = r.totalTime ? Math.round(r.totalTime) : 'N/A';
    
    let totalScore = 0;
    const ansCols = quizData.questions.map(q => {
      const ans = r.answers[q.id];
      const points = Number(q.points) || 0;
      let score = 0;
      let display = "";

      if (q.type === 'hotspot') {
        const userPins = ans || [];
        const totalTargets = q.targets?.length || 0;
        const hits = (q.targets || []).filter(t => userPins.some(pin => isPointInPolygon(pin, t.points))).length;
        const accuracy = totalTargets > 0 ? Math.round((hits / totalTargets) * 100) : 0;
        score = totalTargets > 0 ? Math.round((hits / totalTargets) * points) : 0;
        display = `正確率 ${accuracy}% (${hits}/${totalTargets})`;
      } else if (q.type === 'sorting') {
        const userMap = ans || {};
        let correctCount = 0;
        let errors = [];
        q.items.forEach(item => {
           const userCat = userMap[item.id];
           if (userCat === item.correctCategory) correctCount++;
           else if (userCat) errors.push(`${item.text}(錯)`);
        });
        const totalItems = q.items.length || 1;
        score = Math.round((correctCount / totalItems) * points);
        display = errors.length > 0 ? `錯: ${errors.join('; ')}` : `全對`;
      } else if (q.type === 'choice') {
        let isCorrect = false;
        if (q.isMulti) {
           const correctOptions = q.options.filter(o => o.isCorrect).map(o => o.label);
           const userSelected = Array.isArray(ans) ? ans : [];
           isCorrect = correctOptions.length === userSelected.length && correctOptions.every(v => userSelected.includes(v));
        } else {
           const correctOption = q.options.find(o => o.isCorrect)?.label;
           isCorrect = ans === correctOption;
        }
        score = isCorrect ? points : 0;
        display = isCorrect ? '正確' : '錯誤';
      }
      totalScore += score;
      return `"${display.replace(/"/g, '""')}"`;
    });

    const rowData = [date, r.nickname || 'Guest', r.inputEmail || r.userEmail || 'Anonymous', totalTime, totalScore, ...ansCols];
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
  const [isSubmitting, setIsSubmitting] = useState(false); 
  const [quizData, setQuizData] = useState({ title: "未命名問卷", questions: [] });
  const [responses, setResponses] = useState([]);
  const [myResult, setMyResult] = useState(null);

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

  useEffect(() => {
    // 即使沒有 user 也嘗試監聽 public data，確保訪客能看到題目
    const quizRef = doc(db, 'artifacts', appId, 'public', 'data', 'quizzes', QUIZ_ID);
    return onSnapshot(quizRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setQuizData({ ...data, questions: data.questions || [] });
      } else {
        // 如果是新 ID 沒資料，給個預設值
        setQuizData({ title: "新問卷 (v2)", questions: [] });
      }
    });
  }, []);

  useEffect(() => {
    if (!user) { setResponses([]); return; }
    const ref = collection(db, 'artifacts', appId, 'public', 'data', `responses_${QUIZ_ID}`);
    return onSnapshot(query(ref, orderBy('submittedAt', 'desc')), (snap) => {
      const data = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() }));
      setResponses(data);
    });
  }, [user]);

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
    console.log("🛠️ 準備執行刪除，目標 ID:", responseId);
    try {
      const ref = doc(db, 'artifacts', appId, 'public', 'data', `responses_${QUIZ_ID}`, responseId);
      await deleteDoc(ref);
      console.log("✅ Firebase 刪除成功");
    } catch (error) {
      console.error("❌ 刪除失敗:", error.message);
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
// --- 組件 1：AdminPanel (升級版：支援 Storage 上傳) ---
function AdminPanel({ initialData, onSave, isSubmitting, responses, onDeleteResponse }) {
  const [tab, setTab] = useState('design'); 
  const [title, setTitle] = useState(initialData.title || "");
  const [questions, setQuestions] = useState(initialData.questions || []);
  const [confirmId, setConfirmId] = useState(null); 
  // 新增：上傳 loading 狀態，避免上傳一半就按儲存
  const [uploading, setUploading] = useState(false);

  const addQuestion = (type) => {
    const base = { id: Date.now().toString(), text: "新題目", type, points: 10 }; 
    if (type === 'choice') {
      setQuestions([...questions, { 
        ...base, 
        text: "選擇題", 
        isMulti: false,
        options: [{ label: "選項 A", image: "", isCorrect: false }, { label: "選項 B", image: "", isCorrect: false }]
      }]);
    } else if (type === 'hotspot') {
      const defaultPoints = [{ x: 30, y: 30 }, { x: 70, y: 30 }, { x: 70, y: 70 }, { x: 30, y: 70 }];
      setQuestions([...questions, { ...base, text: "請框出畫面中的...", image: "", targets: [{ id: 't1', points: defaultPoints }] }]);
    } else if (type === 'sorting') {
      setQuestions([...questions, { 
        ...base, 
        text: "請分類以下項目", 
        items: [{ id: 'i1', text: "項目 1", image: "", correctCategory: "" }, { id: 'i2', text: "項目 2", image: "", correctCategory: "" }], 
        categories: ["分類 A", "分類 B"] 
      }]);
    }
  };

  const updateQuestion = (idx, field, val) => {
    const next = [...questions];
    if (field === 'targets') next[idx].targets = val;
    else next[idx][field] = val;
    setQuestions(next);
  };

  // 🛠️ 核心修改：圖片上傳改為「先傳雲端，再存網址」
  const handleImageUpload = async (qIdx, file, field, optIdx = null) => {
    if (!file) return;
    setUploading(true); // 鎖住按鈕
    try {
      // 呼叫 Part 1 定義好的上傳工具
      const imageUrl = await uploadImageToStorage(file);
      
      const next = [...questions];
      if (optIdx !== null) {
        next[qIdx].options[optIdx].image = imageUrl;
      } else {
        next[qIdx].field = imageUrl; 
        if(field === 'image') next[qIdx].image = imageUrl;
      }
      setQuestions(next);
    } catch (e) { 
      alert("圖片上傳失敗：" + e.message); 
    } finally {
      setUploading(false); // 解鎖按鈕
    }
  };

  const handleOptionUpdate = (qIdx, optIdx, field, val) => {
    const next = [...questions];
    if (typeof next[qIdx].options[optIdx] === 'string') {
        next[qIdx].options[optIdx] = { label: val, image: "", isCorrect: false };
    } else {
        next[qIdx].options[optIdx][field] = val;
    }
    
    if (field === 'isCorrect' && val === true && !next[qIdx].isMulti) {
        next[qIdx].options.forEach((o, i) => {
            if (i !== optIdx) o.isCorrect = false;
        });
    }
    setQuestions(next);
  };

  const handleItemUpdate = (qIdx, iIdx, field, val) => {
    const next = [...questions];
    next[qIdx].items[iIdx][field] = val;
    setQuestions(next);
  };

  // 🛠️ 核心修改：分類項目的圖片上傳也改版
  const handleItemImageUpload = async (qIdx, itemIdx, file) => {
    if (!file) return;
    setUploading(true);
    try {
      const imageUrl = await uploadImageToStorage(file);
      const next = [...questions];
      next[qIdx].items[itemIdx].image = imageUrl;
      setQuestions(next);
    } catch (e) { 
        alert("圖片上傳失敗：" + e.message); 
    } finally {
        setUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100 min-h-[600px] flex flex-col relative">
      {/* 頂部導航與頁籤 */}
      <div className="bg-indigo-600 p-6">
        <div className="flex justify-between items-center text-white mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2"><Edit3 size={24}/> 後台管理系統</h2>
          {tab === 'design' && (
            <button 
              onClick={() => onSave({ title, questions })} 
              disabled={isSubmitting || uploading} // 圖片上傳中也禁止儲存
              className="bg-white/20 backdrop-blur-md text-white border border-white/30 px-6 py-2 rounded-xl text-sm font-bold hover:bg-white/30 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting || uploading ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>} 
              {uploading ? "圖片上傳中..." : "儲存發布"}
            </button>
          )}
        </div>
        
        <div className="flex gap-2">
          <button 
             onClick={() => setTab('design')}
             className={`px-6 py-3 rounded-t-xl font-bold text-sm transition-colors ${tab === 'design' ? 'bg-white text-indigo-600' : 'bg-indigo-700/50 text-indigo-100 hover:bg-indigo-700'}`}
          >
             <PenTool size={16} className="inline mr-2"/> 問題設計
          </button>
          <button 
             onClick={() => setTab('data')}
             className={`px-6 py-3 rounded-t-xl font-bold text-sm transition-colors ${tab === 'data' ? 'bg-white text-indigo-600' : 'bg-indigo-700/50 text-indigo-100 hover:bg-indigo-700'}`}
          >
             <Database size={16} className="inline mr-2"/> 填報資料管理
          </button>
        </div>
      </div>
      
      <div className="p-8 space-y-8 flex-1 bg-slate-50">
        {/* 頁籤內容：問題設計 */}
        {tab === 'design' && (
          <>
            <input className="w-full text-3xl font-bold border-b-2 border-slate-200 p-2 outline-none focus:border-indigo-500 bg-transparent transition-colors" value={title} onChange={e => setTitle(e.target.value)} placeholder="請輸入問卷標題..." />
            
            <div className="space-y-6">
              {questions.map((q, qIdx) => (
                <div key={q.id} className="p-6 bg-white rounded-2xl border border-slate-200 relative space-y-4 hover:shadow-md transition-shadow">
                  <div className="absolute top-4 right-4 flex gap-2 z-50">
                      <span className="text-xs font-bold uppercase bg-slate-100 text-slate-500 px-2 py-1 rounded">{q.type}</span>
                      <button className="text-slate-300 hover:text-red-500 transition-colors p-1 bg-white rounded-full shadow-sm" onClick={() => setQuestions(questions.filter((_, i) => i !== qIdx))}><Trash2 size={20}/></button>
                  </div>
                  <div className="flex gap-4">
                    <input className="flex-1 p-4 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-indigo-100 outline-none" value={q.text} onChange={e => updateQuestion(qIdx, 'text', e.target.value)} placeholder="題目描述..." />
                    <div className="w-24">
                        <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">配分</label>
                        <input type="number" className="w-full p-2 border rounded-lg font-bold text-center" value={q.points || 0} onChange={e => updateQuestion(qIdx, 'points', Number(e.target.value))} />
                    </div>
                  </div>

                  {q.type === 'choice' && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                          <input type="checkbox" id={`multi-${q.id}`} checked={q.isMulti || false} onChange={e => updateQuestion(qIdx, 'isMulti', e.target.checked)} className="w-4 h-4 accent-indigo-600"/>
                          <label htmlFor={`multi-${q.id}`} className="text-sm font-bold text-slate-600 cursor-pointer">啟用複選</label>
                        </div>
                        <div className="space-y-2">
                          {q.options.map((opt, oIdx) => {
                             const optLabel = typeof opt === 'string' ? opt : opt.label;
                             const optImage = typeof opt === 'string' ? "" : opt.image;
                             const isCorrect = typeof opt === 'string' ? false : opt.isCorrect;
                             return (
                               <div key={oIdx} className={`flex items-start gap-2 border p-2 rounded-lg ${isCorrect ? 'bg-green-50 border-green-200' : 'bg-slate-50'}`}>
                                 <div className="mt-3">
                                      <input 
                                        type={q.isMulti ? "checkbox" : "radio"}
                                        name={`correct-${q.id}`}
                                        checked={isCorrect || false}
                                        onChange={(e) => handleOptionUpdate(qIdx, oIdx, 'isCorrect', e.target.checked)}
                                        className="w-5 h-5 accent-green-600 cursor-pointer"
                                        title="設為正確答案"
                                      />
                                 </div>
                                 <div className="w-12 h-12 bg-slate-200 rounded flex-shrink-0 relative overflow-hidden group/img cursor-pointer hover:opacity-80">
                                      {optImage ? <img src={optImage} className="w-full h-full object-cover" /> : <ImageIcon size={20} className="text-slate-400 m-auto mt-3"/>}
                                      <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => handleImageUpload(qIdx, e.target.files[0], 'options', oIdx)} />
                                 </div>
                                 <div className="flex-1">
                                      <input className="w-full p-2 border rounded text-sm focus:border-indigo-500 outline-none" value={optLabel} placeholder={`選項 ${oIdx + 1}`} onChange={(e) => handleOptionUpdate(qIdx, oIdx, 'label', e.target.value)} />
                                 </div>
                                 <button onClick={() => {
                                      const next = [...questions]; next[qIdx].options.splice(oIdx, 1); setQuestions(next);
                                 }} className="text-slate-300 hover:text-red-500 mt-2"><Trash2 size={16}/></button>
                               </div>
                             );
                          })}
                          <button onClick={() => {
                             const next = [...questions]; next[qIdx].options.push({ label: `選項 ${next[qIdx].options.length + 1}`, image: "", isCorrect: false }); setQuestions(next);
                          }} className="text-sm text-indigo-500 font-bold hover:underline flex items-center gap-1 mt-2"><Plus size={14}/> 新增選項</button>
                        </div>
                    </div>
                  )}

                  {q.type === 'hotspot' && (
                      <div className="space-y-4">
                            {/* 🔥 新增：限制點擊數量的設定 🔥 */}
                                <div className="flex items-center gap-4 bg-indigo-50 p-3 rounded-xl border border-indigo-100">
                                <div className="flex items-center gap-2">
                                  <label className="text-sm font-bold text-slate-700">限制點擊數量：</label>
                                    <input                                   
          type="number" 
          min="1" 
          max="10"
          className="w-20 p-2 border border-indigo-200 rounded-lg text-center font-bold text-indigo-600 outline-none focus:ring-2 focus:ring-indigo-500"
          value={q.maxClicks || 1} // 預設為 1
          onChange={e => updateQuestion(qIdx, 'maxClicks', Number(e.target.value))}
        />
      </div>
      <span className="text-xs text-slate-400">
        (例如：題目若問「找出 3 個垃圾」，請設為 3)
      </span>
    </div>
                      <div className="relative aspect-video bg-slate-100 rounded-xl overflow-hidden group border-2 border-dashed border-slate-300">
                        {q.image ? (
                            <HotspotAdminEditor image={q.image} targets={q.targets} onUpdate={(newTargets) => updateQuestion(qIdx, 'targets', newTargets)} />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400"><Target size={40} className="mb-2"/>上傳圖片以開始</div>
                        )}
                        <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => handleImageUpload(qIdx, e.target.files[0], 'image')} disabled={!!q.image} />
                        {q.image && <button onClick={(e) => { updateQuestion(qIdx, 'image', ''); }} className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded hover:bg-red-500 z-10"><Trash2 size={14}/></button>}
                      </div>
                      <div className="flex gap-4 items-center">
                        <button onClick={() => {
                            const defaultPoints = [{ x: 30, y: 30 }, { x: 70, y: 30 }, { x: 70, y: 70 }, { x: 30, y: 70 }];
                            const newTargets = [...(q.targets || []), { id: Date.now().toString(), points: defaultPoints }];
                            updateQuestion(qIdx, 'targets', newTargets);
                        }} className="text-xs bg-indigo-100 text-indigo-600 px-3 py-1 rounded font-bold hover:bg-indigo-200">+ 新增判定區</button>
                        <span className="text-xs text-slate-400">目前有 {q.targets?.length || 0} 個判定區</span>
                      </div>
                    </div>
                  )}

                  {q.type === 'sorting' && (
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <label className="text-xs font-bold text-slate-400 uppercase">項目 (Items)</label>
                        {q.items.map((item, iIdx) => (
                          <div key={item.id || iIdx} className="flex flex-col gap-2 border p-2 rounded-lg bg-slate-50">
                            <div className="flex gap-2 items-start">
                              <div className="w-10 h-10 bg-slate-200 rounded flex-shrink-0 relative overflow-hidden group/img">
                                 {item.image ? <img src={item.image} className="w-full h-full object-cover" /> : <ImageIcon size={16} className="text-slate-400 m-auto mt-2"/>}
                                 <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => handleItemImageUpload(qIdx, iIdx, e.target.files[0])} />
                              </div>
                              <input className="flex-1 p-1 border rounded text-xs" value={item.text} placeholder="項目名稱" onChange={e => handleItemUpdate(qIdx, iIdx, 'text', e.target.value)} />
                              <button onClick={() => {
                                 const next = [...questions]; next[qIdx].items.splice(iIdx, 1); setQuestions(next);
                              }} className="text-slate-300 hover:text-red-500"><Trash2 size={16}/></button>
                            </div>
                            <select 
                              className={`w-full p-1 border rounded text-xs ${!item.correctCategory ? 'border-red-300 bg-red-50' : 'bg-green-50 border-green-200'}`}
                              value={item.correctCategory || ""}
                              onChange={(e) => handleItemUpdate(qIdx, iIdx, 'correctCategory', e.target.value)}
                            >
                              <option value="">設定正確分類...</option>
                              {q.categories.map((cat, idx) => <option key={idx} value={cat}>{cat}</option>)}
                            </select>
                          </div>
                        ))}
                        <button onClick={() => {
                            const next = [...questions]; 
                            next[qIdx].items.push({ id: Date.now().toString(), text: "新項目", image: "", correctCategory: "" }); 
                            setQuestions(next);
                        }} className="text-xs text-indigo-500 font-bold">+ 加項目</button>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">分類籃 (Categories)</label>
                        {q.categories.map((cat, cIdx) => (
                          <div key={cIdx} className="flex gap-2">
                            <input className="w-full p-2 border rounded text-sm" value={cat} onChange={e => {
                              const next = [...questions]; next[qIdx].categories[cIdx] = e.target.value; setQuestions(next);
                            }} />
                            <button onClick={() => {
                               const next = [...questions]; next[qIdx].categories.splice(cIdx, 1); setQuestions(next);
                            }} className="text-slate-300 hover:text-red-500"><Trash2 size={16}/></button>
                          </div>
                        ))}
                        <button onClick={() => {
                            const next = [...questions]; next[qIdx].categories.push("新分類"); setQuestions(next);
                        }} className="text-xs text-indigo-500 font-bold">+ 加分類</button>
                      </div>
                    </div>
                  )}

                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-200 mt-8">
               <button onClick={() => addQuestion('choice')} className="py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 font-bold hover:bg-indigo-50 hover:border-indigo-300 transition-all flex items-center justify-center gap-2"><CheckSquare size={18}/> 選擇題</button>
               <button onClick={() => addQuestion('hotspot')} className="py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 font-bold hover:bg-indigo-50 hover:border-indigo-300 transition-all flex items-center justify-center gap-2"><Target size={18}/> 圖像熱點</button>
               <button onClick={() => addQuestion('sorting')} className="py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 font-bold hover:bg-indigo-50 hover:border-indigo-300 transition-all flex items-center justify-center gap-2"><LayoutGrid size={18}/> 拖曳分類</button>
            </div>
          </>
        )}

        {/* 頁籤內容：填報資料管理 */}
        {tab === 'data' && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="p-4 font-bold text-slate-600 text-sm">時間</th>
                    <th className="p-4 font-bold text-slate-600 text-sm">暱稱</th>
                    <th className="p-4 font-bold text-slate-600 text-sm">Email</th>
                    <th className="p-4 font-bold text-slate-600 text-sm">耗時</th>
                    <th className="p-4 font-bold text-slate-600 text-sm text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {responses.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 text-sm text-slate-600">{new Date(r.submittedAt?.seconds * 1000).toLocaleString('zh-TW')}</td>
                      <td className="p-4 text-sm font-bold text-slate-800">{r.nickname || 'Guest'}</td>
                      <td className="p-4 text-sm text-slate-500">{r.inputEmail || r.userEmail || '-'}</td>
                      <td className="p-4 text-sm text-slate-500 font-mono">{formatTime(r.totalTime || 0)}</td>
                      <td className="p-4 text-right">
                          <button 
                            type="button" 
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmId(r.id); // 開啟確認 Modal
                            }}
                            className="bg-red-50 text-red-500 hover:text-red-700 hover:bg-red-100 p-2 rounded-lg transition-colors cursor-pointer relative z-10"
                            title="刪除紀錄"
                          >
                            <Trash2 size={16}/>
                          </button>
                      </td>
                    </tr>
                  ))}
                  {responses.length === 0 && (
                    <tr><td colSpan={5} className="p-8 text-center text-slate-400">目前尚無填報資料</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* --- 自定義確認 Modal --- */}
      <AnimatePresence>
        {confirmId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
             <motion.div 
               initial={{ scale: 0.9, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               exit={{ scale: 0.9, opacity: 0 }}
               className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl"
             >
                <div className="flex items-center gap-3 text-red-600 mb-4">
                   <ShieldAlert size={28}/>
                   <h3 className="text-xl font-bold">確認刪除紀錄？</h3>
                </div>
                <p className="text-slate-500 mb-6">此動作將永久移除該數據，且無法復原。</p>
                <div className="flex gap-3">
                   <button onClick={() => setConfirmId(null)} className="flex-1 py-2 font-bold text-slate-500 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors">取消</button>
                   <button 
                      onClick={() => {
                         onDeleteResponse(confirmId);
                         setConfirmId(null);
                      }}
                      className="flex-1 py-2 font-bold text-white bg-red-500 rounded-xl hover:bg-red-600 shadow-lg shadow-red-200 transition-colors"
                   >
                      確認刪除
                   </button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// 獨立出來的熱點編輯器
function HotspotAdminEditor({ image, targets, onUpdate }) {
  const containerRef = useRef(null);
  const [activeDrag, setActiveDrag] = useState(null);

  const renderPolygon = (points) => {
    if (!points || !Array.isArray(points)) return "";
    return points.map(p => `${p.x},${p.y}`).join(' ');
  };

  const targetsRef = useRef(targets);
  useEffect(() => { targetsRef.current = targets; }, [targets]);

  const handleContainerPointerMove = (e) => {
    if (!activeDrag || !containerRef.current) return;
    e.preventDefault(); 
    const rect = containerRef.current.getBoundingClientRect();
    let x = ((e.clientX - rect.left) / rect.width) * 100;
    let y = ((e.clientY - rect.top) / rect.height) * 100;
    x = Math.max(0, Math.min(100, x));
    y = Math.max(0, Math.min(100, y));

    const { tIdx, pIdx } = activeDrag;
    const newTargets = [...targetsRef.current];
    const newPoints = [...newTargets[tIdx].points];
    newPoints[pIdx] = { x, y };
    newTargets[tIdx] = { ...newTargets[tIdx], points: newPoints };
    onUpdate(newTargets);
  };

  const handleContainerPointerUp = () => setActiveDrag(null);

  return (
    <div 
      className="relative w-full h-full select-none touch-none" 
      ref={containerRef}
      onPointerMove={handleContainerPointerMove}
      onPointerUp={handleContainerPointerUp}
      onPointerLeave={handleContainerPointerUp}
    >
      <img src={image} className="w-full h-full object-contain pointer-events-none select-none" />
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
        {targets?.map((target, i) => (
          <polygon key={i} points={renderPolygon(target.points)} fill="rgba(34, 197, 94, 0.3)" stroke="#22c55e" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      {targets?.map((target, tIdx) => (
        <React.Fragment key={target.id}>
          {target.points && target.points.length > 0 && (
             <div 
                className="absolute w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center cursor-pointer hover:bg-red-600 z-30 shadow-sm"
                style={{ 
                  left: `${target.points[0].x}%`, 
                  top: `${target.points[0].y}%`, 
                  transform: 'translate(10px, -10px)' 
                }}
                onPointerDown={(e) => {
                   e.stopPropagation();
                   if(window.confirm('刪除此判定區？')) {
                      const newTargets = targets.filter((_, i) => i !== tIdx);
                      onUpdate(newTargets);
                   }
                }}
             >
                <X size={12}/>
             </div>
          )}
          {target.points?.map((p, pIdx) => (
            <div
              key={`${target.id}-${pIdx}`}
              onPointerDown={(e) => {
                e.stopPropagation();
                e.target.setPointerCapture(e.pointerId);
                setActiveDrag({ tIdx, pIdx });
              }}
              className={`absolute w-4 h-4 bg-green-500 border-2 border-white rounded-full shadow-md z-20 cursor-move ${activeDrag?.tIdx === tIdx && activeDrag?.pIdx === pIdx ? 'scale-125 bg-green-400' : ''}`}
              style={{ 
                left: `${p.x}%`, 
                top: `${p.y}%`, 
                transform: 'translate(-50%, -50%)' 
              }}
            />
          ))}
        </React.Fragment>
      ))}
    </div>
  );
}
// --- 組件 2：SurveyTaker ---
function SurveyTaker({ quizData, onSubmit, onCancel, isSubmitting }) {
  const [answers, setAnswers] = useState({});
  const [currentQ, setCurrentQ] = useState(0); 
  const containerRef = useRef(null); 
  const [isStarted, setIsStarted] = useState(false);
  const [nickname, setNickname] = useState("");
  const [inputEmail, setInputEmail] = useState(""); // 新增 Email
  const [startTime, setStartTime] = useState(null); 
  const [gameStartTime, setGameStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [times, setTimes] = useState({});
  const [interactionCount, setInteractionCount] = useState(0);

  // 🔴 載入中防呆
  if (!quizData || !quizData.questions || quizData.questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-400">
        <Loader2 className="animate-spin mb-2" size={32}/>
        <p>正在載入挑戰內容，請稍候...</p>
        <button onClick={onCancel} className="mt-4 text-sm text-indigo-500 hover:underline">返回首頁</button>
      </div>
    );
  }

  useEffect(() => {
    let interval;
    if (isStarted) {
      if(!gameStartTime) setGameStartTime(Date.now());
      setStartTime(Date.now()); 
      interval = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isStarted]);

  useEffect(() => {
    if(isStarted) setStartTime(Date.now());
  }, [currentQ]);

  const calculateStats = () => {
    const scores = {
      '觀察力': { val: 0, max: 0 }, 
      '決策力': { val: 0, max: 0 }, 
      '邏輯力': { val: 0, max: 0 }, 
      '反應力': { val: 0, count: 0 }, 
      '專注度': { val: 0, max: 0 } 
    };

    quizData.questions.forEach(q => {
      const ans = answers[q.id];
      const timeSpent = times[q.id] || 0;
      
      if (q.type === 'hotspot') { scores['觀察力'].max += 100; scores['專注度'].max += 20; }
      else if (q.type === 'sorting') { scores['決策力'].max += 100; scores['邏輯力'].max += 30; }
      else if (q.type === 'choice') { scores['邏輯力'].max += 100; scores['反應力'].count++; }

      if (ans) {
        scores['專注度'].val += 20; 
        
        if (q.type === 'choice') {
           const speedScore = Math.max(0, 100 - (timeSpent * 5));
           scores['反應力'].val += speedScore;
           
           let isCorrect = false;
           if (q.isMulti) {
              const correctOptions = q.options.filter(o => o.isCorrect).map(o => o.label);
              const userSelected = Array.isArray(ans) ? ans : [];
              isCorrect = correctOptions.length === userSelected.length && correctOptions.every(v => userSelected.includes(v));
           } else {
              const correctOption = q.options.find(o => o.isCorrect)?.label;
              isCorrect = ans === correctOption;
           }
           if (isCorrect) scores['邏輯力'].val += 100;
        } else if (q.type === 'hotspot') {
           const hits = (q.targets || []).filter(t => (ans || []).some(pin => isPointInPolygon(pin, t.points))).length;
           const accuracy = hits / (q.targets?.length || 1);
           scores['觀察力'].val += 100 * accuracy;
        } else if (q.type === 'sorting') {
           let correct = 0;
           q.items.forEach(i => { if (ans[i.id] === i.correctCategory) correct++; });
           const accuracy = correct / (q.items.length || 1);
           scores['決策力'].val += 100 * accuracy;
           if (accuracy === 1) scores['邏輯力'].val += 30;
        }
      }
    });

    return Object.keys(scores).map(subject => {
      const s = scores[subject];
      let finalScore = 0;
      if (subject === '反應力') {
         finalScore = s.count > 0 ? Math.round(s.val / s.count) : 0;
      } else {
         finalScore = s.max > 0 ? Math.round((s.val / s.max) * 100) : 50;
      }
      return { subject, A: Math.min(100, Math.max(10, finalScore)), fullMark: 100 };
    });
  };

  const handleAnswer = (val) => {
    const qId = quizData.questions[currentQ].id;
    const now = Date.now();
    const spent = (now - startTime) / 1000;
    setTimes(prev => ({ ...prev, [qId]: (prev[qId] || 0) + spent }));
    setStartTime(now);
    setInteractionCount(prev => prev + 1);

    const q = quizData.questions[currentQ];
    if (q.type === 'choice' && q.isMulti) {
      const current = answers[qId] || [];
      const exists = current.includes(val);
      const next = exists ? current.filter(v => v !== val) : [...current, val];
      setAnswers({ ...answers, [qId]: next });
    } else if (q.type === 'sorting') {
      setAnswers({ ...answers, [qId]: val });
    } else {
      setAnswers({ ...answers, [qId]: val });
    }
  };

  const handleNext = () => {
    if (currentQ < quizData.questions.length - 1) {
      setCurrentQ(currentQ + 1);
    } else {
      const finalStats = calculateStats();
      const totalTime = (Date.now() - gameStartTime) / 1000;
      onSubmit(answers, nickname, inputEmail, finalStats, totalTime);
    }
  };

  const currentStats = useMemo(() => calculateStats(), [answers, times]);

  if (!isStarted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] text-center space-y-8">
        <div className="p-6 bg-white rounded-full shadow-xl shadow-indigo-100 mb-4">
           <User size={64} className="text-indigo-600" />
        </div>
        <h2 className="text-4xl font-bold text-slate-800">歡迎來到挑戰賽</h2>
        <p className="text-slate-500 max-w-md">請輸入您的基本資料以開始遊戲。您的成績將會即時分析並列入排行榜。</p>
        <div className="flex flex-col gap-4 w-full max-w-xs">
          <input 
            className="w-full p-4 border-2 border-indigo-100 rounded-2xl text-center font-bold text-lg focus:border-indigo-500 outline-none transition-colors"
            placeholder="請輸入暱稱 (必填)"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
          />
          <input 
            className="w-full p-4 border-2 border-indigo-100 rounded-2xl text-center font-bold text-lg focus:border-indigo-500 outline-none transition-colors"
            placeholder="請輸入 Email (選填)"
            value={inputEmail}
            onChange={(e) => setInputEmail(e.target.value)}
          />
        </div>
        <button 
          onClick={() => { if(nickname.trim()) setIsStarted(true); }}
          disabled={!nickname.trim()}
          className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-bold text-xl shadow-lg hover:bg-indigo-700 disabled:bg-slate-300 transition-all flex items-center gap-2"
        >
          開始挑戰 <Play size={24} fill="currentColor"/>
        </button>
      </div>
    );
  }

  const q = quizData.questions[currentQ];
  const progress = ((currentQ + 1) / quizData.questions.length) * 100;

  return (
    <div className="flex flex-col lg:flex-row gap-8 h-full items-start" ref={containerRef}>
      <div className="flex-1 w-full max-w-2xl mx-auto">
        <div className="mb-6 flex justify-between items-end">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Level {currentQ + 1} / {quizData.questions.length}
          </div>
          <div className="flex items-center gap-4">
              <span className="text-indigo-600 font-bold">{nickname}</span>
              <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-sm font-bold flex items-center gap-2">
                <Clock size={16}/> {formatTime(elapsedTime)}
              </span>
              <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs font-bold flex items-center gap-1">
                <Star size={12} fill="currentColor"/> {q.points || 0}分
              </span>
          </div>
        </div>
        <div className="h-3 bg-slate-200 rounded-full overflow-hidden shadow-inner mb-8">
          <motion.div className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.8 }} />
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentQ}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="bg-white p-8 rounded-3xl shadow-2xl shadow-indigo-100 border border-white relative z-10"
          >
            <span className="inline-block bg-indigo-100 text-indigo-700 px-3 py-1 rounded-lg text-xs font-bold mb-4 uppercase tracking-widest">Challenge #{currentQ + 1}</span>
            <h3 className="text-2xl font-bold mb-8 text-slate-800 leading-relaxed">
              {q.text} 
              {q.isMulti && <span className="text-sm font-normal text-slate-500 ml-2">(可複選)</span>}
            </h3>

            {q.type === 'choice' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {q.options.map((opt, oIdx) => {
                  const label = typeof opt === 'string' ? opt : opt.label;
                  const image = typeof opt === 'string' ? "" : opt.image;
                  const currentAns = answers[q.id];
                  const selected = Array.isArray(currentAns) ? currentAns.includes(label) : currentAns === label;
                  
                  return (
                    <motion.button 
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      key={oIdx} 
                      onClick={() => handleAnswer(label)}
                      className={`text-left flex flex-col gap-2 p-4 border-2 rounded-2xl transition-all duration-200 h-full ${selected ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200' : 'border-slate-100 hover:border-indigo-200 hover:bg-slate-50'}`}
                    >
                      {image && <img src={image} className="w-full h-32 object-cover rounded-lg mb-2" />}
                      <div className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded flex-shrink-0 flex items-center justify-center border-2 ${q.isMulti ? 'rounded-md' : 'rounded-full'} ${selected ? 'bg-indigo-500 border-indigo-500' : 'border-slate-300'}`}>
                          {selected && <CheckCircle size={14} className="text-white" />}
                        </div>
                        <span className={`font-bold ${selected ? 'text-indigo-700' : 'text-slate-600'}`}>{label}</span>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            )}

            {q.type === 'hotspot' && (
              <HotspotQuestion q={q} currentAnswer={answers[q.id] || []} onAnswer={handleAnswer} />
            )}

            {q.type === 'sorting' && (
              <SortingQuestion q={q} currentAnswer={answers[q.id] || {}} onAnswer={handleAnswer} />
            )}

          </motion.div>
        </AnimatePresence>

        <div className="flex justify-between mt-8">
          <button onClick={() => setCurrentQ(Math.max(0, currentQ - 1))} disabled={currentQ === 0} className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-colors ${currentQ === 0 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-500 hover:bg-slate-100'}`}>
            <ChevronLeft size={20}/> 上一關
          </button>
          
          {/* 🔴 [修復] 改用純色背景，解決右下角按鈕全白的問題 */}
          <button 
            onClick={handleNext} 
            disabled={isSubmitting}
            className="px-8 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-105 transition-all disabled:opacity-50 disabled:bg-gray-400"
          >
            {isSubmitting ? <Loader2 className="animate-spin" size={20}/> : (currentQ === quizData.questions.length - 1 ? '完成挑戰' : '下一關')} 
            {!isSubmitting && <ChevronRight size={20}/>}
          </button>
        </div>
      </div>

      <div className="hidden lg:block w-80 sticky top-28">
        <div className="bg-white p-6 rounded-3xl shadow-xl border border-slate-100">
          <h4 className="text-center font-bold text-slate-800 mb-4 flex items-center justify-center gap-2"><Target size={18} className="text-pink-500"/> 即時能力分析</h4>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={currentStats}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 12, fontWeight: 'bold' }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar name="My Stats" dataKey="A" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.6} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="text-center text-xs text-slate-400 mt-2 flex justify-center gap-2">
              <span className="flex items-center gap-1"><Zap size={12}/> 反應: {currentStats.find(s=>s.subject==='反應力')?.A}</span>
              <span className="flex items-center gap-1"><Star size={12}/> 專注: {currentStats.find(s=>s.subject==='專注度')?.A}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function HotspotQuestion({ q, currentAnswer, onAnswer }) {
  const imgRef = useRef(null);

const handleClick = (e) => {
  if (!imgRef.current) return;
  const rect = imgRef.current.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * 100;
  const y = ((e.clientY - rect.top) / rect.height) * 100;
  const newPin = { id: Date.now(), x, y };

  // 🔥 新增限制邏輯 🔥
  const max = q.maxClicks || 1; // 如果沒設定，預設只能點 1 個
  let nextAns = [...currentAnswer];

  if (nextAns.length >= max) {
    // 如果滿了，把「最舊的」那個移除 (Shift)
    nextAns.shift();
  }
  
  // 加入新的
  onAnswer([...nextAns, newPin]);
};

  const removePin = (e, id) => {
    e.stopPropagation();
    onAnswer(currentAnswer.filter(p => p.id !== id));
  };

  return (
    <div className="relative rounded-2xl overflow-hidden border-4 border-slate-100 shadow-inner group select-none">
      <div className="relative w-full h-full aspect-video" onClick={handleClick}>
        <img ref={imgRef} src={q.image} className="w-full h-full object-contain cursor-crosshair pointer-events-none" />
        {currentAnswer.map((pin, idx) => (
          <motion.div
            key={pin.id}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute w-6 h-6 -ml-3 -mt-3 bg-indigo-600 border-2 border-white rounded-full shadow-lg flex items-center justify-center text-white text-xs font-bold cursor-pointer hover:bg-red-500 transition-colors z-10"
            style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
            onClick={(e) => removePin(e, pin.id)}
          >
            {idx + 1}
          </motion.div>
        ))}
      </div>
<div className="absolute bottom-4 left-4 bg-black/70 text-white text-xs px-3 py-1 rounded-full backdrop-blur-md pointer-events-none border border-white/20 shadow-lg">
  {/* 顯示目前的標記進度 */}
  標記進度：{currentAnswer.length} / {q.maxClicks || 1} (點擊畫面新增)
</div>
    </div>
  );
}

function SortingQuestion({ q, currentAnswer, onAnswer }) {
  const [positions, setPositions] = useState({}); 
  const [draggingId, setDraggingId] = useState(null);

  const allItems = q.items.map(i => typeof i === 'string' ? { id: i, text: i, image: '' } : i);

  return (
    <div className="space-y-8 select-none">
      {/* 待分類區 */}
      <motion.div layout className="flex gap-3 flex-wrap justify-center min-h-[100px] p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
        <AnimatePresence>
          {allItems.filter(item => !currentAnswer[item.id]).map(item => (
            <DraggableItem 
              key={item.id} 
              item={item} 
              positions={positions} 
              isDragging={draggingId === item.id}
              setDraggingId={setDraggingId}
              onDrop={(cat) => {
                 onAnswer({ ...currentAnswer, [item.id]: cat });
              }}
            />
          ))}
        </AnimatePresence>
        {allItems.every(i => currentAnswer[i.id]) && <div className="text-slate-400 text-sm italic w-full text-center py-4">所有項目已分類</div>}
      </motion.div>

      {/* 分類籃 */}
      <div className="grid grid-cols-2 gap-4">
        {q.categories.map(cat => (
          <div 
            key={cat} 
            ref={(el) => {
              if (el) {
                const rect = el.getBoundingClientRect();
                if (!positions[cat] || positions[cat].top !== rect.top) {
                   setPositions(prev => ({ ...prev, [cat]: rect }));
                }
              }
            }}
            className="min-h-[150px] border-2 border-indigo-100 rounded-2xl flex flex-col items-center p-4 bg-indigo-50/50 transition-colors hover:border-indigo-300 relative"
          >
            <span className="font-bold text-indigo-400 mb-2">{cat}</span>
            <div className="flex flex-wrap gap-2 w-full justify-center z-10">
              <AnimatePresence>
                {allItems.filter(item => currentAnswer[item.id] === cat).map(item => (
                  <DraggableItem 
                    key={item.id} 
                    item={item} 
                    positions={positions} 
                    isSorted={true}
                    isDragging={draggingId === item.id}
                    setDraggingId={setDraggingId}
                    onDrop={(targetCat) => {
                       if (targetCat === cat) return;
                       const next = { ...currentAnswer };
                       if (targetCat) next[item.id] = targetCat;
                       else delete next[item.id];
                       onAnswer(next);
                    }}
                  />
                ))}
              </AnimatePresence>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-center text-slate-400">💡 提示：項目可在籃子間自由拖曳，或拖回上方重置。</p>
    </div>
  );
}
function DraggableItem({ item, positions, onDrop, isSorted, isDragging, setDraggingId }) {
  // 1. 新增控制放大的狀態
  const [showZoom, setShowZoom] = useState(false);

  return (
    <>
      <motion.div 
        layout
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }} 
        drag 
        dragElastic={0.2}
        whileDrag={{ scale: 1.1, cursor: 'grabbing' }}
        dragMomentum={false}
        onPointerDown={() => setDraggingId(item.id)} 
        onPointerUp={() => setDraggingId(null)}
        onDragEnd={(e, info) => {
          setDraggingId(null);
          const dropPoint = { x: e.clientX, y: e.clientY };
          let matchedCategory = null;
          Object.keys(positions).forEach(cat => {
            const rect = positions[cat];
            if (dropPoint.x >= rect.left && dropPoint.x <= rect.right &&
                dropPoint.y >= rect.top && dropPoint.y <= rect.bottom) {
              matchedCategory = cat;
            }
          });
          onDrop(matchedCategory);
        }}
        className={`
          ${isSorted ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600'} 
          rounded-lg shadow-sm border border-slate-200 cursor-grab font-bold 
          flex flex-col items-center justify-center p-2 gap-1 select-none w-24 relative group
        `}
        style={{ zIndex: isDragging ? 9999 : 10 }} 
      >
        {item.image ? (
          <div className="w-full h-16 rounded overflow-hidden bg-slate-100 relative">
            <img src={item.image} className="w-full h-full object-cover pointer-events-none"/>
            
            {/* 2. 新增放大鏡按鈕 (避免觸發拖曳，使用 stopPropagation) */}
            <button 
              className="absolute bottom-0 right-0 bg-black/60 text-white p-1 rounded-tl-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-indigo-600"
              onPointerDown={(e) => {
                e.stopPropagation(); // 防止觸發拖曳
                setShowZoom(true);   // 開啟大圖
              }}
            >
              <Maximize size={12} />
            </button>
          </div>
        ) : null}
        <span className="text-xs truncate w-full text-center">{item.text}</span>
      </motion.div>

      {/* 3. 全螢幕大圖 (使用 Portal 傳送到 body 層級，避免被拖曳卡片裁切) */}
      {showZoom && ReactDOM.createPortal(
        <div 
          className="fixed inset-0 z-[10000] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={(e) => { e.stopPropagation(); setShowZoom(false); }}
        >
          <div className="relative max-w-4xl max-h-full animate-in fade-in zoom-in duration-300">
            <img 
              src={item.image} 
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl border border-white/20" 
              alt="Zoomed Preview"
            />
            <button 
              onClick={() => setShowZoom(false)}
              className="absolute -top-12 right-0 text-white hover:text-red-400 transition-colors bg-white/10 p-2 rounded-full"
            >
              <X size={24} />
            </button>
            <p className="text-white text-center mt-4 font-bold text-lg">{item.text}</p>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

// --- 組件 4：ResultView (修復顯示版) ---
function ResultView({ quizData, userAnswers, stats, totalTime, onBack }) {
  const renderPolygon = (points) => {
    if (!points) return "";
    return points.map(p => `${p.x},${p.y}`).join(' ');
  };

  let totalScore = 0;
  let maxScore = 0;

  const results = quizData.questions.map(q => {
    const userAns = userAnswers[q.id];
    const points = Number(q.points) || 0;
    maxScore += points;
    let gainedPoints = 0;
    let isCorrect = false;
    let detail = "";
    let sortingErrors = [];

    if (q.type === 'choice') {
      if (q.isMulti) {
         // --- 複選題邏輯 (改為換行顯示) ---
         const correctOptions = q.options.filter(o => o.isCorrect).map(o => o.label);
         const userSelected = Array.isArray(userAns) ? userAns : [];
         
         // 判斷是否全對
         isCorrect = correctOptions.length === userSelected.length && correctOptions.every(v => userSelected.includes(v));
         
         const userStr = userSelected.length > 0 ? userSelected.join('、') : '未作答';
         
         // 🔥 修改重點：將 detail 改成 JSX 物件，才能做排版
         detail = (
           <div className="flex flex-col gap-1 mt-1">
             <div>您的選擇: {userStr}</div>
             
             {/* 分隔線 + 正確答案列表 */}
             <div className="mt-1 pt-1 border-t border-current opacity-90">
               <span className="block mb-1">正確答案：</span>
               <ul className="list-none pl-2 m-0 space-y-1">
                 {correctOptions.map((opt, i) => (
                   <li key={i} className="flex items-start">
                     <span className="mr-1.5">•</span>
                     <span>{opt}</span>
                   </li>
                 ))}
               </ul>
             </div>
           </div>
         );

      } else {
         // --- 單選題邏輯 (保持一行即可) ---
         const correctOption = q.options.find(o => o.isCorrect)?.label;
         isCorrect = userAns === correctOption;
         
         // 單選題比較短，維持單行顯示較美觀
         const userVal = (userAns === undefined || userAns === null) ? '未作答' : userAns;
         const correctVal = correctOption || '未設定';
         detail = `您的答案: ${userVal} (正確答案: ${correctVal})`;
      }
      
      if (isCorrect) gainedPoints = points;
    

    } else if (q.type === 'hotspot') {
      const targetHits = (q.targets || []).map(t => {
         const hit = (userAns || []).some(pin => isPointInPolygon(pin, t.points));
         return hit;
      });
      const hitCount = targetHits.filter(h => h).length;
      const totalTargets = q.targets?.length || 0;
      isCorrect = hitCount === totalTargets && totalTargets > 0;
      gainedPoints = totalTargets > 0 ? Math.round((hitCount / totalTargets) * points) : 0;
      detail = `命中 ${hitCount} / ${totalTargets} 個目標`;

    } else if (q.type === 'sorting') {
      const userMap = userAns || {};
      let correctCount = 0;
      
      q.items.forEach(item => {
         const userCat = userMap[item.id];
         if (userCat) {
           if (item.correctCategory && userCat !== item.correctCategory) {
             sortingErrors.push(`${item.text}: 應為 ${item.correctCategory} (誤植: ${userCat})`);
           } else if (item.correctCategory && userCat === item.correctCategory) {
             correctCount++;
           }
         } else {
           sortingErrors.push(`${item.text}: 未分類`);
         }
      });
      
      const totalItems = q.items.length || 1;
      isCorrect = correctCount === totalItems;
      gainedPoints = Math.round((correctCount / totalItems) * points);
      detail = `正確分類 ${correctCount} / ${totalItems}`;
    }

    totalScore += gainedPoints;
    return { ...q, isCorrect, detail, userAns, gainedPoints, sortingErrors };
  });

  return (
    <div className="max-w-4xl mx-auto bg-white p-8 rounded-3xl shadow-xl border border-slate-100 flex flex-col md:flex-row gap-8">
      {/* 左側：總分與雷達 */}
      <div className="w-full md:w-1/3 flex flex-col items-center border-b md:border-b-0 md:border-r border-slate-100 pb-8 md:pb-0 md:pr-8">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-slate-800 mb-2">挑戰成績單</h2>
          <div className="text-5xl font-black text-indigo-600">
            {totalScore} <span className="text-lg text-slate-400 font-medium">/ {maxScore}</span>
          </div>
          <div className="text-sm text-slate-500 mt-2 font-bold flex items-center justify-center gap-1">
              <Clock size={14}/> 總耗時: {formatTime(totalTime || 0)}
          </div>
        </div>
        
        {/* 個人雷達圖 */}
        {stats && (
          <div className="w-full h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={stats}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar name="My Stats" dataKey="A" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.6} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        )}
        
        <button onClick={onBack} className="w-full mt-auto py-3 bg-slate-800 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-900 transition-all">
          <RefreshCw size={18}/> 返回首頁
        </button>
      </div>

      {/* 右側：詳細題解 */}
      <div className="flex-1 space-y-6 overflow-y-auto max-h-[600px] pr-2">
        <h3 className="text-lg font-bold text-slate-700 mb-4">詳細題解</h3>
        {results.map((r, idx) => (
          <div key={r.id} className="border-b border-slate-100 pb-4 last:border-0">
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1">
                <span className="text-xs font-bold text-slate-400 block mb-1">Q{idx+1} ({r.points}分)</span>
                <h4 className="font-bold text-slate-800">{r.text}</h4>
              </div>
              <div className="text-right">
                <span className={`text-sm font-bold ${r.gainedPoints === Number(r.points) ? 'text-green-500' : 'text-orange-500'}`}>
                  +{r.gainedPoints} 分
                </span>
              </div>
            </div>
            
            {/* 熱點題視覺化 */}
            {r.type === 'hotspot' && r.image && (
              <div className="relative aspect-video bg-slate-100 rounded-lg overflow-hidden mt-2 border-2 border-slate-200 mb-2">
                <ZoomableImage 
                  src={r.image} 
                  alt="題目圖片"
                  markers={r.userAns || []} 
                  onClick={() => {}} 
                />
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" viewBox="0 0 100 100" preserveAspectRatio="none">
                  {r.targets?.map((t, i) => (
                    <polygon key={i} points={renderPolygon(t.points)} fill="rgba(34, 197, 94, 0.4)" stroke="#22c55e" strokeWidth="1" vectorEffect="non-scaling-stroke"/>
                  ))}
                </svg>
              </div>
            )}

            {/* 分類錯誤顯示 */}
            {r.type === 'sorting' && r.sortingErrors && r.sortingErrors.length > 0 && (
              <div className="bg-red-50 p-3 rounded-lg text-xs text-red-600 mt-2 space-y-1 border border-red-100">
                <div className="font-bold mb-1">錯誤項目：</div>
                {r.sortingErrors.map((err, i) => <div key={i}>• {err}</div>)}
              </div>
            )}
            
            {/* 🔥 選擇題顯示 (這裡就是您問題的核心) 🔥 */}
            {r.type === 'choice' && (
               <div className={`text-sm font-bold mt-1 ${r.isCorrect ? 'text-indigo-600' : 'text-red-500'}`}>
                 {r.detail}
               </div>
            )}
            
            {/* 其他題型顯示 */}
            {r.type !== 'choice' && <p className="text-sm text-slate-500 mt-1">{r.detail}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

// --- 組件 5：StatsDashboard (修復下拉選單與刪除按鈕) ---
function StatsDashboard({ quizData, responses }) {
  const [selectedUser, setSelectedUser] = useState("all");

  const stats = useMemo(() => {
    return quizData.questions.map(q => {
      if (q.type === 'hotspot') {
        let pass = 0;
        let fail = 0;
        responses.forEach(r => {
           const ans = r.answers[q.id] || [];
           const targetHits = (q.targets || []).map(t => ans.some(pin => isPointInPolygon(pin, t.points))).filter(h => h).length;
           if (targetHits === (q.targets?.length || 0) && targetHits > 0) pass++;
           else fail++;
        });
        return { 
           type: 'hotspot', 
           title: q.text, 
           data: [
             { name: '完全正確', value: pass }, 
             { name: '未通過', value: fail }
           ] 
        };
      } else if (q.type === 'sorting') {
        // 分類題細項分析
        const itemStats = {};
        q.items.forEach(item => {
           itemStats[item.text] = { correct: 0, wrong: 0 };
        });
        
        responses.forEach(r => {
           const ans = r.answers[q.id] || {};
           q.items.forEach(item => {
              const userCat = ans[item.id];
              if (userCat) {
                 if (userCat === item.correctCategory) itemStats[item.text].correct++;
                 else itemStats[item.text].wrong++;
              }
           });
        });
        
        return {
           type: 'sorting',
           title: q.text,
           data: Object.keys(itemStats).map(key => ({
              name: key,
              correct: itemStats[key].correct,
              wrong: itemStats[key].wrong
           }))
        };
      } else {
        const counts = {};
        if (q.type === 'choice') q.options.forEach(opt => counts[typeof opt === 'string' ? opt : opt.label] = 0);
        
        responses.forEach(r => { 
          const ans = r.answers[q.id];
          if (q.type === 'choice') {
             if (Array.isArray(ans)) ans.forEach(v => counts[v] = (counts[v] || 0) + 1);
             else if (ans) counts[ans] = (counts[ans] || 0) + 1;
          } else {
             if (ans) counts['已作答'] = (counts['已作答'] || 0) + 1;
          }
        });
        return { type: 'normal', title: q.text, data: Object.keys(counts).map(k => ({ name: k, value: counts[k] })) };
      }
    });
  }, [quizData, responses]);

  // --- 新增：計算易錯題排行榜 (Top 5) ---
  const topWrongQuestions = useMemo(() => {
    if (responses.length === 0) return [];

    const calculated = quizData.questions
    .filter(q => Number(q.points) > 0)
    .map(q => {
      let totalAccuracy = 0; // 累積所有人的正確率 (0~1)
      
      responses.forEach(r => {
        const ans = r.answers[q.id];
        let accuracy = 0; // 該使用者的該題正確率

        if (q.type === 'choice') {
          // 選擇題：全對才算 1，否則 0
          if (q.isMulti) {
            const correctOptions = q.options.filter(o => o.isCorrect).map(o => o.label);
            const userSelected = Array.isArray(ans) ? ans : [];
            const isCorrect = correctOptions.length === userSelected.length && correctOptions.every(v => userSelected.includes(v));
            accuracy = isCorrect ? 1 : 0;
          } else {
            const correctOption = q.options.find(o => o.isCorrect)?.label;
            accuracy = ans === correctOption ? 1 : 0;
          }
        } else if (q.type === 'hotspot') {
          // 熱點題：(命中數 / 總目標數)
          const totalTargets = q.targets?.length || 1;
          const hits = (q.targets || []).filter(t => (ans || []).some(pin => isPointInPolygon(pin, t.points))).length;
          accuracy = hits / totalTargets;
        } else if (q.type === 'sorting') {
          // 分類題：(分類正確數 / 總項目數)
          const totalItems = q.items.length || 1;
          let correct = 0;
          q.items.forEach(i => { if (ans && ans[i.id] === i.correctCategory) correct++; });
          accuracy = correct / totalItems;
        }

        totalAccuracy += accuracy;
      });

      // 平均錯誤率 = 100% - (平均正確率 %)
      const avgAccuracy = totalAccuracy / responses.length;
      return {
        id: q.id,
        text: q.text,
        type: q.type,
        errorRate: Math.round((1 - avgAccuracy) * 100)
      };
    });

    // 排序：錯誤率由高到低，取前 5 名
    return calculated.sort((a, b) => b.errorRate - a.errorRate).slice(0, 10);
  }, [quizData, responses]);

  const selectedUserData = responses.find(r => r.id === selectedUser);

  if (responses.length === 0) return <div className="p-20 text-center bg-white rounded-3xl shadow text-slate-400">尚無數據，請先進行挑戰</div>;

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 print:hidden">
        <h2 className="text-2xl font-bold flex items-center gap-2"><BarChart3 className="text-orange-500"/> 戰情分析室</h2>
        <div className="flex gap-3 items-center">
          <div className="relative">
            <select 
              value={selectedUser} 
              onChange={(e) => setSelectedUser(e.target.value)}
              className="pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer"
            >
              <option value="all">📊 檢視整體數據</option>
              {responses.map(r => (
                <option key={r.id} value={r.id}>{r.nickname || 'Guest'} ({new Date(r.submittedAt?.seconds * 1000).toLocaleTimeString()})</option>
              ))}
            </select>
            <Search size={16} className="absolute left-3 top-3 text-slate-400 pointer-events-none"/>
          </div>
          <button onClick={() => exportToCSV(quizData, responses)} className="bg-green-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-green-700 flex items-center gap-2 shadow-lg shadow-green-200 transition-all">
            <Download size={18}/> 匯出 CSV
          </button>
        </div>
      </div>

      {selectedUser !== 'all' && selectedUserData ? (
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-indigo-100 relative">
           <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold flex items-center gap-2 text-indigo-700">
                <User size={24}/> {selectedUserData.nickname || 'Guest'} 的詳細戰績
              </h3>
              <button 
                onClick={() => setSelectedUser('all')}
                className="text-slate-400 hover:text-slate-600 text-sm"
              >
                返回總覽
              </button>
           </div>
           <ResultView quizData={quizData} userAnswers={selectedUserData.answers} stats={selectedUserData.stats} totalTime={selectedUserData.totalTime} onBack={() => setSelectedUser("all")} />
        </div>
// ... (上接 StatsDashboard 的內容)
      ) : (
        <div className="space-y-8">
          
          {/* 🔥 Part 1: 新增的易錯題排行榜 (放在最上面) 🔥 */}
          {topWrongQuestions.length > 0 && (
            <div className="bg-white p-6 rounded-3xl shadow-lg border border-red-100">
              <h3 className="text-xl font-bold text-red-600 mb-4 flex items-center gap-2">
                <AlertCircle className="fill-red-100"/> 
                易錯題排行榜 (Top 10)
              </h3>
              <div className="grid gap-4">
                {topWrongQuestions.map((q, idx) => (
                  <div key={q.id} className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
                    <div className={`w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full font-bold text-lg ${idx === 0 ? 'bg-red-500 text-white shadow-red-200 shadow-lg' : 'bg-white text-slate-500 border'}`}>
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between mb-1">
                        <span className="font-bold text-slate-700 truncate max-w-[200px] md:max-w-md">{q.text}</span>
                        <span className="font-bold text-red-500">{q.errorRate}% 錯誤率</span>
                      </div>
                      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-red-500 rounded-full transition-all duration-1000" 
                          style={{ width: `${q.errorRate}%` }} 
                        />
                      </div>
                    </div>
                    <span className="text-xs px-2 py-1 bg-white border rounded text-slate-400 font-medium hidden md:block">
                      {q.type === 'hotspot' ? '熱點' : q.type === 'sorting' ? '分類' : '選擇'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 🔥 Part 2: 原本的圖表 Grid (被擠到下面) 🔥 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 print:block print:space-y-8">
            {stats.map((s, i) => (
              <div key={i} className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow break-inside-avoid">
                <h4 className="font-bold text-lg mb-8 border-l-4 border-indigo-500 pl-4 text-slate-700">{s.title}</h4>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    {s.type === 'hotspot' ? (
                      <PieChart>
                        <Pie data={s.data} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                          <Cell fill="#10B981" /> 
                          <Cell fill="#EF4444" /> 
                        </Pie>
                        <RechartsTooltip />
                        <Legend />
                      </PieChart>
                    ) : s.type === 'sorting' ? (
                      <BarChart data={s.data} layout="vertical" margin={{ left: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false}/>
                        <XAxis type="number" />
                        <YAxis dataKey="name" type="category" width={80} tick={{fontSize: 10}} />
                        <RechartsTooltip />
                        <Legend />
                        <Bar dataKey="correct" name="正確歸類" stackId="a" fill="#10B981" />
                        <Bar dataKey="wrong" name="歸類錯誤" stackId="a" fill="#EF4444" />
                      </BarChart>
                    ) : (
                      <BarChart data={s.data} layout="vertical" margin={{ left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9"/>
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12, fill: '#64748b'}} />
                        <RechartsTooltip cursor={{fill: '#f8fafc'}} />
                        <Bar dataKey="value" fill="#6366f1" radius={[0, 6, 6, 0]} barSize={20}>
                          {s.data.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    {/* 👇👇👇 重點修正：這裡原本缺了這兩行 👇👇👇 */}
    </div>
  );
}
// 👆👆👆 修正結束，以下接著 HomeView 👆👆👆

function HomeView({ quizTitle, responseCount, onNavigate, isAdmin }) {
  return (
    <div className="space-y-16 py-10 relative z-10">
      <div className="text-center space-y-6">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.5, type: "spring" }} className="inline-block p-6 bg-white rounded-[2rem] shadow-2xl shadow-indigo-200 mb-4 rotate-3">
           {/* 🔴 [修復] 改用純色背景，解決 GO 按鈕全白的問題 */}
           <div className="bg-indigo-600 text-white w-24 h-24 rounded-2xl flex items-center justify-center text-4xl font-bold shadow-xl">Go</div>
        </motion.div>
        <div>
          <h2 className="text-6xl font-black text-slate-800 tracking-tight mb-2">{quizTitle}</h2>
          <p className="text-xl text-slate-500 font-medium">準備好挑戰你的極限了嗎？</p>
        </div>
        {isAdmin && <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="inline-block bg-white text-indigo-600 px-8 py-3 rounded-full font-bold shadow-lg border border-indigo-50">🔥 已有 {responseCount} 人完成挑戰</motion.div>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 px-4">
        {[
          { id: 'admin', icon: Edit3, color: 'text-white', bg: 'bg-indigo-600', title: '設計關卡', desc: '管理者專用' },
          { id: 'survey', icon: CheckSquare, color: 'text-white', bg: 'bg-pink-500', title: '開始挑戰', desc: '進入遊戲世界' },
          { id: 'stats', icon: BarChart3, color: 'text-white', bg: 'bg-orange-500', title: '排行榜', desc: '查看數據分析' },
        ].map((item) => (
          <motion.div whileHover={{ y: -10, rotate: 1 }} key={item.id} onClick={() => onNavigate(item.id)} className="bg-white p-8 rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 cursor-pointer group relative overflow-hidden">
            <div className={`absolute top-0 right-0 w-32 h-32 ${item.bg} opacity-10 rounded-bl-[100%] transition-transform group-hover:scale-150 duration-500`}/>
            <div className={`w-16 h-16 ${item.bg} ${item.color} rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:rotate-12 transition-transform duration-300`}>
              <item.icon size={32} />
            </div>
            <h3 className="text-2xl font-bold mb-2 text-slate-800">{item.title}</h3>
            <p className="text-slate-400 font-medium">{item.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// --- 修改後的權限驗證組件 ---
function AdminAuthWrapper({ children, onCancel, user }) {
  const handleLogin = () => signInWithPopup(auth, new GoogleAuthProvider());
  
  if (!user || !ADMIN_EMAILS.includes(user.email)) {
    return (
      <div className="max-w-md mx-auto bg-white p-10 rounded-3xl shadow-2xl text-center mt-10">
        <Lock className="mx-auto mb-4 text-indigo-600" size={48} />
        <h2 className="text-2xl font-bold mb-8">管理員授權</h2>
        <button onClick={handleLogin} className="w-full py-4 border-2 rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-slate-50 transition-colors">
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6" /> Google 登入
        </button>
        <button onClick={onCancel} className="mt-6 text-gray-400 hover:text-gray-600">返回</button>
      </div>
    );
  }
  return children;
}
// ==========================================
// 修正版：放大鏡圖片元件 (修復座標偏移問題)
// ==========================================
const ZoomableImage = ({ src, alt, onClick, markers = [] }) => {
  const [showMagnifier, setShowMagnifier] = React.useState(false);
  const [cursorPosition, setCursorPosition] = React.useState({ x: 0, y: 0 });
  const [imgSize, setImgSize] = React.useState({ width: 0, height: 0 });

  // 處理滑鼠/手指移動
  const handleMouseMove = (e) => {
    // 取得容器的尺寸，而非圖片原始尺寸
    const { top, left, width, height } = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - left;
    const y = e.clientY - top;
    setImgSize({ width, height });
    setCursorPosition({ x, y });
    setShowMagnifier(true);
  };

  return (
    <div 
      // 🔥 修改 1: 加上 w-full h-full 確保填滿外層的 aspect-video 容器
      className="relative w-full h-full overflow-hidden rounded-xl shadow-lg cursor-crosshair group bg-slate-100"
      onMouseEnter={() => setShowMagnifier(true)}
      onMouseLeave={() => setShowMagnifier(false)}
      onMouseMove={handleMouseMove}
      onClick={onClick} 
    >
      {/* 原始圖片 */}
      <img 
        src={src} 
        alt={alt} 
        // 🔥 修改 2: 改回 object-contain (這一行最關鍵！讓圖片縮放比例跟題目設計時一致)
        className="w-full h-full object-contain pointer-events-none" 
      />

      {/* 顯示已經標記的點 (綠色/紅色圓點) */}
      {markers.map((mark, index) => (
        <div
          key={index}
          className="absolute w-4 h-4 bg-green-500 rounded-full border-2 border-white transform -translate-x-1/2 -translate-y-1/2 shadow-sm z-20"
          style={{ left: `${mark.x}%`, top: `${mark.y}%` }}
        />
      ))}

      {/* 放大鏡鏡頭 */}
      {showMagnifier && (
        <div 
          className="absolute pointer-events-none border-2 border-white rounded-full shadow-2xl z-50 bg-no-repeat bg-slate-50"
          style={{
            height: "150px", 
            width: "150px",
            top: `${cursorPosition.y - 75}px`, 
            left: `${cursorPosition.x - 75}px`,
            // 這裡使用背景圖模擬放大，因為是 object-contain，放大鏡邊緣可能會看到留白是正常的
            backgroundImage: `url('${src}')`,
            backgroundSize: `${imgSize.width * 2}px ${imgSize.height * 2}px`, // 稍微調整放大倍率為 2 倍
            backgroundPosition: `${-cursorPosition.x * 2 + 75}px ${-cursorPosition.y * 2 + 75}px`
          }}
        />
      )}
    </div>
  );
};