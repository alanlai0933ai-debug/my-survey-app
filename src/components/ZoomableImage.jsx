import React, { useState } from 'react';
// src/components/ZoomableImage.jsx
// ==========================================
// 修正版：放大鏡圖片元件 (修復座標偏移問題)
// ==========================================
const ZoomableImage = ({ src, alt, onClick, markers = [] }) => {
  const [showMagnifier, setShowMagnifier] = useState(false);
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });
  const [imgSize, setImgSize] = useState({ width: 0, height: 0 });

  // 處理滑鼠/手指移動
  const handleMouseMove = (e) => {
    // 取得容器的尺寸，而非圖片原始尺寸
    const { top, left, width, height } = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - left;
    const y = e.clientY - top;
    setImgSize({ width, height });
    setCursorPosition({ x, y });
    setShowMagnifier(true);
  };

  return (
    <div 
      // 🔥 加上 w-full h-full 確保填滿外層的 aspect-video 容器
      className="relative w-full h-full overflow-hidden rounded-xl shadow-lg cursor-crosshair group bg-slate-100"
      onMouseEnter={() => setShowMagnifier(true)}
      onMouseLeave={() => setShowMagnifier(false)}
      onMouseMove={handleMouseMove}
      onClick={onClick} 
    >
      {/* 原始圖片 */}
      <img 
        src={src} 
        alt={alt} 
        // 🔥 改回 object-contain (這一行最關鍵！讓圖片縮放比例跟題目設計時一致)
        className="w-full h-full object-contain pointer-events-none" 
      />

      {/* 顯示已經標記的點 (綠色/紅色圓點) */}
      {markers.map((mark, index) => (
        <div
          key={index}
          className="absolute w-4 h-4 bg-green-500 rounded-full border-2 border-white transform -translate-x-1/2 -translate-y-1/2 shadow-sm z-20"
          style={{ left: `${mark.x}%`, top: `${mark.y}%` }}
        />
      ))}

      {/* 放大鏡鏡頭 */}
      {showMagnifier && (
        <div 
          className="absolute pointer-events-none border-2 border-white rounded-full shadow-2xl z-50 bg-no-repeat bg-slate-50"
          style={{
            height: "150px", 
            width: "150px",
            top: `${cursorPosition.y - 75}px`, 
            left: `${cursorPosition.x - 75}px`,
            // 這裡使用背景圖模擬放大，因為是 object-contain，放大鏡邊緣可能會看到留白是正常的
            backgroundImage: `url('${src}')`,
            backgroundSize: `${imgSize.width * 2}px ${imgSize.height * 2}px`, // 稍微調整放大倍率為 2 倍
            backgroundPosition: `${-cursorPosition.x * 2 + 75}px ${-cursorPosition.y * 2 + 75}px`
          }}
        />
      )}
    </div>
  );
};

export default ZoomableImage;