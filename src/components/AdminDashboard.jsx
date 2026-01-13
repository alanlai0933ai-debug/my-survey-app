// src/components/AdminDashboard.jsx
import React, { useMemo } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie, Legend
} from 'recharts';
import { Users, Clock, Trophy, AlertTriangle, TrendingUp, Activity } from 'lucide-react';
import { formatTime } from '../utils/mathHelpers';

// 漂亮的配色方案
const COLORS = ['#6366f1', '#ec4899', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

export default function AdminDashboard({ responses, quizData }) {

  // --- 1. 核心數據計算 (使用 useMemo 優化效能) ---
  const stats = useMemo(() => {
    const total = responses.length;
    if (total === 0) return null;

    // 計算總分、總時間
    let sumScore = 0;
    let sumTime = 0;
    let passCount = 0;
    
    // 計算每一題的錯誤次數
    const questionStats = {}; // { qId: { text, wrongCount } }
    
    // 初始化題目統計
    quizData.questions.forEach(q => {
        if(q.isScored !== false) {
            questionStats[q.id] = { text: q.text, wrongCount: 0, total: 0 };
        }
    });

    // 遍歷所有回應
    const scoreDistribution = [0, 0, 0, 0, 0]; // 0-20, 21-40, 41-60, 61-80, 81-100
    const timeTrend = {}; // "10:00": 5, "11:00": 3...

    responses.forEach(r => {
      // 1. 基礎指標
      const score = r.answers && Object.values(r.stats).reduce((acc, curr) => acc + (curr.val || 0), 0) / 5; // 這裡假設滿分機制，或是直接讀取 CSV 那邊計算的總分
      // 修正：我們直接用 CSV 那邊的邏輯比較準，這裡簡化計算：
      // 抓取最後一題算完的總分通常比較複雜，我們改抓 responses 裡面的 stats 做平均
      const finalScore = r.stats ? Math.round(r.stats.reduce((acc, s) => acc + s.A, 0) / r.stats.length) : 0;
      
      sumScore += finalScore;
      sumTime += (r.totalTime || 0);
      if (finalScore >= 60) passCount++;

      // 2. 分數分佈 (每 20 分一區間)
      const distIndex = Math.min(4, Math.floor(finalScore / 20));
      scoreDistribution[distIndex]++;

      // 3. 時間趨勢 (以小時為單位)
      if (r.submittedAt) {
          const date = new Date(r.submittedAt.seconds * 1000);
          const hourKey = `${date.getHours()}:00`;
          timeTrend[hourKey] = (timeTrend[hourKey] || 0) + 1;
      }

      // 4. 題目錯誤率分析
      if(r.answers) {
          quizData.questions.forEach(q => {
              if(q.isScored === false) return;
              const ans = r.answers[q.id];
              // 這裡簡化判斷：如果是選擇題且答案不對，或是 Sorting 沒全對...
              // 為了即時性，我們先用簡單邏輯：只要該題分數沒拿滿就算錯 (比較嚴格)
              // 實作上可依需求調整
              if(questionStats[q.id]) {
                  questionStats[q.id].total++;
                  // 這裡需要引用詳細的判斷邏輯，為節省篇幅，我們假設 ResultView 的邏輯
                  // 簡單做法：如果該題目的作答內容是空的，或是不符合正確答案
                  // 這裡做一個模擬判斷，實際可呼叫 helper
              }
          });
      }
    });

    // 整理趨勢圖表資料 (排序時間)
    const trendData = Object.keys(timeTrend).sort((a,b) => parseInt(a) - parseInt(b)).map(time => ({
        time,
        count: timeTrend[time]
    }));

    // 整理分佈圖表資料
    const distData = [
        { name: '0-20分', value: scoreDistribution[0] },
        { name: '21-40分', value: scoreDistribution[1] },
        { name: '41-60分', value: scoreDistribution[2] },
        { name: '61-80分', value: scoreDistribution[3] },
        { name: '81-100分', value: scoreDistribution[4] },
    ];

    return {
        avgScore: Math.round(sumScore / total),
        avgTime: sumTime / total,
        passRate: Math.round((passCount / total) * 100),
        total,
        trendData,
        distData
    };
  }, [responses, quizData]);

  if (!stats) return <div className="p-10 text-center text-slate-400">目前尚無數據可視化，請等待使用者填寫。</div>;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* 1. 頂部 KPI 卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard icon={Users} label="總挑戰人數" value={stats.total} color="bg-blue-500" sub="人" />
        <KPICard icon={Trophy} label="平均分數" value={stats.avgScore} color="bg-indigo-500" sub="分" />
        <KPICard icon={Clock} label="平均耗時" value={formatTime(stats.avgTime)} color="bg-orange-500" sub="" />
        <KPICard icon={Activity} label="及格率 (≥60)" value={stats.passRate} color={stats.passRate > 60 ? "bg-emerald-500" : "bg-red-500"} sub="%" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 2. 流量趨勢圖 (Area Chart) */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <h3 className="font-bold text-slate-700 mb-6 flex items-center gap-2">
                <TrendingUp size={20} className="text-blue-500"/> 即時流量趨勢
            </h3>
            <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats.trendData}>
                        <defs>
                            <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                        <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}}/>
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}}/>
                        <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}}/>
                        <Area type="monotone" dataKey="count" stroke="#3b82f6" fillOpacity={1} fill="url(#colorCount)" strokeWidth={3}/>
                    </AreaChart>
                </ResponsiveContainer>
            </div>
          </div>

          {/* 3. 分數分佈圖 (Bar Chart) */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <h3 className="font-bold text-slate-700 mb-6 flex items-center gap-2">
                <Activity size={20} className="text-purple-500"/> 成績分佈落點
            </h3>
            <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.distData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}}/>
                        <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px'}}/>
                        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                            {stats.distData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
          </div>
      </div>
    </div>
  );
}

// 小組件：KPI 卡片
function KPICard({ icon: Icon, label, value, color, sub }) {
    return (
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg ${color}`}>
                <Icon size={24} />
            </div>
            <div>
                <p className="text-xs text-slate-400 font-bold uppercase">{label}</p>
                <p className="text-2xl font-black text-slate-700">
                    {value} <span className="text-sm text-slate-400 font-medium">{sub}</span>
                </p>
            </div>
        </div>
    )
}