// src/views/SurveyTaker.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, User, Play, Clock, Star, CheckCircle, ChevronRight, Zap, Trophy, XCircle, AlertCircle, BookmarkCheck, Flame } from 'lucide-react';
import { isPointInPolygon, formatTime } from '../utils/mathHelpers';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import useSound from 'use-sound';

// 引入子組件
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
  // eslint-disable-next-line no-unused-vars
  const [interactionCount, setInteractionCount] = useState(0);
  
  // 控制是否顯示即時回饋 (詳解模式)
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCurrentCorrect, setIsCurrentCorrect] = useState(false);
  
  // Combo 連擊狀態
  const [combo, setCombo] = useState(0);

  // 🔊 音效設定
  const [playClick] = useSound('', { volume: 0.5 });
  const [playCorrect] = useSound('', { volume: 0.5 });
  const [playWrong] = useSound('', { volume: 0.5 });
  // const [playCombo] = useSound('', { volume: 0.4 });

  // Timer Effect
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
    // 切換題目時，重置回饋狀態
    setShowFeedback(false);
    setIsCurrentCorrect(false);
  }, [currentQ, isStarted]);

  // 成績計算邏輯
  const calculateStats = () => {
    if (!quizData || !quizData.questions) return []; 

    const scores = {
      '觀察力': { val: 0, max: 0 }, 
      '決策力': { val: 0, max: 0 }, 
      '邏輯力': { val: 0, max: 0 }, 
      '反應力': { val: 0, count: 0 }, 
      '專注度': { val: 0, max: 0 } 
    };

    quizData.questions.forEach(q => {
      if (q.isScored === false) return;

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

  const currentStats = useMemo(() => calculateStats(), [answers, times, quizData]);

  // 作答處理
  const handleAnswer = (val) => {
    if (showFeedback) return;
    
    // playClick(); 
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
    } else {
      setAnswers({ ...answers, [qId]: val });
    }
  };

  // 判定答案與顯示特效
  const handleCheckAnswer = async () => {
    const q = quizData.questions[currentQ];
    const ans = answers[q.id];
    let correct = false;

    // --- 判斷邏輯 ---
    if (q.isScored === false) {
       correct = true;
    } else {
        if (q.type === 'choice') {
           if (q.isMulti) {
              const correctOptions = q.options.filter(o => o.isCorrect).map(o => o.label);
              const userSelected = Array.isArray(ans) ? ans : [];
              correct = correctOptions.length === userSelected.length && correctOptions.every(v => userSelected.includes(v));
           } else {
              const correctOption = q.options.find(o => o.isCorrect)?.label;
              correct = ans === correctOption;
           }
        } else if (q.type === 'hotspot') {
           const totalTargets = q.targets?.length || 0;
           const hits = (q.targets || []).filter(t => (ans || []).some(pin => isPointInPolygon(pin, t.points))).length;
           correct = hits === totalTargets && totalTargets > 0;
        } else if (q.type === 'sorting') {
           const totalItems = q.items.length || 1;
           let correctCount = 0;
           q.items.forEach(i => { if (ans && ans[i.id] === i.correctCategory) correctCount++; });
           correct = correctCount === totalItems;
        }
    }

    setIsCurrentCorrect(correct);
    setShowFeedback(true);

    // Combo 更新邏輯
    if (correct) {
       setCombo(prev => prev + 1);
       if (combo >= 1) { 
          // playCombo(); 
       } else {
          playCorrect(); 
       }
    } else {
       setCombo(0);
       playWrong();
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

  if (!quizData || !quizData.questions || quizData.questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-400">
        <Loader2 className="animate-spin mb-2" size={32}/>
        <p>正在載入挑戰內容，請稍候...</p>
        <button onClick={onCancel} className="mt-4 text-sm text-indigo-500 hover:underline">返回首頁</button>
      </div>
    );
  }

  // 尚未開始遊戲的畫面
  if (!isStarted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] text-center space-y-8 px-4">
        <div className="p-6 bg-white rounded-full shadow-xl shadow-indigo-100 mb-4">
           <User size={64} className="text-indigo-600" />
        </div>
        <h2 className="text-3xl md:text-4xl font-bold text-slate-800">歡迎來到挑戰賽</h2>
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
  const hasAnswered = answers[q.id] && (Array.isArray(answers[q.id]) ? answers[q.id].length > 0 : true);
  const isSurveyMode = q.isScored === false;

  return (
    <div className="flex flex-col lg:flex-row gap-8 h-full items-start relative" ref={containerRef}>
      
      {/* Combo 特效區 */}
      <AnimatePresence>
        {showFeedback && combo > 1 && (
           <motion.div 
             initial={{ scale: 0, opacity: 0, y: 50, rotate: -10 }}
             animate={{ scale: 1.5, opacity: 1, y: 0, rotate: 0 }}
             exit={{ scale: 0, opacity: 0, transition: { duration: 0.2 } }}
             className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] pointer-events-none flex flex-col items-center"
           >
              <div className="text-6xl md:text-8xl font-black text-yellow-400 drop-shadow-[0_5px_5px_rgba(0,0,0,0.5)] italic flex items-center gap-2" style={{ textShadow: '0 0 20px orange' }}>
                 <Flame size={60} className="text-orange-500 animate-pulse"/> 
                 COMBO <span className="text-white text-8xl md:text-9xl">x{combo}</span>
              </div>
              <div className="text-white bg-orange-500 px-4 py-1 rounded-full text-xl font-bold mt-2 shadow-lg animate-bounce">
                 Unstoppable! 🔥
              </div>
           </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 w-full max-w-2xl mx-auto order-2 lg:order-1">
        <div className="mb-6 flex flex-wrap justify-between items-end gap-2">
           <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              Level {currentQ + 1} / {quizData.questions.length}
              {combo > 1 && (
                 <motion.span 
                   initial={{ scale: 0 }} 
                   animate={{ scale: 1 }} 
                   className="bg-orange-500 text-white px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1"
                 >
                    <Flame size={10}/> x{combo}
                 </motion.span>
              )}
          </div>
          <div className="flex items-center gap-2 md:gap-4">
              <span className="text-indigo-600 font-bold text-sm md:text-base">{nickname}</span>
              <span className="bg-slate-100 text-slate-600 px-2 md:px-3 py-1 rounded-lg text-xs md:text-sm font-bold flex items-center gap-2">
                 <Clock size={14}/> {formatTime(elapsedTime)}
              </span>
              <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs font-bold flex items-center gap-1">
                 <Star size={12} fill="currentColor"/> {q.points || 0}分
              </span>
          </div>
        </div>

        {/* 進度條 */}
        <div className="relative mb-8 mt-4">
           <div className="h-5 bg-blue-50/50 rounded-full overflow-hidden shadow-inner border border-blue-100 relative backdrop-blur-sm">
                <motion.div 
                  className="h-full bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 relative overflow-hidden"
                  initial={{ width: 0 }} 
                  animate={{ width: `${progress}%` }} 
                  transition={{ type: "spring", stiffness: 35, damping: 12 }}
                >
                   <motion.div 
                    className="absolute inset-0 w-full h-full opacity-20"
                    style={{ backgroundImage: 'linear-gradient(45deg,rgba(255,255,255,.3) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.3) 50%,rgba(255,255,255,.3) 75%,transparent 75%,transparent)', backgroundSize: '1rem 1rem' }}
                    animate={{ backgroundPosition: ["0rem 0rem", "1rem 0rem"] }}
                    transition={{ repeat: Infinity, ease: "linear", duration: 1 }}
                    />
                </motion.div>
           </div>
           <motion.div 
            className="absolute top-1/2 -translate-y-1/2 z-10"
            initial={{ left: 0 }}
            animate={{ left: `${progress}%` }}
            transition={{ type: "spring", stiffness: 35, damping: 12 }} 
            style={{ marginLeft: '-14px' }}
           >
             <div className="relative group cursor-pointer">
                <div className="bg-white p-1 rounded-full shadow-lg border-2 border-blue-200 flex items-center justify-center w-9 h-9 relative transform -rotate-6 hover:rotate-0 transition-transform">
                   <span className="text-lg">🐢</span> 
                </div>
             </div>
           </motion.div>
        </div>

        <AnimatePresence mode="wait">
           <motion.div
            key={currentQ}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className={`bg-white p-5 md:p-8 rounded-3xl shadow-2xl border relative z-10 transition-colors duration-500 ${
                showFeedback 
                ? (isSurveyMode ? 'shadow-blue-100 border-blue-200' : (isCurrentCorrect ? 'shadow-green-100 border-green-200' : 'shadow-red-100 border-red-200'))
                : 'shadow-indigo-100 border-white'
            }`}
          >
             <div className="flex justify-between items-start mb-4">
                <span className="inline-block bg-indigo-100 text-indigo-700 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-widest">Challenge #{currentQ + 1}</span>
                {showFeedback && (
                   <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className={`flex items-center gap-1 font-bold ${isSurveyMode ? 'text-blue-600' : (isCurrentCorrect ? 'text-green-600' : 'text-red-500')}`}>
                      {isSurveyMode ? <><BookmarkCheck/> 已記錄</> : (isCurrentCorrect ? <><CheckCircle/> 答對了！</> : <><XCircle/> 答錯了！</>)}
                   </motion.div>
                )}
             </div>

             <div className="mb-8">
                <h3 className="text-xl md:text-2xl font-bold text-slate-800 leading-relaxed mb-2">
                    {q.text} {q.isMulti && <span className="text-sm font-normal text-slate-500 ml-2">(可複選)</span>}
                </h3>
             </div>

             {/* 題型渲染區 */}
             {q.type === 'choice' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {q.options.map((opt, oIdx) => {
                      const label = typeof opt === 'string' ? opt : opt.label;
                      const image = typeof opt === 'string' ? "" : opt.image;
                      const isCorrectOption = typeof opt === 'string' ? false : opt.isCorrect;
                      const currentAns = answers[q.id];
                      const selected = Array.isArray(currentAns) ? currentAns.includes(label) : currentAns === label;
                      
                      let btnClass = "border-slate-100 hover:border-indigo-200 hover:bg-slate-50";
                      let iconClass = "border-slate-300";
                      let textClass = "text-slate-600";
                      
                      if (showFeedback) {
                         if (isSurveyMode) {
                            if (selected) {
                                btnClass = "border-blue-500 bg-blue-50 ring-2 ring-blue-200";
                                iconClass = "bg-blue-500 border-blue-500";
                                textClass = "text-blue-700";
                            }
                         } else {
                             if (isCorrectOption) {
                                btnClass = "border-green-500 bg-green-50 ring-2 ring-green-200";
                                iconClass = "bg-green-500 border-green-500";
                                textClass = "text-green-700";
                             } else if (selected && !isCorrectOption) {
                                btnClass = "border-red-500 bg-red-50 ring-2 ring-red-200";
                                iconClass = "bg-red-500 border-red-500";
                                textClass = "text-red-700";
                             } else {
                                btnClass = "border-slate-100 opacity-50";
                             }
                         }
                      } else if (selected) {
                         btnClass = "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200";
                         iconClass = "bg-indigo-500 border-indigo-500";
                         textClass = "text-indigo-700";
                      }

                      return (
                        <motion.button 
                          whileHover={{ scale: showFeedback ? 1 : 1.02 }}
                          whileTap={{ scale: showFeedback ? 1 : 0.98 }}
                          key={oIdx} 
                          onClick={() => handleAnswer(label)}
                          disabled={showFeedback}
                          className={`text-left flex flex-col gap-2 p-4 border-2 rounded-2xl transition-all duration-200 h-full ${btnClass}`}
                        >
                          {image && <img src={image} className="w-full h-32 object-cover rounded-lg mb-2" alt="Option" />}
                          <div className="flex items-center gap-3">
                            <div className={`w-6 h-6 rounded flex-shrink-0 flex items-center justify-center border-2 ${q.isMulti ? 'rounded-md' : 'rounded-full'} ${iconClass}`}>
                                {(selected || (showFeedback && !isSurveyMode && isCorrectOption)) && <CheckCircle size={14} className="text-white" />}
                            </div>
                            <span className={`font-bold ${textClass}`}>{label}</span>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
             )}

             {q.type === 'hotspot' && (
                <HotspotQuestion 
                   q={q} 
                   currentAnswer={answers[q.id] || []} 
                   onAnswer={handleAnswer} 
                   isReviewMode={showFeedback} 
                />
             )}
             {q.type === 'sorting' && (
                <SortingQuestion 
                   q={q} 
                   currentAnswer={answers[q.id] || {}} 
                   onAnswer={handleAnswer} 
                   isReviewMode={showFeedback} 
                />
             )}
            {/*
             {showFeedback && (
                <motion.div 
                   initial={{ height: 0, opacity: 0 }} 
                   animate={{ height: 'auto', opacity: 1 }} 
                   className="mt-6 pt-6 border-t border-slate-100 bg-slate-50 p-4 rounded-xl"
                >
                   <div className="flex items-start gap-2">
                      <AlertCircle className="text-indigo-500 mt-1" size={20}/>
                      <div>
                         <h4 className="font-bold text-slate-700 mb-1">標準解析：</h4>
                         <p className="text-slate-600 text-sm leading-relaxed">
                            {q.note || "本題暫無詳細解析。"}
                         </p>
                      </div>
                   </div>
                </motion.div>
             )}
               */}

           </motion.div>
        </AnimatePresence>

        <div className="flex justify-end mt-8 pb-10">
          {!showFeedback ? (
             <button 
                onClick={handleCheckAnswer} 
                disabled={!hasAnswered}
                className="w-full md:w-auto px-8 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-105 transition-all disabled:opacity-50 disabled:bg-slate-300"
             >
                確定送出 <CheckCircle size={20}/>
             </button>
          ) : (
             <button 
                onClick={handleNext} 
                disabled={isSubmitting}
                className={`w-full md:w-auto px-8 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg text-white transition-all animate-bounce-short ${isSurveyMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}`}
             >
                {isSubmitting ? <Loader2 className="animate-spin" size={20}/> : (currentQ === quizData.questions.length - 1 ? '查看成績' : '下一關')} 
                {!isSubmitting && <ChevronRight size={20}/>}
             </button>
          )}
        </div>
      </div>

      <div className="w-full lg:w-80 order-1 lg:order-2 lg:sticky lg:top-28">
        <div className="bg-white p-4 md:p-6 rounded-3xl shadow-xl border border-slate-100">
          <h4 className="text-center font-bold text-slate-800 mb-4 flex items-center justify-center gap-2"><Trophy size={18} className="text-pink-500"/> 即時能力分析</h4>
          <div className="h-48 md:h-64 w-full">
             <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={currentStats}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} />
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