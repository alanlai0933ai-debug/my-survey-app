import React from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

export default function PageLoader({ text = "系統載入中..." }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
        className="relative"
      >
        {/* 外圈 */}
        <div className="w-16 h-16 border-4 border-indigo-100 rounded-full" />
        {/* 內圈 (轉動的部分) */}
        <div className="absolute inset-0 border-t-4 border-indigo-600 rounded-full" />
      </motion.div>
      
      <motion.p 
        initial={{ opacity: 0.5 }}
        animate={{ opacity: 1 }}
        transition={{ repeat: Infinity, duration: 0.8, repeatType: "reverse" }}
        className="text-slate-400 font-bold tracking-widest text-sm uppercase"
      >
        {text}
      </motion.p>
    </div>
  );
}