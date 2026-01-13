import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  doc, onSnapshot, collection, query, orderBy, setDoc, addDoc, deleteDoc, serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext'; // 👈 我們可以直接在這裡用 Auth！
import { useNavigate } from 'react-router-dom';

const QuizContext = createContext();

const appId = typeof __app_id !== 'undefined' ? __app_id : 'my-survey-app';
const QUIZ_ID = 'global_shared_quiz_v2';

export function QuizProvider({ children }) {
  const { user } = useAuth(); // 取得使用者資訊
  const navigate = useNavigate(); // 取得跳轉功能
  
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

  // Actions (原本在 App.jsx 的功能)
  const saveQuiz = async (data) => {
    if(isSubmitting) return;
    setIsSubmitting(true);
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'quizzes', QUIZ_ID), data);
      alert("問卷已發布！");
      navigate('/'); 
    } catch (e) { 
      alert("儲存失敗: " + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitResponse = async (ans, nickname, inputEmail, statsData, totalTime) => {
    if(isSubmitting) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', `responses_${QUIZ_ID}`), {
        answers: ans, submittedAt: serverTimestamp(), userId: user?.uid || 'anonymous', 
        userEmail: user?.email || 'anonymous', inputEmail, nickname, stats: statsData, totalTime
      });
      setMyResult({ answers: ans, stats: statsData, totalTime: totalTime });
      navigate('/result'); 
    } catch (e) { 
      alert("提交失敗：" + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteResponse = async (responseId) => {
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', `responses_${QUIZ_ID}`, responseId));
    } catch (error) {
      alert("刪除失敗：" + error.message);
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