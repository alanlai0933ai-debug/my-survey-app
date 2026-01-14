/**
 * functions/index.js
 * 這是您的 AI 雲端大腦 (修復版)
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// 2. 定義我們要使用哪個鑰匙
const geminiApiKey = defineSecret("GEMINI_API_KEY");

// 3. 設定雲端函數 (將兩個部分合併，並修正語法)
exports.generateQuizFeedback = onCall({ secrets: [geminiApiKey], cors: true }, async (request) => {
    
    // 4. 在函數內部，取出真正的 Key 並初始化 AI
    const API_KEY = geminiApiKey.value();
    const genAI = new GoogleGenerativeAI(API_KEY);

    // ---------------- 以下是您原本的邏輯內容 ----------------

    // 1. 接收前端傳來的資料
    const { questionText, userAnswer, correctOption, questionType } = request.data;

    // 簡單防呆
    if (!questionText) {
        throw new HttpsError("invalid-argument", "題目內容不能為空");
    }

    try {
        // 2. 設定 AI 模型 
        // (建議：如果遇到 429 錯誤，請改回 "gemini-1.5-flash-8b")
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        // 3. 設計 Prompt (提詞)
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
        // 如果 AI 掛了，回傳一個通用訊息
        return { feedback: "系統忙碌中，但別氣餒，正確答案是：" + correctOption + "！加油！" };
    }
});