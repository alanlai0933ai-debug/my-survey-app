import React from 'react';
import { Clock, RefreshCw } from 'lucide-react';
// ✅ 這裡已經正確引入了 isPointInPolygon，下面直接用就好，不需要 require
import { isPointInPolygon, formatTime } from '../utils/mathHelpers';
import ZoomableImage from '../components/ZoomableImage';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';

export default function ResultView({ quizData, userAnswers, stats, totalTime, onBack }) {
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
         // --- 複選題邏輯 (詳細版) ---
         const correctOptions = q.options.filter(o => o.isCorrect).map(o => o.label);
         const userSelected = Array.isArray(userAns) ? userAns : [];
         
         // 判斷是否全對
         isCorrect = correctOptions.length === userSelected.length && correctOptions.every(v => userSelected.includes(v));
         
         const userStr = userSelected.length > 0 ? userSelected.join('、') : '未作答';
         
         detail = (
           <div className="flex flex-col gap-1 mt-1">
             <div>您的選擇: {userStr}</div>
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
         // --- 單選題邏輯 ---
         const correctOption = q.options.find(o => o.isCorrect)?.label;
         isCorrect = userAns === correctOption;
         
         const userVal = (userAns === undefined || userAns === null) ? '未作答' : userAns;
         const correctVal = correctOption || '未設定';
         detail = `您的答案: ${userVal} (正確答案: ${correctVal})`;
      }
      
      if (isCorrect) gainedPoints = points;

    } else if (q.type === 'hotspot') {
      // --- 熱點題邏輯 (已修正) ---
      const totalTargets = q.targets?.length || 0;
      
      // 🔥 修正點：直接使用上方 import 的 isPointInPolygon
      const targetHits = (q.targets || []).map(t => {
         const hit = (userAns || []).some(pin => isPointInPolygon(pin, t.points));
         return hit;
      });
      
      const hitCount = targetHits.filter(h => h).length;
      isCorrect = hitCount === totalTargets && totalTargets > 0;
      gainedPoints = totalTargets > 0 ? Math.round((hitCount / totalTargets) * points) : 0;
      detail = `命中 ${hitCount} / ${totalTargets} 個目標`;

    } else if (q.type === 'sorting') {
      // --- 分類題邏輯 ---
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

            {r.type === 'sorting' && r.sortingErrors && r.sortingErrors.length > 0 && (
              <div className="bg-red-50 p-3 rounded-lg text-xs text-red-600 mt-2 space-y-1 border border-red-100">
                <div className="font-bold mb-1">錯誤項目：</div>
                {r.sortingErrors.map((err, i) => <div key={i}>• {err}</div>)}
              </div>
            )}
            
            {/* 詳細解析區塊 */}
            {r.type === 'choice' && (
               <div className={`text-sm font-bold mt-1 ${r.isCorrect ? 'text-indigo-600' : 'text-red-500'}`}>
                 {r.detail}
               </div>
            )}
            
            {r.type !== 'choice' && <p className="text-sm text-slate-500 mt-1">{r.detail}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}