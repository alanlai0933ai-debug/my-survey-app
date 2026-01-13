/* export_project.js - 用於將專案程式碼合併為一個檔案給 AI 檢視 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 設定要掃描的根目錄 (這裡是 src)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_DIR = path.join(__dirname, 'src');
const OUTPUT_FILE = 'project_context.txt';

// 設定要忽略的檔案或資料夾
const IGNORE_PATTERNS = [
    'node_modules', '.git', 'dist', '.DS_Store', 
    '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico' // 忽略圖片
];

// 遞迴讀取檔案
function readFilesRecursively(dir, fileList = []) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        // 檢查是否在忽略清單中
        if (IGNORE_PATTERNS.some(pattern => filePath.includes(pattern))) {
            return;
        }

        if (stat.isDirectory()) {
            readFilesRecursively(filePath, fileList);
        } else {
            // 只讀取文字檔 (js, jsx, css, json)
            if (/\.(js|jsx|css|json|html)$/.test(file)) {
                fileList.push(filePath);
            }
        }
    });

    return fileList;
}

// 執行主程式
try {
    console.log('📦 開始掃描 src 資料夾...');
    const allFiles = readFilesRecursively(SRC_DIR);
    
    let content = `專案結構掃描時間: ${new Date().toLocaleString()}\n`;
    content += `總檔案數: ${allFiles.length}\n\n`;

    allFiles.forEach(filePath => {
        const relativePath = path.relative(__dirname, filePath);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        
        content += `================================================================\n`;
        content += `【檔案路徑】: ${relativePath}\n`;
        content += `================================================================\n`;
        content += `${fileContent}\n\n`;
    });

    fs.writeFileSync(OUTPUT_FILE, content);
    console.log(`✅ 成功！所有程式碼已輸出至: ${OUTPUT_FILE}`);
    console.log(`👉 請打開 ${OUTPUT_FILE}，全選複製並貼給 AI。`);

} catch (error) {
    console.error('❌ 發生錯誤:', error);
}