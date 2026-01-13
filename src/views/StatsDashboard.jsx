import { 
  BarChart3, Search, Download, User, AlertCircle, 
  Crown, Medal, Trophy, // 這是給 Podium 用的
  ChevronDown, ChevronUp, CheckCircle // 這是給深層解析用的
} from 'lucide-react';
import React, { useState, useMemo } from 'react';
import { isPointInPolygon, exportToCSV } from '../utils/mathHelpers';
import ResultView from './ResultView'; 
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, PieChart, Pie, Cell, Legend 
} from 'recharts';

// ✅ 1. 引入我們剛做好的骨架組件 (視覺優化)
import Skeleton, { SkeletonCard } from '../components/Skeleton';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export default function StatsDashboard({ quizData, responses }) {
  const [selectedUser, setSelectedUser] = useState("all");
  const [expandedId, setExpandedId] = useState(null);

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
// --- 🏆 新增：計算前三名 ---
  const topPlayers = useMemo(() => {
    // 1. 過濾掉沒有暱稱的，並依分數高低排序
    const sorted = [...responses]
      .filter(r => r.nickname && r.nickname !== 'Guest')
      .map(r => {
         // 計算總分 (這裡沿用您原本的邏輯，或是讀取 stats)
         const score = r.stats ? Math.round(r.stats.reduce((acc, s) => acc + s.A, 0) / r.stats.length) : 0;
         return { ...r, score };
      })
      .sort((a, b) => b.score - a.score || a.totalTime - b.totalTime) // 分數同則比時間短
      .slice(0, 3); // 取前三

    // 補滿三個位置以免報錯 (如果只有1人玩)
    while(sorted.length < 3) sorted.push(null);
    
    // 調整順序為：[第二名, 第一名, 第三名] (為了視覺上的頒獎台順序)
    return [sorted[1], sorted[0], sorted[2]];
  }, [responses]);

  // --- 🎨 頒獎台子組件 ---
  const RenderPodium = () => (
    <div className="flex justify-center items-end gap-2 md:gap-4 mb-12 mt-4">
      {topPlayers.map((player, idx) => {
        if (!player) return <div key={idx} className="w-24 md:w-32" />; // 佔位符
        
        // 設定名次樣式 (注意我們的陣列順序是 2, 1, 3)
        let rank = 0;
        let height = "h-32";
        let color = "bg-slate-100";
        let icon = null;
        let scale = "scale-100";

        if (idx === 1) { // 第一名 (中間)
            rank = 1; height = "h-48 md:h-56"; color = "bg-yellow-100 border-yellow-300"; 
            icon = <Crown size={32} className="text-yellow-500 fill-yellow-500 animate-bounce"/>;
            scale = "scale-110 z-10";
        } else if (idx === 0) { // 第二名 (左邊)
            rank = 2; height = "h-36 md:h-40"; color = "bg-slate-100 border-slate-300";
            icon = <Medal size={24} className="text-slate-400"/>;
        } else { // 第三名 (右邊)
            rank = 3; height = "h-28 md:h-32"; color = "bg-orange-50 border-orange-200";
            icon = <Medal size={24} className="text-orange-400"/>;
        }

        return (
          <div key={player.id} className={`flex flex-col items-center transition-all duration-500 ${scale}`}>
            {/* 大頭貼與暱稱 */}
            <div className="flex flex-col items-center mb-2">
                {icon}
                <div className="font-bold text-slate-700 mt-1 truncate max-w-[80px] md:max-w-[120px] text-center">{player.nickname}</div>
                <div className="text-xs font-bold text-indigo-600">{player.score} 分</div>
            </div>
            
            {/* 柱子 */}
            <div className={`w-24 md:w-32 ${height} ${color} border-t-4 rounded-t-xl shadow-lg flex items-end justify-center pb-4 relative overflow-hidden group`}>
                <div className="absolute inset-0 bg-gradient-to-b from-white/50 to-transparent" />
                <span className={`text-4xl md:text-6xl font-black opacity-20 ${rank===1?'text-yellow-600':(rank===2?'text-slate-500':'text-orange-600')}`}>
                    {rank}
                </span>
            </div>
          </div>
        );
      })}
    </div>
  );
  // --- 🔍 深層解析子組件 ---
  const RenderQuestionAnalysis = ({ question }) => {
    // 只針對選擇題做詳細分析 (熱點/排序題較難用長條圖呈現)
    if (!question || question.type !== 'choice') return <div className="p-4 text-sm text-slate-400">此題型暫不支援選項分佈分析。</div>;

    // 1. 計算每個選項被選的次數
    const counts = {};
    let totalAnswered = 0;
    
    responses.forEach(r => {
      const ans = r.answers[question.id];
      if (ans) {
        totalAnswered++;
        if (Array.isArray(ans)) {
            ans.forEach(a => counts[a] = (counts[a] || 0) + 1);
        } else {
            counts[ans] = (counts[ans] || 0) + 1;
        }
      }
    });

    return (
      <div className="mt-3 pl-4 border-l-2 border-slate-200 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
        <p className="text-xs font-bold text-slate-500 mb-2">選項分佈統計 (共 {totalAnswered} 人作答)</p>
        
        {question.options.map((opt, idx) => {
           const label = typeof opt === 'string' ? opt : opt.label;
           const isCorrect = typeof opt === 'string' ? false : opt.isCorrect;
           const count = counts[label] || 0;
           const percentage = totalAnswered > 0 ? Math.round((count / totalAnswered) * 100) : 0;
           
           // 判斷顏色：正確給綠色，錯誤且有人選給紅色，沒人選給灰色
           let barColor = "bg-slate-100";
           let textColor = "text-slate-500";
           
           if (isCorrect) {
               barColor = "bg-green-100";
               textColor = "text-green-700 font-bold";
           } else if (count > 0) {
               barColor = "bg-red-50"; // 誘答選項
               textColor = "text-red-600";
           }

           return (
             <div key={idx} className="relative">
               {/* 標籤與數據 */}
               <div className="flex justify-between text-xs mb-1 relative z-10">
                 <span className={`flex items-center gap-2 ${textColor}`}>
                    {/* 這裡用到 CheckCircle，記得確認上面有 import */}
                    {isCorrect && <CheckCircle size={12} />} 
                    {label}
                 </span>
                 <span className="font-bold text-slate-400">{percentage}% ({count}人)</span>
               </div>
               
               {/* 進度條背景 */}
               <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                 <div 
                    className={`h-full rounded-full transition-all duration-1000 ${isCorrect ? 'bg-green-500' : 'bg-red-400'}`} 
                    style={{ width: `${percentage}%`, opacity: count > 0 ? 1 : 0 }} 
                 />
               </div>
             </div>
           );
        })}
      </div>
    );
  };
  // --- 🎨 自定義懸浮提示 (讓圖表更美) ---
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/90 backdrop-blur-md p-4 rounded-xl shadow-xl border border-indigo-100">
          <p className="font-bold text-slate-700 mb-2 border-b border-slate-100 pb-2">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm font-medium flex items-center gap-2" style={{ color: entry.color }}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}/>
              {entry.name}: <span className="font-bold text-lg">{entry.value}</span> 人
            </p>
          ))}
        </div>
      );
    }
    return null;
  };
  // ✅ 2. 插入 Loading 狀態檢查
  // 如果題目還沒載入完成，顯示骨架屏
  if (!quizData || !quizData.questions || quizData.questions.length === 0) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
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
         <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
         </div>
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
<div className="grid grid-cols-1 md:grid-cols-2 gap-8 print:block print:space-y-8 mt-8">
            {stats.map((s, i) => (
              <div key={i} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow break-inside-avoid flex flex-col">
                
                {/* 標題區：加上左側裝飾線 */}
                <div className="mb-6 flex items-center gap-3">
                    <div className="w-1.5 h-6 bg-indigo-500 rounded-full"/>
                    <h4 className="font-bold text-lg text-slate-700 leading-tight">{s.title}</h4>
                </div>

                <div className="h-64 w-full relative flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    
                    {/* 🔥 1. 優化後的甜甜圈圖 (Hotspot 題型) */}
                    {s.type === 'hotspot' ? (
                      <PieChart>
                        <Pie 
                            data={s.data} 
                            cx="50%" 
                            cy="50%" 
                            innerRadius={60} // 挖空變成甜甜圈
                            outerRadius={85} // 外圈大小
                            paddingAngle={5} // 切片間的縫隙
                            dataKey="value"
                            cornerRadius={6} // 圓角切片
                        >
                          <Cell fill="#10B981" stroke="none" /> {/* 通過：綠色 */}
                          <Cell fill="#EF4444" stroke="none" /> {/* 未通過：紅色 */}
                        </Pie>
                        {/* 中間顯示文字 */}
                        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="fill-slate-700 font-black text-2xl">
                            {Math.round((s.data[0].value / (s.data[0].value + s.data[1].value || 1)) * 100)}%
                        </text>
                        <text x="50%" y="62%" textAnchor="middle" dominantBaseline="middle" className="fill-slate-400 text-xs font-bold">
                            通過率
                        </text>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend verticalAlign="bottom" height={36} iconType="circle"/>
                      </PieChart>

                    ) : s.type === 'sorting' ? (
                      // 🔥 2. 優化後的堆疊長條圖 (分類題型)
                      <BarChart data={s.data} layout="vertical" margin={{ left: 0, right: 30 }} barSize={24}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9"/>
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" width={80} tick={{fontSize: 11, fontWeight: 'bold', fill: '#64748b'}} />
                        <Tooltip content={<CustomTooltip />} cursor={{fill: 'transparent'}} />
                        <Legend iconType="circle"/>
                        {/* 圓角與顏色優化 */}
                        <Bar dataKey="correct" name="正確歸類" stackId="a" fill="#10B981" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="wrong" name="歸類錯誤" stackId="a" fill="#EF4444" radius={[0, 10, 10, 0]} />
                      </BarChart>

                    ) : (
                      // 🔥 3. 優化後的單一長條圖 (選擇題)
                      <BarChart data={s.data} layout="vertical" margin={{ left: 0, right: 30 }} barSize={32}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9"/>
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 11, fontWeight: 'bold', fill: '#64748b'}} />
                        <Tooltip content={<CustomTooltip />} cursor={{fill: '#f8fafc'}} />
                        
                        {/* 膠囊狀長條圖 */}
                        <Bar dataKey="value" radius={[0, 12, 12, 0]}>
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
    );
  }

  // 如果資料載入完成，但沒有任何回應紀錄
  if (responses.length === 0) return <div className="p-20 text-center bg-white rounded-3xl shadow text-slate-400">尚無數據，請先進行挑戰</div>;

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 print:hidden">
        <h2 className="text-2xl font-bold flex items-center gap-2"><BarChart3 className="text-orange-500"/> 戰情分析室</h2>
        {responses.length > 0 && <RenderPodium />}
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
                  <div 
                    key={q.id} 
                    // 🔥 1. 這裡加入了點擊事件，點一下就會把 ID 存起來
                    onClick={() => setExpandedId(expandedId === q.id ? null : q.id)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer group ${expandedId === q.id ? 'bg-indigo-50/50 border-indigo-200 shadow-md' : 'bg-slate-50 border-transparent hover:bg-slate-100'}`}
                  >
                     <div className="flex items-center gap-4">
                        {/* 排名數字球 */}
                        <div className={`w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full font-bold text-lg transition-transform ${expandedId === q.id ? 'scale-110' : ''} ${idx === 0 ? 'bg-red-500 text-white shadow-red-200 shadow-lg' : 'bg-white text-slate-500 border'}`}>
                          {idx + 1}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-1">
                              <span className="font-bold text-slate-700 truncate mr-4">{q.text}</span>
                              <div className="flex items-center gap-3">
                                <span className="font-bold text-red-500 whitespace-nowrap">{q.errorRate}% 錯誤率</span>
                                {/* 🔥 2. 加入會動的箭頭圖示 */}
                                {expandedId === q.id ? <ChevronUp size={18} className="text-indigo-500"/> : <ChevronDown size={18} className="text-slate-300 group-hover:text-slate-500"/>}
                              </div>
                          </div>
                          
                          {/* 錯誤率長條圖 */}
                          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div className="h-full bg-red-500 rounded-full transition-all duration-1000" style={{ width: `${q.errorRate}%` }} />
                          </div>
                        </div>
                     </div>

                     {/* 🔥 3. 這裡就是關鍵！如果被點擊展開，就顯示剛剛寫好的深層解析組件 */}
                     {expandedId === q.id && (
                        <div className="mt-4 pt-4 border-t border-indigo-100 cursor-default" onClick={(e) => e.stopPropagation()}>
                           {/* 呼叫我們剛剛定義好的工具 */}
                           <RenderQuestionAnalysis question={quizData.questions.find(item => item.id === q.id)} />
                        </div>
                     )}
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