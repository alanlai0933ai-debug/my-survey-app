import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore, collection, doc, onSnapshot, setDoc, addDoc, serverTimestamp, query } from 'firebase/firestore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Edit3, BarChart3, CheckSquare, Plus, Trash2, Save, Image as ImageIcon, Share2, ArrowLeft, CheckCircle, Users, Download, Lock, Upload, AlertCircle } from 'lucide-react';

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
const ADMIN_PASSWORD = '12686505';

// --- 2. 輔助函數 ---
const exportToCSV = (quizData, responses) => {
  const headers = ['提交時間', '使用者ID', ...quizData.questions.map(q => q.text)];
  const rows = responses.map(r => {
    const date = r.submittedAt ? new Date(r.submittedAt.seconds * 1000).toLocaleString() : 'N/A';
    const ans = quizData.questions.map(q => `"${String(r.answers[q.id] || '').replace(/"/g, '""')}"`);
    return [date, r.userId, ...ans].join(',');
  });
  const csvContent = '\uFEFF' + headers.join(',') + '\n' + rows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `問卷結果.csv`;
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
    signInAnonymously(auth).catch(err => console.error("Auth error:", err));
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (loading) setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    const quizRef = doc(db, 'artifacts', appId, 'public', 'data', 'quizzes', QUIZ_ID);
    return onSnapshot(quizRef, (snap) => {
      if (snap.exists()) setQuizData(snap.data());
      setLoading(false);
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const ref = collection(db, 'artifacts', appId, 'public', 'data', `responses_${QUIZ_ID}`);
    return onSnapshot(query(ref), (snap) => {
      const data = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() }));
      setResponses(data);
    });
  }, [user]);

  const handleSaveQuiz = async (data) => {
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'quizzes', QUIZ_ID), data);
    alert("已儲存！");
    setView('home');
  };

  const handleSubmitResponse = async (ans) => {
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', `responses_${QUIZ_ID}`), {
      answers: ans, submittedAt: serverTimestamp(), userId: user.uid
    });
    alert("提交成功！");
    setView('home');
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">載入中...</div>;

  return (
    <div className="w-full min-h-screen bg-gray-100 text-gray-800 font-sans">
      <header className="w-full bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('home')}>
            <div className="bg-blue-600 text-white p-2 rounded-lg"><CheckSquare size={20} /></div>
            <h1 className="text-xl font-bold">雲端問卷大師</h1>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {view === 'home' && <HomeView quizTitle={quizData.title} responseCount={responses.length} onNavigate={setView} />}
        {view === 'admin' && (
          <AdminAuthWrapper currentUser={user} onCancel={() => setView('home')}>
            <AdminPanel initialData={quizData} onSave={handleSaveQuiz} />
          </AdminAuthWrapper>
        )}
        {view === 'survey' && <SurveyTaker quizData={quizData} onSubmit={handleSubmitResponse} onCancel={() => setView('home')} />}
        {view === 'stats' && <StatsDashboard quizData={quizData} responses={responses} onBack={() => setView('home')} />}
      </main>
    </div>
  );
}

// --- 子元件區塊 ---

function AdminAuthWrapper({ children, onCancel, currentUser }) {
  const [isPasswordVerified, setIsPasswordVerified] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      alert("Google 登入失敗：" + err.message);
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) { setIsPasswordVerified(true); setError(false); }
    else { setError(true); }
  };

  const isGoogleUser = currentUser?.providerData?.some(p => p.providerId === 'google.com');
  if (isPasswordVerified || isGoogleUser) return children;

  return (
    <div className="max-w-md mx-auto bg-white p-8 rounded-xl shadow-lg border mt-10 text-center">
      <h2 className="text-2xl font-bold mb-6">管理員驗證</h2>
      <form onSubmit={handleLogin} className="space-y-4 mb-6">
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 border rounded-lg text-center" placeholder="請輸入密碼" />
        {error && <p className="text-red-500 text-sm">密碼錯誤</p>}
        <button type="submit" className="w-full py-3 bg-red-600 text-white rounded-lg font-bold">密碼進入</button>
      </form>
      <div className="relative my-6"><div className="absolute inset-0 flex items-center"><span className="w-full border-t"></span></div><div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-gray-400">或</span></div></div>
      <button onClick={handleGoogleLogin} className="w-full py-3 border-2 border-gray-300 rounded-lg flex items-center justify-center gap-2 hover:bg-gray-50 font-bold">
        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="G" className="w-5 h-5" /> 使用 Google 登入
      </button>
      <div className="mt-8 p-4 bg-gray-50 rounded-lg text-xs break-all text-left">
        <p className="font-bold text-gray-400">UID: <span className="text-blue-600 select-all">{currentUser?.uid || '載入中'}</span></p>
        <p>來源: {isGoogleUser ? 'Google 安全' : '匿名'}</p>
      </div>
      <button onClick={onCancel} className="mt-4 text-gray-400 text-sm hover:underline">返回首頁</button>
    </div>
  );
}

