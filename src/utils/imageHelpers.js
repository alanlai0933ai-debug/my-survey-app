import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
// 請確認這裡的路徑是否正確 (通常是 ../firebase 或 ../../firebase)
import { storage } from '../firebase'; 

// --- 上傳圖片到 Firebase Storage (含智慧壓縮) ---
export const uploadImageToStorage = (file) => {
  return new Promise((resolve, reject) => {
    // 1. 如果不是圖片，直接拒絕
    if (!file.type.startsWith('image/')) {
        reject(new Error("請上傳圖片檔案"));
        return;
    }

    // 2. 判斷檔案類型：如果是 PNG，我們就不強制轉 JPG，以免透明背景變黑
    //    但如果是 JPG/HEIC 等照片，我們就壓縮以節省空間
    const isPNG = file.type === 'image/png';
    const outputType = isPNG ? 'image/png' : 'image/jpeg';
    const quality = 0.8; // 圖片品質 (0~1)

    const reader = new FileReader();
    reader.readAsDataURL(file);
    
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;
      
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        
        // 設定最大寬度 (HD 畫質足夠了)
        const MAX_WIDTH = 1280; 
        
        let width = img.width;
        let height = img.height;

        // 如果圖片太大，等比例縮小
        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // 3. 輸出壓縮後的檔案
        canvas.toBlob(async (blob) => {
          if (!blob) {
            reject(new Error("圖片處理失敗"));
            return;
          }
          try {
            // 建立唯一檔名
            const extension = isPNG ? 'png' : 'jpg';
            const fileName = `images/${Date.now()}_${Math.random().toString(36).substring(7)}.${extension}`;
            const storageRef = ref(storage, fileName);
            
            // 上傳
            await uploadBytes(storageRef, blob);
            // 取得網址
            const downloadURL = await getDownloadURL(storageRef);
            resolve(downloadURL);
          } catch (error) {
            console.error("上傳失敗:", error);
            reject(error);
          }
        }, outputType, quality);
      };
      
      img.onerror = (err) => reject(new Error("圖片載入失敗"));
    };
    
    reader.onerror = (err) => reject(new Error("檔案讀取失敗"));
  });
};

// --- 刪除 Storage 上的舊圖片 ---
export const deleteImageFromStorage = async (imageUrl) => {
  if (!imageUrl) return;
  
  // 簡單防呆：確保是要刪除我們自己 Firebase Storage 的圖片
  // 避免刪除到像是 "https://via.placeholder.com..." 這種外部圖片
  if (!imageUrl.includes('firebasestorage')) return;

  try {
    // 從 URL 解析出 ref (Firebase SDK 有時可以直接吃 URL，但用 ref 比較保險)
    const fileRef = ref(storage, imageUrl);
    await deleteObject(fileRef);
    console.log("🗑️ 舊圖片已從雲端刪除");
  } catch (error) {
    // 如果圖片本來就不存在，我們忽略錯誤 (不然介面會報錯很煩)
    console.log("刪除舊圖略過 (可能已不存在):", error.code);
  }
};