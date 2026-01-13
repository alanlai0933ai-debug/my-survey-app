import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, User, Play, Clock, Star, CheckCircle, ChevronLeft, ChevronRight, Target, Zap } from 'lucide-react';
import { isPointInPolygon, formatTime } from '../utils/mathHelpers'; // 修正路徑
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';

// 引入剛做好的子組件
import HotspotQuestion from '../components/HotspotQuestion';
import SortingQuestion from '../components/SortingQuestion';

export default function SurveyTaker({ quizData, onSubmit, onCancel, isSubmitting }) {
  const [answers, setAnswers] = useState({});
  const [currentQ, setCurrentQ] = useState(0); 
  const containerRef = useRef(null); 
  const [isStarted, setIsStarted] = useState(false);
  const [nickname, setNickname] = useState("");
  const [inputEmail, setInputEmail] = useState("");
  const [startTime, setStartTime] = useState(null); 
  const [gameStartTime, setGameStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [times, setTimes] = useState({});
  const [interactionCount, setInteractionCount] = useState(0);

  // ... (保留原本的邏輯代碼，這裡篇幅有限，請將原本 SurveyTaker 的所有內部邏輯完整貼過來)
  // 為了方便您，我將關鍵邏輯縮寫，您搬運時請直接複製原檔的 function body
  
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

  // Effect 區塊 (Timer, StartTime 等)
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

  // 成績計算邏輯
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

  // Render 主要畫面 (海浪進度條 + 題目卡片 + 統計側欄)
  // ... (請將原始 SurveyTaker 的 return 部分，行號 76-100 完整貼入)
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

        {/* 進度條區域 (省略重複代碼，請複製原檔 79-82 行) */}
        <div className="relative mb-8 mt-4">
           {/* ...複製海浪進度條... */}
            <div className="h-5 bg-blue-50/50 rounded-full overflow-hidden shadow-inner border border-blue-100 relative backdrop-blur-sm">
                <motion.div 
                className="h-full bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 relative overflow-hidden"
                initial={{ width: 0 }} 
                animate={{ width: `${progress}%` }} 
                transition={{ type: "spring", stiffness: 35, damping: 12 }}
                />
            </div>
            {/* ...複製海龜... */}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentQ}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="bg-white p-8 rounded-3xl shadow-2xl shadow-indigo-100 border border-white relative z-10"
          >
             {/* 題目顯示邏輯 */}
             <span className="inline-block bg-indigo-100 text-indigo-700 px-3 py-1 rounded-lg text-xs font-bold mb-4 uppercase tracking-widest">Challenge #{currentQ + 1}</span>
             <div className="mb-8">
                <h3 className="text-2xl font-bold text-slate-800 leading-relaxed mb-2">
                    {q.text} {q.isMulti && <span className="text-sm font-normal text-slate-500 ml-2">(可複選)</span>}
                </h3>
                {q.note && <div className="inline-block bg-slate-50 border border-slate-100 px-3 py-2 rounded-lg"><p className="text-slate-500 text-sm font-medium">💡 {q.note}</p></div>}
             </div>

             {/* 題型選擇與組件調用 */}
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
                          {image && <img src={image} className="w-full h-32 object-cover rounded-lg mb-2" alt="Option" />}
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

             {q.type === 'hotspot' && <HotspotQuestion q={q} currentAnswer={answers[q.id] || []} onAnswer={handleAnswer} />}
             {q.type === 'sorting' && <SortingQuestion q={q} currentAnswer={answers[q.id] || {}} onAnswer={handleAnswer} />}

          </motion.div>
        </AnimatePresence>

        <div className="flex justify-between mt-8">
          <button onClick={() => setCurrentQ(Math.max(0, currentQ - 1))} disabled={currentQ === 0} className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-colors ${currentQ === 0 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-500 hover:bg-slate-100'}`}>
            <ChevronLeft size={20}/> 上一關
          </button>
          
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