import React, { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { Clock, Share2, Award, Calendar, Target, CheckCircle, Zap, AlertTriangle, ArrowRight, User, Mail, Loader2 } from 'lucide-react';
import { isPointInPolygon, formatTime } from '../utils/mathHelpers';
import ZoomableImage from '../components/ZoomableImage';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import toast from 'react-hot-toast';
import html2canvas from 'html2canvas';

// 🔥 1. 引入 Firebase Functions
import { getFunctions, httpsCallable } from 'firebase/functions';

export default function ResultView({ quizData, userAnswers, stats, totalTime, onBack, nickname, inputEmail }) {
  const cardRef = useRef(null);
  
  // 🔥 2. 新增 AI 相關狀態
  const [aiFeedback, setAiFeedback] = useState({}); // 儲存每一題的 AI 回饋 { [qId]: "..." }
  const [loadingAi, setLoadingAi] = useState({});   // 儲存每一題的載入狀態 { [qId]: true/false }

  const renderPolygon = (points) => {
    if (!points) return "";
    return points.map(p => `${p.x},${p.y}`).join(' ');
  };

  let totalScore = 0;
  let maxScore = 0;

  // --- 計算分數邏輯 ---
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
         const correctOptions = q.options.filter(o => o.isCorrect).map(o => o.label);
         const userSelected = Array.isArray(userAns) ? userAns : [];
         isCorrect = correctOptions.length === userSelected.length && correctOptions.every(v => userSelected.includes(v));
         const userStr = userSelected.length > 0 ? userSelected.join('、') : '未作答';
         detail = (
           <div className="flex flex-col gap-1 mt-1">
             <div>您的選擇: {userStr}</div>
             {!isCorrect && <div className="mt-1 pt-1 border-t border-current opacity-90 text-xs">正確: {correctOptions.join('、')}</div>}
           </div>
         );
      } else {
         const correctOption = q.options.find(o => o.isCorrect)?.label;
         isCorrect = userAns === correctOption;
         detail = `您的答案: ${userAns || '未作答'} ${!isCorrect ? `(正確: ${correctOption})` : ''}`;
      }
      if (isCorrect) gainedPoints = points;

    } else if (q.type === 'hotspot') {
      const totalTargets = q.targets?.length || 0;
      const targetHits = (q.targets || []).map(t => (userAns || []).some(pin => isPointInPolygon(pin, t.points)));
      const hitCount = targetHits.filter(h => h).length;
      isCorrect = hitCount === totalTargets && totalTargets > 0;
      gainedPoints = totalTargets > 0 ? Math.round((hitCount / totalTargets) * points) : 0;
      detail = `命中 ${hitCount} / ${totalTargets}`;

    } else if (q.type === 'sorting') {
      const userMap = userAns || {};
      let correctCount = 0;
      q.items.forEach(item => {
         const userCat = userMap[item.id];
         if (userCat) {
           if (item.correctCategory && userCat !== item.correctCategory) {
             sortingErrors.push({
                text: item.text,
                userCat: userCat,
                correctCat: item.correctCategory,
                type: 'wrong'
             });
           } else if (item.correctCategory && userCat === item.correctCategory) {
             correctCount++;
           }
         } else {
           sortingErrors.push({
              text: item.text,
              correctCat: item.correctCategory,
              type: 'missed'
           });
         }
      });
      const totalItems = q.items.length || 1;
      isCorrect = correctCount === totalItems;
      gainedPoints = Math.round((correctCount / totalItems) * points);
      detail = `正確 ${correctCount}/${totalItems}`;
    }

    totalScore += gainedPoints;
    return { ...q, isCorrect, detail, userAns, gainedPoints, sortingErrors };
  });

  // --- 🔥 3. AI 呼叫函式 ---
  const handleGetAiFeedback = async (q, userAns) => {
    if (loadingAi[q.id] || aiFeedback[q.id]) return; // 防止重複點擊

    setLoadingAi(prev => ({ ...prev, [q.id]: true }));

    try {
      // 1. 準備正確答案字串
      let correctText = "";
      if (q.type === 'choice') {
         if (q.isMulti) {
            correctText = q.options.filter(o => o.isCorrect).map(o => o.label).join('、');
         } else {
            correctText = q.options.find(o => o.isCorrect)?.label;
         }
      } else if (q.type === 'hotspot') {
         correctText = `找出所有 ${q.targets?.length || 0} 個熱點區域`;
      } else if (q.type === 'sorting') {
         correctText = "將所有項目正確分類";
      }

      // 2. 準備使用者答案字串
      let userAnsText = "";
      if (q.type === 'choice') {
         userAnsText = Array.isArray(userAns) ? userAns.join('、') : (userAns || "未作答");
      } else if (q.type === 'sorting') {
         userAnsText = q.items.map(item => `${item.text}:${userAns[item.id]||'未分類'}`).join('; ');
      } else {
         userAnsText = "使用者標記了位置"; // 熱點題較難用文字描述座標
      }

      const functions = getFunctions();
      const generateFeedback = httpsCallable(functions, 'generateQuizFeedback');
      
      const result = await generateFeedback({
          questionText: q.text,
          userAnswer: userAnsText,
          correctOption: correctText,
          questionType: q.type
      });
      
      setAiFeedback(prev => ({ ...prev, [q.id]: result.data.feedback }));
    } catch (error) {
      console.error("AI Error:", error);
      toast.error("AI 老師目前忙碌中，請稍後再試");
    } finally {
      setLoadingAi(prev => ({ ...prev, [q.id]: false }));
    }
  };

  // --- 特效與下載 ---
  useEffect(() => {
    const passingScore = maxScore * 0.6;
    if (totalScore >= passingScore && maxScore > 0) {
      const duration = 3 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };
      const randomInRange = (min, max) => Math.random() * (max - min) + min;
      const interval = setInterval(function() {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) return clearInterval(interval);
        confetti({ ...defaults, particleCount: 50, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
        confetti({ ...defaults, particleCount: 50, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
      }, 250);
      return () => clearInterval(interval);
    }
  }, [totalScore, maxScore]);

  const handleDownload = async () => {
    if (!cardRef.current) return;
    const toastId = toast.loading('印製專屬證書中...');
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      const canvas = await html2canvas(cardRef.current, { 
        scale: 3, useCORS: true, backgroundColor: '#ffffff', logging: false 
      });
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `戰績卡_${nickname}_${new Date().getTime()}.png`;
      link.click();
      toast.success('下載成功！', { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error('生成失敗', { id: toastId });
    }
  };

  const today = new Date().toLocaleDateString('zh-TW');

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6 px-4 md:px-0 py-6">
      
      {/* 頂部按鈕 */}
      <div className="flex justify-between items-center print:hidden">
         <button onClick={onBack} className="text-slate-500 font-bold hover:text-slate-800 flex items-center gap-2 transition-colors">
           ← 返回首頁
         </button>
         <button onClick={handleDownload} className="bg-indigo-600 text-white px-5 py-2.5 rounded-full font-bold flex items-center gap-2 shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all hover:-translate-y-1">
           <Share2 size={18}/> 下載證書
         </button>
      </div>

      {/* 戰績卡 (截圖區) */}
      <div className="flex justify-center">
        <div ref={cardRef} className="bg-white relative overflow-hidden w-full max-w-md rounded-3xl shadow-2xl border-4 border-double border-indigo-100 p-8" style={{ backgroundImage: 'radial-gradient(circle at 10% 20%, rgba(99, 102, 241, 0.05) 0%, transparent 20%), radial-gradient(circle at 90% 80%, rgba(236, 72, 153, 0.05) 0%, transparent 20%)' }}>
          {/* 背景裝飾 */}
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-yellow-300 rounded-full mix-blend-multiply filter blur-2xl opacity-30 animate-blob"></div>
          <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-pink-300 rounded-full mix-blend-multiply filter blur-2xl opacity-30 animate-blob animation-delay-2000"></div>

          {/* 1. 標題區 */}
          <div className="text-center mb-6 relative z-10">
            <div className="inline-flex items-center justify-center gap-2 bg-slate-900 text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest mb-3 shadow-md">
               <Target size={12} className="text-yellow-400"/> 互動挑戰實驗室
            </div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">挑戰成績單</h2>
            <p className="text-slate-400 text-sm font-medium mt-1">CERTIFICATE OF ACHIEVEMENT</p>
          </div>

          {/* 2. 使用者資訊 */}
          <div className="flex flex-col items-center justify-center mb-6 relative z-10">
             <div className="w-16 h-16 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-full flex items-center justify-center shadow-lg mb-2 border-4 border-white">
                <User size={32} className="text-white" />
             </div>
             <h3 className="text-xl font-bold text-slate-800">{nickname || 'Challenger'}</h3>
             {inputEmail && <p className="text-xs text-slate-400 flex items-center gap-1"><Mail size={10}/> {inputEmail}</p>}
          </div>

          {/* 3. 分數區 */}
          <div className="flex flex-col items-center justify-center mb-6 relative z-10">
             <div className="flex items-baseline justify-center gap-2 text-indigo-600">
                <span className="text-7xl font-black tracking-tighter leading-none drop-shadow-sm">
                   {totalScore}
                </span>
                <span className="text-2xl font-bold text-slate-400">
                   / {maxScore}
                </span>
             </div>
             <div className="mt-4 flex gap-4 text-xs font-bold text-slate-500 bg-slate-100 px-4 py-2 rounded-xl">
                <span className="flex items-center gap-1"><Clock size={14}/> {formatTime(totalTime || 0)}</span>
                <span className="w-px h-4 bg-slate-300"></span>
                <span className="flex items-center gap-1"><Calendar size={14}/> {today}</span>
             </div>
          </div>

          {/* 4. 雷達圖 */}
          {stats && (
            <div className="w-full h-56 relative z-10 -ml-2">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={stats}>
                  <PolarGrid stroke="#e2e8f0" strokeWidth={1} />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#475569', fontSize: 12, fontWeight: '800' }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar name="My Stats" dataKey="A" stroke="#6366f1" strokeWidth={3} fill="#6366f1" fillOpacity={0.4} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* 5. 底部評語 */}
          <div className="mt-6 pt-6 border-t-2 border-dashed border-slate-100 text-center relative z-10">
             <div className="flex justify-center gap-3 mb-2">
                <div className="bg-green-50 text-green-700 px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1">
                   <CheckCircle size={12}/> 正確率 {maxScore > 0 ? Math.round((totalScore/maxScore)*100) : 0}%
                </div>
                <div className="bg-orange-50 text-orange-700 px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1">
                   <Zap size={12}/> 反應 {stats?.find(s=>s.subject==='反應力')?.A || 0}
                </div>
             </div>
             <p className="text-xs text-slate-400 font-medium">Scan to challenge me!</p>
          </div>
        </div>
      </div>

      {/* 詳細題解 (網頁版顯示) */}
      <div className="mt-8 border-t border-slate-200 pt-8">
        <h3 className="text-xl font-bold text-slate-700 mb-6 flex items-center gap-2">
           <Award className="text-indigo-500"/> 詳細題解分析
        </h3>
        <div className="grid gap-6">
          {results.map((r, idx) => (
            <div key={r.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-3">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <span className="inline-block bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-xs font-bold mb-2">Q{idx+1}</span>
                  <h4 className="font-bold text-slate-800 leading-snug">{r.text}</h4>
                </div>
                <div className="text-right ml-4">
                  <span className={`text-lg font-black ${r.gainedPoints === Number(r.points) ? 'text-green-500' : 'text-orange-400'}`}>
                    +{r.gainedPoints}
                  </span>
                  <span className="text-xs text-slate-400 block">/ {r.points}</span>
                </div>
              </div>
              
              {/* 熱點圖顯示 */}
              {r.type === 'hotspot' && r.image && (
                <div className="relative aspect-video bg-slate-50 rounded-xl overflow-hidden border border-slate-200">
                  <ZoomableImage src={r.image} alt="題目圖片" markers={r.userAns || []} onClick={() => {}} />
                  <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" viewBox="0 0 100 100" preserveAspectRatio="none">
                    {r.targets?.map((t, i) => (
                       <polygon key={i} points={renderPolygon(t.points)} fill="rgba(34, 197, 94, 0.3)" stroke="#22c55e" strokeWidth="1"/>
                    ))}
                  </svg>
                </div>
              )}

              {/* 分類題詳細錯誤顯示 */}
              {r.type === 'sorting' && r.sortingErrors && r.sortingErrors.length > 0 && (
                <div className="bg-red-50 p-4 rounded-xl text-sm text-red-800 border border-red-100 space-y-3">
                  <div className="font-bold flex items-center gap-2 text-red-600">
                    <AlertTriangle size={16}/> 錯誤修正：
                  </div>
                  <ul className="space-y-2 pl-1">
                    {r.sortingErrors.map((err, i) => (
                      <li key={i} className="flex items-start gap-2 leading-tight">
                        <span className="mt-0.5 text-red-400">•</span>
                        <div>
                          <span className="font-bold text-slate-700 mr-2">{err.text}</span>
                          {err.type === 'wrong' ? (
                            <span className="text-slate-500 bg-white px-2 py-0.5 rounded border border-red-100 text-xs inline-flex items-center gap-1 flex-wrap">
                                (誤: <span className="text-red-500 line-through decoration-2 mx-1">{err.userCat}</span> 
                                <ArrowRight size={12} className="text-slate-400"/> 
                                正: <span className="text-green-600 font-black mx-1">{err.correctCat}</span>)
                            </span>
                          ) : (
                            <span className="text-slate-400 bg-white px-2 py-0.5 rounded border border-red-100 text-xs inline-flex items-center gap-1 flex-wrap">
                                (未分類 <ArrowRight size={12}/> 正: <span className="text-green-600 font-black mx-1">{err.correctCat}</span>)
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* 選擇題詳解 */}
              {r.type === 'choice' && (
                 <div className={`text-sm font-medium p-3 rounded-lg ${r.isCorrect ? 'bg-indigo-50 text-indigo-700' : 'bg-red-50 text-red-700'}`}>
                   {r.detail}
                 </div>
              )}
              
              {/* 通用詳解 */}
              {r.type !== 'choice' && r.type !== 'sorting' && (
                 <div className="text-sm font-medium p-3 rounded-lg bg-slate-50 text-slate-600">{r.detail}</div>
              )}

              {/* 🔥🔥🔥 新增：AI 導師點評按鈕區 🔥🔥🔥 */}
              <div className="mt-3 pt-3 border-t border-slate-100">
                  {aiFeedback[r.id] ? (
                     <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 relative overflow-hidden animate-in fade-in zoom-in duration-300">
                         <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-indigo-500 to-purple-500"/>
                         <h5 className="font-bold text-indigo-700 flex items-center gap-2 mb-2 text-sm">
                             <Zap size={16} className="fill-indigo-200"/> AI 智慧導師點評
                         </h5>
                         <p className="text-slate-700 text-sm leading-relaxed font-medium">
                             {aiFeedback[r.id]}
                         </p>
                     </div>
                  ) : (
                     <button 
                        onClick={() => handleGetAiFeedback(r, r.userAns)}
                        disabled={loadingAi[r.id]}
                        className="text-sm font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-3 py-2 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                     >
                        {loadingAi[r.id] ? (
                            <><Loader2 size={16} className="animate-spin"/> 正在分析...</>
                        ) : (
                            <><Zap size={16}/> 聽聽 AI 老師怎麼說？</>
                        )}
                     </button>
                  )}
              </div>

            </div>
          ))}
        </div>
      </div>
    </div>
  );
}