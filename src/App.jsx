import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  onSnapshot, 
  query, 
  serverTimestamp 
} from 'firebase/firestore';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
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
  ShieldAlert
} from 'lucide-react';

// --- 1. Firebase 配置 ---
const firebaseConfig = {
  apiKey: "AIzaSyAKCRTN4BWMqpL2e6svx1FLN5RiJIdYRtk",
  authDomain: "icc-test-4286c.firebaseapp.com",
  projectId: "icc-test-4286c",
  storageBucket: "icc-test-4286c.firebasestorage.app",
  messagingSenderId: "353118805586",
  appId: "1:353118805586:web:dd46d68792746c4b33c98b",
  measurementId: "G-J3L4C7B70P"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const appId = 'my-survey-app';
const QUIZ_ID = 'global_shared_quiz'; 
const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
const ADMIN_EMAILS = ["alanlai0933.ai@gmail.com", "alanlai0933@gmail.com"];

// --- 2. 輔助函數 ---
const compressImage = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 500;
        const scale = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
};

const exportToCSV = (quizData, responses) => {
  const headers = ['提交時間', '使用者ID', 'Email'];
  quizData.questions.forEach((q, idx) => headers.push(`Q${idx + 1}: ${q.text}`));
  const rows = responses.map(r => {
    const date = r.submittedAt ? new Date(r.submittedAt.seconds * 1000).toLocaleString('zh-TW') : 'N/A';
    const rowData = [date, r.userId || 'Unknown', r.userEmail || 'Anonymous'];
    quizData.questions.forEach(q => {
      let ans = r.answers[q.id];
      if (Array.isArray(ans)) ans = ans.join('; ');
      rowData.push(`"${String(ans || '').replace(/"/g, '""')}"`);
    });
    return rowData.join(',');
  });
  const csvContent = '\uFEFF' + headers.join(',') + '\n' + rows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `問卷結果_${new Date().toISOString().slice(0,10)}.csv`);
  link.click();
};

