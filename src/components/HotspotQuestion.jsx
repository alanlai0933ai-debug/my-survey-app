import React, { useRef } from 'react';
import { motion } from 'framer-motion';

export default function HotspotQuestion({ q, currentAnswer, onAnswer }) {
  const imgRef = useRef(null);

  const handleClick = (e) => {
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const newPin = { id: Date.now(), x, y };

    const max = q.maxClicks || 1;
    let nextAns = [...currentAnswer];

    if (nextAns.length >= max) {
      nextAns.shift();
    }
    
    onAnswer([...nextAns, newPin]);
  };

  const removePin = (e, id) => {
    e.stopPropagation();
    onAnswer(currentAnswer.filter(p => p.id !== id));
  };

  return (
    <div className="relative rounded-2xl overflow-hidden border-4 border-slate-100 shadow-inner group select-none">
      <div className="relative w-full h-full aspect-video" onClick={handleClick}>
        <img ref={imgRef} src={q.image} className="w-full h-full object-contain cursor-crosshair pointer-events-none" alt="Hotspot Target" />
        {currentAnswer.map((pin, idx) => (
          <motion.div
            key={pin.id}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute w-6 h-6 -ml-3 -mt-3 bg-indigo-600 border-2 border-white rounded-full shadow-lg flex items-center justify-center text-white text-xs font-bold cursor-pointer hover:bg-red-500 transition-colors z-10"
            style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
            onClick={(e) => removePin(e, pin.id)}
          >
            {idx + 1}
          </motion.div>
        ))}
      </div>
      <div className="absolute bottom-4 left-4 bg-black/70 text-white text-xs px-3 py-1 rounded-full backdrop-blur-md pointer-events-none border border-white/20 shadow-lg">
        標記進度：{currentAnswer.length} / {q.maxClicks || 1} (點擊畫面新增)
      </div>
    </div>
  );
}