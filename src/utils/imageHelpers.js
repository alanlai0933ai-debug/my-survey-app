// src/utils/imageHelpers.js

import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
// 記得引入我們第一步做好的 firebase 設定檔
import { storage } from '../firebase'; 

// --- 上傳圖片到 Firebase Storage ---
export const uploadImageToStorage = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        
        // 設定最大寬度 1280 (HD 畫質)
        const MAX_WIDTH = 1280; 
        
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(async (blob) => {
          if (!blob) {
            reject(new Error("圖片處理失敗"));
            return;
          }
          try {
            const fileName = `images/${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
            const storageRef = ref(storage, fileName);
            
            await uploadBytes(storageRef, blob);
            const downloadURL = await getDownloadURL(storageRef);
            resolve(downloadURL);
          } catch (error) {
            console.error("上傳失敗:", error);
            reject(error);
          }
        }, 'image/jpeg', 0.9);
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
};

// --- 刪除 Storage 上的舊圖片 ---
export const deleteImageFromStorage = async (imageUrl) => {
  if (!imageUrl) return;
  try {
    const fileRef = ref(storage, imageUrl);
    await deleteObject(fileRef);
    console.log("🗑️ 舊圖片已從雲端刪除");
  } catch (error) {
    console.log("刪除舊圖略過:", error.code);
  }
};