// --- 3. 主要 App 元件 ---
export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('home'); 
  const [loading, setLoading] = useState(true);
  const [quizData, setQuizData] = useState({ title: "未命名問卷", questions: [] });
  const [responses, setResponses] = useState([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        try { await signInAnonymously(auth); } catch (e) { console.error("Auth Error", e); }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const quizRef = doc(db, 'artifacts', appId, 'public', 'data', 'quizzes', QUIZ_ID);
    return onSnapshot(quizRef, (snap) => {
      if (snap.exists()) setQuizData(snap.data());
    });
  }, [user]);

  useEffect(() => {
    if (!user || !ADMIN_EMAILS.includes(user.email)) { setResponses([]); return; }
    const ref = collection(db, 'artifacts', appId, 'public', 'data', `responses_${QUIZ_ID}`);
    return onSnapshot(query(ref), (snap) => {
      const data = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() }));
      setResponses(data);
    });
  }, [user]);

  const handleSaveQuiz = async (data) => {
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'quizzes', QUIZ_ID), data);
      alert("問卷已發布！");
      setView('home');
    } catch (e) { alert("儲存失敗，請檢查管理員 Email 是否正確。"); }
  };

  const handleSubmitResponse = async (ans) => {
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', `responses_${QUIZ_ID}`), {
        answers: ans, submittedAt: serverTimestamp(), userId: user.uid, userEmail: user.email || 'anonymous'
      });
      alert("提交成功，感謝參與！");
      setView('home');
    } catch (e) { alert("提交失敗：" + e.message); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">系統初始化中...</div>;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      <header className="bg-white shadow-sm sticky top-0 z-10 border-b">
        <div className="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('home')}>
            <div className="bg-blue-600 text-white p-2 rounded-lg"><CheckSquare size={20} /></div>
            <h1 className="text-xl font-bold">雲端問卷大師</h1>
          </div>
          <div className="flex items-center gap-4">
            {user?.email && <span className="text-xs text-gray-500">管理者: {user.email}</span>}
            {view !== 'home' && (
              <button onClick={() => setView('home')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600">
                <ArrowLeft size={16} /> 返回
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        {view === 'home' && <HomeView quizTitle={quizData.title} responseCount={responses.length} onNavigate={setView} isAdmin={ADMIN_EMAILS.includes(user?.email)} />}
        {view === 'admin' && <AdminAuthWrapper user={user} onCancel={() => setView('home')}><AdminPanel initialData={quizData} onSave={handleSaveQuiz} /></AdminAuthWrapper>}
        {view === 'survey' && <SurveyTaker quizData={quizData} onSubmit={handleSubmitResponse} onCancel={() => setView('home')} />}
        {view === 'stats' && <StatsDashboard quizData={quizData} responses={responses} />}
      </main>
    </div>
  );
}

// --- 子組件：AdminPanel (圖片編輯功能恢復) ---
function AdminPanel({ initialData, onSave }) {
  const [title, setTitle] = useState(initialData.title || "");
  const [questions, setQuestions] = useState(initialData.questions || []);

  const addQuestion = () => setQuestions([...questions, { 
    id: Date.now().toString(), 
    text: "新問題", 
    type: "single", 
    hasImages: false, 
    options: ["選項 1", "選項 2"], 
    images: ["", "", "", ""] 
  }]);

  const updateQuestion = (idx, field, val) => {
    const next = [...questions];
    next[idx][field] = val;
    setQuestions(next);
  };

  const handleImageUpload = async (qIdx, imgIdx, file) => {
    if (!file) return;
    try {
      const base64 = await compressImage(file);
      const next = [...questions];
      next[qIdx].images[imgIdx] = base64;
      setQuestions(next);
    } catch (e) { alert("圖片處理錯誤"); }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden border">
      <div className="bg-indigo-600 p-6 flex justify-between items-center text-white text-xl font-bold">
        <span>問卷編輯器</span>
        <button onClick={() => onSave({ title, questions })} className="bg-white text-indigo-600 px-6 py-2 rounded-xl text-sm shadow-sm hover:bg-gray-50"><Save size={18}/></button>
      </div>
      <div className="p-8 space-y-8">
        <input className="w-full text-2xl font-bold border-b-2 p-2 outline-none focus:border-indigo-500" value={title} onChange={e => setTitle(e.target.value)} placeholder="問卷標題" />
        <div className="space-y-6">
          {questions.map((q, qIdx) => (
            <div key={q.id} className="p-6 bg-gray-50 rounded-2xl border relative space-y-4">
              <button className="absolute top-4 right-4 text-gray-300 hover:text-red-500" onClick={() => setQuestions(questions.filter((_, i) => i !== qIdx))}><Trash2 size={20}/></button>
              <input className="w-full p-3 border rounded-xl font-medium" value={q.text} onChange={e => updateQuestion(qIdx, 'text', e.target.value)} />
              
              <div className="flex gap-4 items-center">
                <select className="p-2 border rounded-lg text-sm" value={q.type} onChange={e => updateQuestion(qIdx, 'type', e.target.value)}>
                  <option value="single">單選題</option>
                  <option value="multi">複選題</option>
                </select>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={q.hasImages} onChange={e => updateQuestion(qIdx, 'hasImages', e.target.checked)} />
                  <ImageIcon size={16}/> 啟用圖片選項
                </label>
              </div>

              {q.hasImages && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[0, 1, 2, 3].map(imgIdx => (
                    <div key={imgIdx} className="space-y-2">
                      <div className="aspect-square bg-white border-2 border-dashed rounded-xl flex items-center justify-center overflow-hidden relative group">
                        {q.images[imgIdx] ? (
                            <img src={q.images[imgIdx]} className="w-full h-full object-cover" />
                        ) : (
                            <div className="text-gray-300 text-xs text-center"><Upload size={20}/><br/>點擊上傳</div>
                        )}
                        <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => handleImageUpload(qIdx, imgIdx, e.target.files[0])} />
                      </div>
                      <input className="w-full text-[10px] p-1 border rounded" placeholder="或貼網址" value={q.images[imgIdx]?.startsWith('data:') ? '(已選中圖片)' : q.images[imgIdx]} onChange={e => {
                          const next = [...questions]; next[qIdx].images[imgIdx] = e.target.value; setQuestions(next);
                      }} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          <button onClick={addQuestion} className="w-full py-6 border-2 border-dashed rounded-2xl text-gray-400 hover:bg-gray-100">+ 新增題目</button>
        </div>
      </div>
    </div>
  );
}

// --- 子組件：SurveyTaker (圖片顯示功能恢復) ---
function SurveyTaker({ quizData, onSubmit, onCancel }) {
  const [answers, setAnswers] = useState({});
  const handleOptionChange = (qId, type, val) => {
    if (type === 'single') setAnswers({...answers, [qId]: val});
    else {
      const curr = answers[qId] || [];
      const next = curr.includes(val) ? curr.filter(v => v !== val) : [...curr, val];
      setAnswers({...answers, [qId]: next});
    }
  };
  const canSubmit = quizData.questions.length > 0 && quizData.questions.every(q => answers[q.id]?.length > 0);
  
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white p-10 rounded-3xl shadow-sm border-t-8 border-blue-600">
        <h2 className="text-3xl font-bold mb-2">{quizData.title}</h2>
        <p className="text-gray-400">請填寫您的看法</p>
      </div>
      {quizData.questions.map((q, idx) => (
        <div key={q.id} className="bg-white p-8 rounded-3xl shadow-sm border space-y-6">
          <p className="font-bold text-lg">{idx+1}. {q.text}</p>
          
          {q.hasImages && (
            <div className="grid grid-cols-2 gap-4">
              {q.images.map((img, iIdx) => img && (
                <div key={iIdx} onClick={() => handleOptionChange(q.id, q.type, `圖片 #${iIdx+1}`)} className={`cursor-pointer rounded-2xl overflow-hidden border-4 transition-all ${answers[q.id]?.includes(`圖片 #${iIdx+1}`) ? 'border-blue-500 ring-2' : 'border-transparent'}`}>
                  <img src={img} className="w-full h-40 object-cover" />
                  <div className="bg-gray-100 p-2 text-center text-xs font-bold">圖片 #{iIdx+1}</div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-3">
            {q.options.map(opt => {
              const selected = answers[q.id]?.includes(opt);
              return (
                <label key={opt} className={`flex items-center gap-3 p-4 border-2 rounded-2xl cursor-pointer transition-all ${selected ? 'border-blue-500 bg-blue-50' : 'border-gray-50 hover:border-gray-200'}`}>
                  <input type={q.type === 'single' ? 'radio' : 'checkbox'} name={q.id} onChange={() => handleOptionChange(q.id, q.type, opt)} />
                  <span className="font-medium">{opt}</span>
                </label>
              );
            })}
          </div>
        </div>
      ))}
      <div className="flex gap-4">
        <button onClick={onCancel} className="flex-1 py-4 bg-gray-200 font-bold rounded-2xl">取消</button>
        <button onClick={() => onSubmit(answers)} disabled={!canSubmit} className={`flex-1 py-4 rounded-2xl font-bold text-white shadow-lg ${canSubmit ? 'bg-blue-600' : 'bg-gray-300'}`}>提交問卷</button>
      </div>
    </div>
  );
}

// --- 其餘組件 (HomeView, AdminAuthWrapper, StatsDashboard) 與上一版一致 ---
function HomeView({ quizTitle, responseCount, onNavigate, isAdmin }) {
  return (
    <div className="space-y-12">
      <div className="text-center">
        <h2 className="text-4xl font-extrabold text-gray-900 mb-3">{quizTitle}</h2>
        {isAdmin && <p className="text-blue-600 font-bold">回覆總數：{responseCount}</p>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div onClick={() => onNavigate('admin')} className="bg-white p-8 rounded-2xl shadow border cursor-pointer hover:-translate-y-1 transition-all">
          <Edit3 className="text-indigo-600 mb-4" size={32} /><h3 className="font-bold">後台管理</h3>
        </div>
        <div onClick={() => onNavigate('survey')} className="bg-white p-8 rounded-2xl shadow border cursor-pointer hover:-translate-y-1 transition-all">
          <CheckSquare className="text-green-600 mb-4" size={32} /><h3 className="font-bold">填寫問卷</h3>
        </div>
        <div onClick={() => onNavigate('stats')} className="bg-white p-8 rounded-2xl shadow border cursor-pointer hover:-translate-y-1 transition-all">
          <BarChart3 className="text-orange-600 mb-4" size={32} /><h3 className="font-bold">統計報表</h3>
        </div>
      </div>
    </div>
  );
}

function AdminAuthWrapper({ children, onCancel, user }) {
  const handleLogin = () => signInWithPopup(auth, new GoogleAuthProvider());
  if (!user || !ADMIN_EMAILS.includes(user.email)) {
    return (
      <div className="max-w-md mx-auto bg-white p-10 rounded-3xl shadow-2xl text-center mt-10">
        <Lock className="mx-auto mb-4 text-blue-600" size={48} />
        <h2 className="text-2xl font-bold mb-8">管理員授權</h2>
        <button onClick={handleLogin} className="w-full py-4 border-2 rounded-xl font-bold flex items-center justify-center gap-3"><img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6" /> Google 登入</button>
        <button onClick={onCancel} className="mt-6 text-gray-400">返回</button>
      </div>
    );
  }
  return children;
}

function StatsDashboard({ quizData, responses }) {
  const stats = useMemo(() => {
    return quizData.questions.map(q => {
      const counts = {};
      q.options.forEach(opt => counts[opt] = 0);
      if (q.hasImages) q.images.forEach((_, i) => counts[`圖片 #${i+1}`] = 0);
      responses.forEach(r => { 
        const ans = r.answers[q.id];
        if (Array.isArray(ans)) ans.forEach(v => counts[v] = (counts[v] || 0) + 1);
        else if (ans) counts[ans] = (counts[ans] || 0) + 1;
      });
      return { title: q.text, data: Object.keys(counts).map(k => ({ name: k, value: counts[k] })) };
    });
  }, [quizData, responses]);

  if (responses.length === 0) return <div className="p-20 text-center bg-white rounded-3xl shadow">暫無數據 (請管理員登入)</div>;

  return (
    <div className="space-y-10">
      <div className="flex justify-between items-center"><h2 className="text-2xl font-bold">分析報表</h2><button onClick={() => exportToCSV(quizData, responses)} className="bg-green-600 text-white px-6 py-2 rounded-xl flex items-center gap-2"><Download size={20}/> 匯出 CSV</button></div>
      {stats.map((s, i) => (
        <div key={i} className="bg-white p-8 rounded-3xl shadow h-96 border">
          <h4 className="font-bold mb-8 border-l-4 border-blue-500 pl-4">{s.title}</h4>
          <ResponsiveContainer width="100%" height="80%">
            <BarChart data={s.data} layout="vertical"><XAxis type="number" hide/><YAxis dataKey="name" type="category" width={100}/><Tooltip/><Bar dataKey="value" fill="#3B82F6" radius={[0, 8, 8, 0]}/></BarChart>
          </ResponsiveContainer>
        </div>
      ))}
    </div>
  );
}