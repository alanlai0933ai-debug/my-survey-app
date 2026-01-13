import React from 'react';
import { motion } from 'framer-motion';
import { Edit3, CheckSquare, BarChart3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
// ✅ 1. 引入 Tilt 套件
import { Tilt } from 'react-tilt';

// ✅ 2. 設定 3D 參數 (可以自己微調)
const defaultOptions = {
	reverse:        false,  // 反轉傾斜方向
	max:            25,     // 最大傾斜角度 (度數)
	perspective:    1000,   // 透視感 (越小越誇張，1000 很剛好)
	scale:          1.05,   // 滑鼠移上去時放大的比例 (1.05 = 105%)
	speed:          1000,   // 動畫速度
	transition:     true,   // 是否開啟平滑過渡
	axis:           null,   // 是否鎖定軸向 (X 或 Y)
	reset:          true,   // 離開時是否復原
	easing:         "cubic-bezier(.03,.98,.52,.99)",    // 彈性緩動函數
};

export default function HomeView({ quizTitle, responseCount }) {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const handleNavigate = (id) => {
     if (id === 'admin') navigate('/admin');
     else if (id === 'survey') navigate('/survey');
     else if (id === 'stats') navigate('/stats');
  };

  return (
    <div className="space-y-16 py-10 relative z-10">
      {/* 標題與 Go 按鈕區域 */}
      <div className="text-center space-y-6">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }} 
          animate={{ scale: 1, opacity: 1 }} 
          transition={{ duration: 0.5, type: "spring" }} 
          className="inline-block p-6 bg-white rounded-[2rem] shadow-2xl shadow-indigo-200 mb-4 rotate-3"
        >
           <div className="bg-indigo-600 text-white w-24 h-24 rounded-2xl flex items-center justify-center text-4xl font-bold shadow-xl">Go</div>
        </motion.div>
        <div>
          <h2 className="text-6xl font-black text-slate-800 tracking-tight mb-2">{quizTitle || '載入中...'}</h2>
          <p className="text-xl text-slate-500 font-medium">準備好挑戰你的極限了嗎？</p>
        </div>
        
        {isAdmin && (
          <motion.div 
            initial={{ y: 10, opacity: 0 }} 
            animate={{ y: 0, opacity: 1 }} 
            className="inline-block bg-white text-indigo-600 px-8 py-3 rounded-full font-bold shadow-lg border border-indigo-50"
          >
            🔥 已有 {responseCount} 人完成挑戰
          </motion.div>
        )}
      </div>

      {/* 功能卡片區域 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 px-4">
        {[
          { id: 'admin', icon: Edit3, color: 'text-white', bg: 'bg-indigo-600', title: '設計關卡', desc: '管理者專用' },
          { id: 'survey', icon: CheckSquare, color: 'text-white', bg: 'bg-pink-500', title: '開始挑戰', desc: '進入遊戲世界' },
          { id: 'stats', icon: BarChart3, color: 'text-white', bg: 'bg-orange-500', title: '排行榜', desc: '查看數據分析' },
        ].map((item) => (
          // ✅ 3. 用 Tilt 包裹卡片
          <Tilt key={item.id} options={defaultOptions} className="h-full">
            <motion.div 
              // 這裡我們稍微減少 framer-motion 的旋轉，把舞台留給 Tilt
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              onClick={() => handleNavigate(item.id)} 
              className="bg-white p-8 rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 cursor-pointer group relative overflow-hidden h-full flex flex-col justify-between transform-style-3d"
            >
              {/* 卡片背景裝飾 */}
              <div className={`absolute top-0 right-0 w-32 h-32 ${item.bg} opacity-10 rounded-bl-[100%] transition-transform group-hover:scale-150 duration-500`}/>
              
              {/* 卡片圖示 (加了一點 Z 軸浮動感) */}
              <div 
                className={`w-16 h-16 ${item.bg} ${item.color} rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:rotate-12 transition-transform duration-300 relative z-10`}
                style={{ transform: 'translateZ(20px)' }} // 讓圖示看起來浮在卡片上
              >
                <item.icon size={32} />
              </div>
              
              <div className="relative z-10" style={{ transform: 'translateZ(10px)' }}>
                <h3 className="text-2xl font-bold mb-2 text-slate-800">{item.title}</h3>
                <p className="text-slate-400 font-medium">{item.desc}</p>
              </div>
            </motion.div>
          </Tilt>
        ))}
      </div>
    </div>
  );
}