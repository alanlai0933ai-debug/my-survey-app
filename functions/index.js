/**
 * functions/index.js
 * 這是您的 AI 雲端大腦
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// 🔥 這裡填入您的 Gemini API Key
// (正式上線建議用 defineSecret，但測試階段我們先直接填)
const API_KEY = "AIzaSyCPoBI2M7QR9-5pUgU0UUztDjaJoUq0F4Y"; 

const genAI = new GoogleGenerativeAI(API_KEY);

exports.generateQuizFeedback = onCall({ cors: true }, async (request) => {
  // 1. 接收前端傳來的資料
  const { questionText, userAnswer, correctOption, questionType } = request.data;

  // 簡單防呆
  if (!questionText) {
    throw new HttpsError("invalid-argument", "題目內容不能為空");
  }

  try {
    // 2. 設定 AI 模型 (Gemini 1.5 Flash 速度快又便宜)
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // 3. 設計 Prompt (提詞) - 這是 AI 的靈魂
    const prompt = `
      你是一位親切、幽默且專業的環保教育志工。
      現在有一位使用者在回答關於「海洋廢棄物監測 (ICC)」的問題時答錯了。
      
      【題目資訊】
      - 題目：${questionText}
      - 題型：${questionType}
      - 使用者的錯誤答案：${userAnswer} (如果是空值代表未作答)
      - 正確答案：${correctOption}

      【你的任務】
      請用一段話(約50-80字)告訴使用者為什麼錯，並給予正確的觀念。
      語氣要溫柔鼓勵，不要說教。可以適當使用emoji。
      如果使用者的答案明顯是亂選的，可以幽默地提醒他。
      
      請直接輸出解析內容，不要有其他開場白。
    `;

    // 4. 發送給 AI
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const feedback = response.text();

    // 5. 回傳給前端
    return { feedback: feedback.trim() };

  } catch (error) {
    console.error("AI Error:", error);
    // 如果 AI 掛了，回傳一個通用訊息，不要讓程式崩潰
    return { feedback: "系統忙碌中，但別氣餒，正確答案是：" + correctOption + "！加油！" };
  }
});