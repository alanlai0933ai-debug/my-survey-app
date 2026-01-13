import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// --- 1. Firebase 配置 ---
let firebaseConfig;
try {
  if (typeof __firebase_config !== 'undefined') {
    firebaseConfig = JSON.parse(__firebase_config);
  } else {
    throw new Error('Local config');
  }
} catch (e) {
  firebaseConfig = {
    apiKey: "AIzaSyAKCRTN4BWMqpL2e6svx1FLN5RiJIdYRtk",
    authDomain: "icc-test-4286c.firebaseapp.com",
    projectId: "icc-test-4286c",
    storageBucket: "icc-test-4286c.firebasestorage.app",
    messagingSenderId: "353118805586",
    appId: "1:353118805586:web:dd46d68792746c4b33c98b",
    measurementId: "G-J3L4C7B70P"
  };
}

const app = initializeApp(firebaseConfig);

// 🔥 修正重點：每一行前面都加了 "export"
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// ⚠️ 注意：剩下的 QUIZ_ID, COLORS... 那些請留在 App.jsx 裡，不要放這裡！