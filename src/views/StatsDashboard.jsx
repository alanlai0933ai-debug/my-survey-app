import React, { useState, useMemo } from 'react';
import { isPointInPolygon, exportToCSV } from '../utils/mathHelpers';
import ResultView from './ResultView'; 
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, PieChart, Pie, Cell, Legend 
} from 'recharts';
import { BarChart3, Search, Download, User, AlertCircle } from 'lucide-react';

// ✅ 1. 引入我們剛做好的骨架組件 (視覺優化)
import Skeleton, { SkeletonCard } from '../components/Skeleton';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export default function StatsDashboard({ quizData, responses }) {
  const [selectedUser, setSelectedUser] = useState("all");

  // 統計邏輯計算 (維持不變)
  const stats = useMemo(() => {
    // 防呆：如果還沒載入題目，就回傳空陣列
    if (!quizData || !quizData.questions) return [];

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

  const topWrongQuestions = useMemo(() => {
    if (!quizData || !quizData.questions || responses.length === 0) return [];
    
    const calculated = quizData.questions
    .filter(q => Number(q.points) > 0)
    .map(q => {
      let totalAccuracy = 0;
      responses.forEach(r => {
        const ans = r.answers[q.id];
        let accuracy = 0;
        if (q.type === 'choice') {
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
          const totalTargets = q.targets?.length || 1;
          const hits = (q.targets || []).filter(t => (ans || []).some(pin => isPointInPolygon(pin, t.points))).length;
          accuracy = hits / totalTargets;
        } else if (q.type === 'sorting') {
          const totalItems = q.items.length || 1;
          let correct = 0;
          q.items.forEach(i => { if (ans && ans[i.id] === i.correctCategory) correct++; });
          accuracy = correct / totalItems;
        }
        totalAccuracy += accuracy;
      });
      const avgAccuracy = totalAccuracy / responses.length;
      return {
        id: q.id,
        text: q.text,
        type: q.type,
        errorRate: Math.round((1 - avgAccuracy) * 100)
      };
    });
    return calculated.sort((a, b) => b.errorRate - a.errorRate).slice(0, 10);
  }, [quizData, responses]);

  const selectedUserData = responses.find(r => r.id === selectedUser);

  // ✅ 2. 插入 Loading 狀態檢查
  // 如果題目還沒載入完成，顯示骨架屏
  if (!quizData || !quizData.questions || quizData.questions.length === 0) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
         {/* 模擬頂部 Header */}
         <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
             <div className="flex items-center gap-2">
                 <Skeleton className="h-8 w-8 rounded-full" />
                 <Skeleton className="h-8 w-48" />
             </div>
             <div className="flex gap-3 w-full md:w-auto">
                 <Skeleton className="h-10 w-full md:w-40 rounded-xl" />
                 <Skeleton className="h-10 w-32 rounded-xl" />
             </div>
         </div>
         
         {/* 模擬下方卡片 Grid */}
         <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
         </div>
      </div>
    );
  }

  // 如果資料載入完成，但沒有任何回應紀錄
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
      ) : (
        <div className="space-y-8">
          {topWrongQuestions.length > 0 && (
            <div className="bg-white p-6 rounded-3xl shadow-lg border border-red-100">
              <h3 className="text-xl font-bold text-red-600 mb-4 flex items-center gap-2">
                <AlertCircle className="fill-red-100"/> 易錯題排行榜 (Top 10)
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
                        <div className="h-full bg-red-500 rounded-full transition-all duration-1000" style={{ width: `${q.errorRate}%` }} />
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
    </div>
  );
}