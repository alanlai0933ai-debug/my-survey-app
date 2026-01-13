import React, { useState } from 'react';
import ReactDOM from 'react-dom'; // 用於 Portal
import { motion, AnimatePresence } from 'framer-motion';
import { Maximize, X } from 'lucide-react';

// 主組件
export default function SortingQuestion({ q, currentAnswer, onAnswer }) {
  const [positions, setPositions] = useState({});
  const [draggingId, setDraggingId] = useState(null);

  const allItems = q.items.map(i => typeof i === 'string' ? { id: i, text: i, image: '' } : i);

  return (
    <div className="space-y-8 select-none">
      {/* 待分類區 */}
      <motion.div layout className="flex gap-3 flex-wrap justify-center min-h-[100px] p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
        <AnimatePresence>
          {allItems.filter(item => !currentAnswer[item.id]).map(item => (
            <DraggableItem 
              key={item.id} 
              item={item} 
              positions={positions} 
              isDragging={draggingId === item.id}
              setDraggingId={setDraggingId}
              onDrop={(cat) => {
                 onAnswer({ ...currentAnswer, [item.id]: cat });
              }}
            />
          ))}
        </AnimatePresence>
        {allItems.every(i => currentAnswer[i.id]) && <div className="text-slate-400 text-sm italic w-full text-center py-4">所有項目已分類</div>}
      </motion.div>

      {/* 分類籃 */}
      <div className="grid grid-cols-2 gap-4">
        {q.categories.map(cat => (
          <div 
            key={cat} 
            ref={(el) => {
              if (el) {
                const rect = el.getBoundingClientRect();
                if (!positions[cat] || positions[cat].top !== rect.top) {
                   setPositions(prev => ({ ...prev, [cat]: rect }));
                }
              }
            }}
            className="min-h-[150px] border-2 border-indigo-100 rounded-2xl flex flex-col items-center p-4 bg-indigo-50/50 transition-colors hover:border-indigo-300 relative"
          >
            <span className="font-bold text-indigo-400 mb-2">{cat}</span>
            <div className="flex flex-wrap gap-2 w-full justify-center z-10">
              <AnimatePresence>
                {allItems.filter(item => currentAnswer[item.id] === cat).map(item => (
                  <DraggableItem 
                    key={item.id} 
                    item={item} 
                    positions={positions} 
                    isSorted={true}
                    isDragging={draggingId === item.id}
                    setDraggingId={setDraggingId}
                    onDrop={(targetCat) => {
                       if (targetCat === cat) return;
                       const next = { ...currentAnswer };
                       if (targetCat) next[item.id] = targetCat;
                       else delete next[item.id];
                       onAnswer(next);
                    }}
                  />
                ))}
              </AnimatePresence>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-center text-slate-400">💡 提示：項目可在籃子間自由拖曳，或拖回上方重置。</p>
    </div>
  );
}

// 子組件 (放在同一個檔案即可)
function DraggableItem({ item, positions, onDrop, isSorted, isDragging, setDraggingId }) {
  const [showZoom, setShowZoom] = useState(false);
  return (
    <>
      <motion.div 
        layout
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }} 
        drag 
        dragElastic={0.2}
        whileDrag={{ scale: 1.1, cursor: 'grabbing' }}
        dragMomentum={false}
        onPointerDown={() => setDraggingId(item.id)} 
        onPointerUp={() => setDraggingId(null)}
        onDragEnd={(e, info) => {
          setDraggingId(null);
          const dropPoint = { x: e.clientX, y: e.clientY };
          let matchedCategory = null;
          Object.keys(positions).forEach(cat => {
            const rect = positions[cat];
            if (dropPoint.x >= rect.left && dropPoint.x <= rect.right &&
                dropPoint.y >= rect.top && dropPoint.y <= rect.bottom) {
              matchedCategory = cat;
            }
          });
          onDrop(matchedCategory);
        }}
        className={`
          ${isSorted ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600'} 
          rounded-lg shadow-sm border border-slate-200 cursor-grab font-bold 
          flex flex-col items-center justify-center p-2 gap-1 select-none w-24 relative group
        `}
        style={{ zIndex: isDragging ? 9999 : 10 }} 
      >
        {item.image ? (
          <div className="w-full h-16 rounded overflow-hidden bg-slate-100 relative">
            <img src={item.image} className="w-full h-full object-cover pointer-events-none" alt="Item"/>
            <button 
              className="absolute bottom-0 right-0 bg-black/60 text-white p-1 rounded-tl-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-indigo-600"
              onPointerDown={(e) => {
                e.stopPropagation(); 
                setShowZoom(true); 
              }}
            >
              <Maximize size={12} />
            </button>
          </div>
        ) : null}
        <span className="text-xs truncate w-full text-center">{item.text}</span>
      </motion.div>

      {showZoom && ReactDOM.createPortal(
        <div 
          className="fixed inset-0 z-[10000] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={(e) => { e.stopPropagation(); setShowZoom(false); }}
        >
          <div className="relative max-w-4xl max-h-full animate-in fade-in zoom-in duration-300">
            <img 
              src={item.image} 
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl border border-white/20" 
              alt="Zoomed Preview"
            />
            <button 
              onClick={() => setShowZoom(false)}
              className="absolute -top-12 right-0 text-white hover:text-red-400 transition-colors bg-white/10 p-2 rounded-full"
            >
              <X size={24} />
            </button>
            <p className="text-white text-center mt-4 font-bold text-lg">{item.text}</p>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}