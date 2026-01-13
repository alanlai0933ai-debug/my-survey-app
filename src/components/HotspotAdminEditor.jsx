import React, { useState, useRef, useEffect } from 'react';
import { X, Check, Trash2 } from 'lucide-react';

// 修正 Props 名稱以配合 AdminPanel: image -> imageUrl, onUpdate -> onChange
export default function HotspotAdminEditor({ imageUrl, targets = [], onChange }) {
  const containerRef = useRef(null);
  
  // --- 狀態管理 ---
  // 1. 您的拖曳邏輯
  const [activeDrag, setActiveDrag] = useState(null);
  // 2. 我的繪圖邏輯 (正在畫的新多邊形)
  const [editingPoints, setEditingPoints] = useState([]);

  // 確保 targets 永遠是陣列
  const safeTargets = Array.isArray(targets) ? targets : [];
  const targetsRef = useRef(safeTargets);
  useEffect(() => { targetsRef.current = safeTargets; }, [safeTargets]);

  // --- 輔助函數 ---
  const renderPolygon = (points) => {
    if (!points || !Array.isArray(points)) return "";
    return points.map(p => `${p.x},${p.y}`).join(' ');
  };

  const getRelativeCoords = (e) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    let x = ((e.clientX - rect.left) / rect.width) * 100;
    let y = ((e.clientY - rect.top) / rect.height) * 100;
    return { x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) };
  };

  // --- 事件處理：拖曳 (您的邏輯) ---
  const handleContainerPointerMove = (e) => {
    if (!activeDrag || !containerRef.current) return;
    e.preventDefault(); 
    
    // 限制範圍在 0-100%
    const { x, y } = getRelativeCoords(e);
    const clampedX = Math.max(0, Math.min(100, x));
    const clampedY = Math.max(0, Math.min(100, y));

    const { tIdx, pIdx } = activeDrag;
    const newTargets = [...targetsRef.current];
    // 深層複製以避免 Mutation
    const newTarget = { ...newTargets[tIdx] };
    const newPoints = [...newTarget.points];
    
    newPoints[pIdx] = { x: clampedX, y: clampedY };
    newTarget.points = newPoints;
    newTargets[tIdx] = newTarget;
    
    onChange(newTargets);
  };

  const handleContainerPointerUp = () => setActiveDrag(null);

  // --- 事件處理：點擊繪圖 (新增的邏輯) ---
  const handleContainerClick = (e) => {
    // 如果正在拖曳，不要觸發點擊繪圖
    if (activeDrag) return;
    
    // 取得點擊座標
    const point = getRelativeCoords(e);
    setEditingPoints(prev => [...prev, point]);
  };

  // 完成繪製
  const commitPolygon = (e) => {
    e.stopPropagation(); // 避免觸發底下的點擊
    if (editingPoints.length < 3) return alert("多邊形至少需要 3 個點");
    
    const newTarget = {
      id: Date.now(),
      points: editingPoints,
    };
    onChange([...safeTargets, newTarget]);
    setEditingPoints([]); // 清空暫存
  };

  return (
    <div className="space-y-2">
      {/* 操作提示列 */}
      <div className="flex justify-between items-center bg-slate-50 p-2 rounded border border-slate-200 text-xs">
         <span className="font-bold text-slate-500">
            {editingPoints.length > 0 
               ? `🔵 正在繪製... (${editingPoints.length} 點)` 
               : "💡 點擊畫面新增區域，拖曳綠點可微調"}
         </span>
         {editingPoints.length > 0 && (
            <div className="flex gap-2">
               <button onClick={() => setEditingPoints([])} className="px-2 py-1 text-slate-500 hover:bg-slate-200 rounded">取消</button>
               <button onClick={commitPolygon} className="px-3 py-1 bg-indigo-600 text-white rounded font-bold flex items-center gap-1 hover:bg-indigo-700">
                  <Check size={14}/> 完成
               </button>
            </div>
         )}
      </div>

      <div 
        className="relative w-full aspect-video select-none touch-none bg-slate-100 rounded-lg overflow-hidden border-2 border-slate-200" 
        ref={containerRef}
        onPointerMove={handleContainerPointerMove}
        onPointerUp={handleContainerPointerUp}
        onPointerLeave={handleContainerPointerUp}
        onClick={handleContainerClick} // 👈 這裡綁定了點擊事件
      >
        {imageUrl ? (
           <img src={imageUrl} className="w-full h-full object-contain pointer-events-none select-none" alt="target" />
        ) : (
           <div className="w-full h-full flex items-center justify-center text-slate-400">請先上傳圖片</div>
        )}

        {/* SVG 層：顯示線條 */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
          {/* 已完成的區域 (綠色) */}
          {safeTargets.map((target, i) => (
            <polygon key={i} points={renderPolygon(target.points)} fill="rgba(34, 197, 94, 0.3)" stroke="#22c55e" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
          ))}
          {/* 正在畫的區域 (藍色虛線) */}
          {editingPoints.length > 0 && (
             <polygon 
                points={renderPolygon(editingPoints)}
                fill="rgba(99, 102, 241, 0.2)"
                stroke="#6366f1"
                strokeWidth="0.5"
                strokeDasharray="2"
                vectorEffect="non-scaling-stroke"
             />
          )}
        </svg>

        {/* 控制點層 */}
        {/* 1. 顯示正在畫的點 (白點) */}
        {editingPoints.map((p, i) => (
           <div 
             key={`editing-${i}`}
             className="absolute w-3 h-3 bg-white border-2 border-indigo-600 rounded-full -ml-1.5 -mt-1.5 pointer-events-none"
             style={{ left: `${p.x}%`, top: `${p.y}%` }}
           />
        ))}

        {/* 2. 顯示已完成區域的控制點 (可拖曳綠點 + 刪除鈕) */}
        {safeTargets.map((target, tIdx) => (
          <React.Fragment key={target.id || tIdx}>
            {/* 刪除按鈕 (顯示在第一個點旁邊) */}
            {target.points && target.points.length > 0 && (
               <div 
                  className="absolute w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center cursor-pointer hover:bg-red-600 z-30 shadow-sm transition-transform hover:scale-110"
                  style={{ 
                    left: `${target.points[0].x}%`, 
                    top: `${target.points[0].y}%`, 
                    transform: 'translate(10px, -20px)' 
                  }}
                  onPointerDown={(e) => e.stopPropagation()} // 防止觸發繪圖
                  onClick={(e) => {
                     e.stopPropagation();
                     if(window.confirm('確定刪除此熱點區域？')) {
                        const newTargets = safeTargets.filter((_, i) => i !== tIdx);
                        onChange(newTargets);
                     }
                  }}
               >
                  <Trash2 size={12}/>
               </div>
            )}
            
            {/* 拖曳控制點 */}
            {target.points?.map((p, pIdx) => (
              <div
                key={`${target.id}-${pIdx}`}
                onPointerDown={(e) => {
                  e.stopPropagation(); // 👈 關鍵：阻止冒泡，避免觸發背景的 onClick
                  e.target.setPointerCapture(e.pointerId);
                  setActiveDrag({ tIdx, pIdx });
                }}
                className={`absolute w-4 h-4 bg-green-500 border-2 border-white rounded-full shadow-md z-20 cursor-move transition-transform ${activeDrag?.tIdx === tIdx && activeDrag?.pIdx === pIdx ? 'scale-150 bg-green-400' : 'hover:scale-125'}`}
                style={{ 
                  left: `${p.x}%`, 
                  top: `${p.y}%`, 
                  transform: 'translate(-50%, -50%)' 
                }}
              />
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}