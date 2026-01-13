// src/components/HotspotAdminEditor.jsx
import React, { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';

function HotspotAdminEditor({ image, targets, onUpdate }) {
  const containerRef = useRef(null);
  const [activeDrag, setActiveDrag] = useState(null);

  const renderPolygon = (points) => {
    if (!points || !Array.isArray(points)) return "";
    return points.map(p => `${p.x},${p.y}`).join(' ');
  };

  const targetsRef = useRef(targets);
  useEffect(() => { targetsRef.current = targets; }, [targets]);

  const handleContainerPointerMove = (e) => {
    if (!activeDrag || !containerRef.current) return;
    e.preventDefault(); 
    const rect = containerRef.current.getBoundingClientRect();
    let x = ((e.clientX - rect.left) / rect.width) * 100;
    let y = ((e.clientY - rect.top) / rect.height) * 100;
    x = Math.max(0, Math.min(100, x));
    y = Math.max(0, Math.min(100, y));

    const { tIdx, pIdx } = activeDrag;
    const newTargets = [...targetsRef.current];
    const newPoints = [...newTargets[tIdx].points];
    newPoints[pIdx] = { x, y };
    newTargets[tIdx] = { ...newTargets[tIdx], points: newPoints };
    onUpdate(newTargets);
  };

  const handleContainerPointerUp = () => setActiveDrag(null);

  return (
    <div 
      className="relative w-full h-full select-none touch-none" 
      ref={containerRef}
      onPointerMove={handleContainerPointerMove}
      onPointerUp={handleContainerPointerUp}
      onPointerLeave={handleContainerPointerUp}
    >
      <img src={image} className="w-full h-full object-contain pointer-events-none select-none" alt="target" />
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
        {targets?.map((target, i) => (
          <polygon key={i} points={renderPolygon(target.points)} fill="rgba(34, 197, 94, 0.3)" stroke="#22c55e" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      {targets?.map((target, tIdx) => (
        <React.Fragment key={target.id}>
          {target.points && target.points.length > 0 && (
             <div 
                className="absolute w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center cursor-pointer hover:bg-red-600 z-30 shadow-sm"
                style={{ 
                  left: `${target.points[0].x}%`, 
                  top: `${target.points[0].y}%`, 
                  transform: 'translate(10px, -10px)' 
                }}
                onPointerDown={(e) => {
                   e.stopPropagation();
                   if(window.confirm('刪除此判定區？')) {
                      const newTargets = targets.filter((_, i) => i !== tIdx);
                      onUpdate(newTargets);
                   }
                }}
             >
                <X size={12}/>
             </div>
          )}
          {target.points?.map((p, pIdx) => (
            <div
              key={`${target.id}-${pIdx}`}
              onPointerDown={(e) => {
                e.stopPropagation();
                e.target.setPointerCapture(e.pointerId);
                setActiveDrag({ tIdx, pIdx });
              }}
              className={`absolute w-4 h-4 bg-green-500 border-2 border-white rounded-full shadow-md z-20 cursor-move ${activeDrag?.tIdx === tIdx && activeDrag?.pIdx === pIdx ? 'scale-125 bg-green-400' : ''}`}
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
  );
}

export default HotspotAdminEditor;