import React from 'react';
import { motion } from 'framer-motion';
import { Edit3, CheckSquare, BarChart3 } from 'lucide-react';

export default function HomeView({ quizTitle, responseCount, onNavigate, isAdmin }) {
  return (
    <div className="space-y-16 py-10 relative z-10">
      <div className="text-center space-y-6">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.5, type: "spring" }} className="inline-block p-6 bg-white rounded-[2rem] shadow-2xl shadow-indigo-200 mb-4 rotate-3">
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