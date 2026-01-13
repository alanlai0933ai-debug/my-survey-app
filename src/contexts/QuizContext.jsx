import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  doc, onSnapshot, collection, query, orderBy, setDoc, addDoc, deleteDoc, serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import { useNavigate } from 'react-router-dom';
// ✅ 1. 引入 Toast 工具
import toast from 'react-hot-toast';

const QuizContext = createContext();

const appId = typeof __app_id !== 'undefined' ? __app_id : 'my-survey-app';
const QUIZ_ID = 'global_shared_quiz_v2';

export function QuizProvider({ children }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [quizData, setQuizData] = useState({ title: "載入中...", questions: [] });
  const [responses, setResponses] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [myResult, setMyResult] = useState(null);

  // 1. 監聽問卷題目 (Public)
  useEffect(() => {
    const quizRef = doc(db, 'artifacts', appId, 'public', 'data', 'quizzes', QUIZ_ID);
    return onSnapshot(quizRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setQuizData({ ...data, questions: data.questions || [] });
      } else {
        setQuizData({ title: "新問卷 (v2)", questions: [] });
      }
    });
  }, []);

  // 2. 監聽回應 (Private - 只有登入或有 User 才聽)
  useEffect(() => {
    if (!user) { setResponses([]); return; }
    const ref = collection(db, 'artifacts', appId, 'public', 'data', `responses_${QUIZ_ID}`);
    const q = query(ref, orderBy('submittedAt', 'desc'));
    return onSnapshot(q, (snap) => {
      const data = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() }));
      setResponses(data);
    });
  }, [user]);

  // Actions (全面升級為 Toast 通知)
  
  // ✅ 發布/儲存問卷
  const saveQuiz = async (data) => {
    if(isSubmitting) return;
    setIsSubmitting(true);
    
    // 使用 toast.promise 自動處理 Loading / Success / Error 三種狀態
    try {
      await toast.promise(
        setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'quizzes', QUIZ_ID), data),
        {
          loading: '正在儲存問卷設定...',
          success: '🎉 問卷已成功發布！',
          error: (err) => `儲存失敗: ${err.message}`,
        }
      );
      navigate('/'); 
    } catch (e) {
      console.error(e); // 錯誤已經由 toast 顯示，這裡只需 log
    } finally {
      setIsSubmitting(false);
    }
  };

  // ✅ 提交問卷答案
  const submitResponse = async (ans, nickname, inputEmail, statsData, totalTime) => {
    if(isSubmitting) return;
    setIsSubmitting(true);

    try {
      await toast.promise(
        addDoc(collection(db, 'artifacts', appId, 'public', 'data', `responses_${QUIZ_ID}`), {
          answers: ans, submittedAt: serverTimestamp(), userId: user?.uid || 'anonymous', 
          userEmail: user?.email || 'anonymous', inputEmail, nickname, stats: statsData, totalTime
        }),
        {
          loading: '正在提交成績...',
          success: '🚀 挑戰完成！前往結果頁...',
          error: (err) => `提交失敗: ${err.message}`,
        }
      );
      
      setMyResult({ answers: ans, stats: statsData, totalTime: totalTime });
      navigate('/result'); 
    } catch (e) { 
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ✅ 刪除單筆回應
  const deleteResponse = async (responseId) => {
    try {
      await toast.promise(
        deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', `responses_${QUIZ_ID}`, responseId)),
        {
          loading: '正在刪除紀錄...',
          success: '🗑️ 紀錄已刪除',
          error: (err) => `刪除失敗: ${err.message}`,
        }
      );
    } catch (error) {
      console.error(error);
    }
  };

  const value = {
    quizData,
    responses,
    isSubmitting,
    myResult,
    saveQuiz,
    submitResponse,
    deleteResponse
  };

  return (
    <QuizContext.Provider value={value}>
      {children}
    </QuizContext.Provider>
  );
}

export function useQuiz() {
  return useContext(QuizContext);
}