function HomeView({ quizTitle, responseCount, onNavigate }) {
  return (
    <div className="space-y-8">
      <div className="text-center py-10">
        <h2 className="text-3xl font-bold mb-2">{quizTitle}</h2>
        <p className="text-gray-500">總回覆數：<span className="font-bold text-blue-600">{responseCount}</span> 份</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div onClick={() => onNavigate('admin')} className="bg-white p-6 rounded-xl shadow-sm cursor-pointer border hover:shadow-md transition-all">
          <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center mb-4"><Edit3 /></div>
          <h3 className="text-lg font-bold">後台管理</h3>
        </div>
        <div onClick={() => onNavigate('survey')} className="bg-white p-6 rounded-xl shadow-sm cursor-pointer border hover:shadow-md transition-all">
          <div className="w-12 h-12 bg-green-100 text-green-600 rounded-lg flex items-center justify-center mb-4"><CheckSquare /></div>
          <h3 className="text-lg font-bold">填寫問卷</h3>
        </div>
        <div onClick={() => onNavigate('stats')} className="bg-white p-6 rounded-xl shadow-sm cursor-pointer border hover:shadow-md transition-all">
          <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-lg flex items-center justify-center mb-4"><BarChart3 /></div>
          <h3 className="text-lg font-bold">統計圖表</h3>
        </div>
      </div>
    </div>
  );
}

function AdminPanel({ initialData, onSave }) {
  const [title, setTitle] = useState(initialData.title || "");
  const [questions, setQuestions] = useState(initialData.questions || []);
  const addQuestion = () => setQuestions([...questions, { id: Date.now().toString(), text: "新問題", type: "single", options: ["選項 1"] }]);
  const updateQuestion = (i, f, v) => { const n = [...questions]; n[i][f] = v; setQuestions(n); };
  const removeQuestion = (i) => { const n = [...questions]; n.splice(i, 1); setQuestions(n); };

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      <div className="bg-indigo-600 p-6 flex justify-between items-center text-white">
        <h2 className="text-xl font-bold text-white">編輯問卷</h2>
        <button onClick={() => onSave({ title, questions })} className="bg-white text-indigo-600 px-4 py-2 rounded-lg font-bold">儲存發布</button>
      </div>
      <div className="p-6 space-y-6 text-gray-800">
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full text-2xl font-bold border-b p-2 focus:outline-none focus:border-indigo-500" placeholder="問卷標題" />
        <div className="space-y-4">
          {questions.map((q, i) => (
            <div key={q.id} className="p-4 border rounded bg-gray-50 relative">
              <button onClick={() => removeQuestion(i)} className="absolute top-2 right-2 text-red-500 hover:text-red-700"><Trash2 size={16}/></button>
              <input value={q.text} onChange={(e) => updateQuestion(i, 'text', e.target.value)} className="w-full mb-2 p-2 border rounded" placeholder="問題描述" />
              <select value={q.type} onChange={(e) => updateQuestion(i, 'type', e.target.value)} className="p-2 border rounded text-sm bg-white">
                <option value="single">單選</option>
                <option value="multi">複選</option>
              </select>
            </div>
          ))}
          <button onClick={addQuestion} className="w-full py-4 border-2 border-dashed rounded text-gray-400 hover:bg-gray-50 transition-colors">+ 新增題目</button>
        </div>
      </div>
    </div>
  );
}

function SurveyTaker({ quizData, onSubmit, onCancel }) {
  const [answers, setAnswers] = useState({});
  const handleOptionChange = (qId, type, val) => {
    if (type === 'single') setAnswers({ ...answers, [qId]: val });
    else {
      const curr = answers[qId] || [];
      const next = curr.includes(val) ? curr.filter(v => v !== val) : [...curr, val];
      setAnswers({ ...answers, [qId]: next });
    }
  };
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-white p-8 rounded-xl shadow-sm border-t-8 border-blue-600">
        <h1 className="text-3xl font-bold mb-2">{quizData.title}</h1>
        <p className="text-gray-600">請填寫以下資訊</p>
      </div>
      {quizData.questions.map((q, i) => (
        <div key={q.id} className="bg-white p-6 rounded-xl border shadow-sm">
          <h3 className="font-bold mb-4">{i + 1}. {q.text}</h3>
          <div className="space-y-2">
            {q.options.map(opt => (
              <label key={opt} className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-blue-50">
                <input type={q.type === 'single' ? 'radio' : 'checkbox'} name={q.id} onChange={() => handleOptionChange(q.id, q.type, opt)} className="mr-3" />
                {opt}
              </label>
            ))}
          </div>
        </div>
      ))}
      <div className="flex gap-4">
        <button onClick={onCancel} className="flex-1 py-3 bg-gray-200 rounded-lg">取消</button>
        <button onClick={() => onSubmit(answers)} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-lg shadow-lg">提交問卷</button>
      </div>
    </div>
  );
}

function StatsDashboard({ quizData, responses, onBack }) {
  const stats = useMemo(() => {
    return quizData.questions.map(q => {
      const counts = {};
      q.options.forEach(opt => counts[opt] = 0);
      responses.forEach(r => {
        const ans = r.answers[q.id];
        if (Array.isArray(ans)) ans.forEach(v => counts[v] = (counts[v] || 0) + 1);
        else if (ans) counts[ans] = (counts[ans] || 0) + 1;
      });
      return { title: q.text, data: Object.keys(counts).map(k => ({ name: k, count: counts[k] })) };
    });
  }, [quizData, responses]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">結果分析 ({responses.length} 份)</h2>
        <button onClick={() => exportToCSV(quizData, responses)} className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-bold shadow-md"><Download size={18}/> 匯出 CSV</button>
      </div>
      {stats.map((s, i) => (
        <div key={i} className="bg-white p-6 rounded-xl border shadow-sm">
          <h3 className="font-bold mb-6 text-lg border-l-4 border-blue-500 pl-3">{s.title}</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={s.data} layout="vertical">
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={80} tick={{fontSize: 12}} />
                <Tooltip />
                <Bar dataKey="count" fill="#3B82F6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ))}
    </div>
  );
}