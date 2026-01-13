// src/utils/mathHelpers.js

// --- 判斷座標是否在多邊形內 (Ray Casting Algorithm) ---
export const isPointInPolygon = (point, vs) => {
  if (!vs || vs.length === 0) return false;
  let x = point.x, y = point.y;
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    let xi = vs[i].x, yi = vs[i].y;
    let xj = vs[j].x, yj = vs[j].y;
    let intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};

// --- 格式化時間 (秒 -> MM:SS) ---
export const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// --- 匯出 CSV (這個比較長，我們也順便放在這裡，或者您可以另外建 exportHelpers.js) ---
export const exportToCSV = (quizData, responses) => {
  const headers = ['提交時間', '暱稱', 'Email', '總耗時(秒)', '總得分'];
  quizData.questions.forEach((q, idx) => headers.push(`Q${idx + 1}: ${q.text}`));
  
  const rows = responses.map(r => {
    const date = r.submittedAt ? new Date(r.submittedAt.seconds * 1000).toLocaleString('zh-TW') : 'N/A';
    const totalTime = r.totalTime ? Math.round(r.totalTime) : 'N/A';
    
    let totalScore = 0;
    const ansCols = quizData.questions.map(q => {
      const ans = r.answers[q.id];
      const points = Number(q.points) || 0;
      let score = 0;
      let display = "";

      if (q.type === 'hotspot') {
        const userPins = ans || [];
        const totalTargets = q.targets?.length || 0;
        const hits = (q.targets || []).filter(t => userPins.some(pin => isPointInPolygon(pin, t.points))).length;
        const accuracy = totalTargets > 0 ? Math.round((hits / totalTargets) * 100) : 0;
        score = totalTargets > 0 ? Math.round((hits / totalTargets) * points) : 0;
        display = `正確率 ${accuracy}% (${hits}/${totalTargets})`;
      } else if (q.type === 'sorting') {
        const userMap = ans || {};
        let correctCount = 0;
        let errors = [];
        q.items.forEach(item => {
           const userCat = userMap[item.id];
           if (userCat === item.correctCategory) correctCount++;
           else if (userCat) errors.push(`${item.text}(錯)`);
        });
        const totalItems = q.items.length || 1;
        score = Math.round((correctCount / totalItems) * points);
        display = errors.length > 0 ? `錯: ${errors.join('; ')}` : `全對`;
      } else if (q.type === 'choice') {
        let isCorrect = false;
        if (q.isMulti) {
           const correctOptions = q.options.filter(o => o.isCorrect).map(o => o.label);
           const userSelected = Array.isArray(ans) ? ans : [];
           isCorrect = correctOptions.length === userSelected.length && correctOptions.every(v => userSelected.includes(v));
        } else {
           const correctOption = q.options.find(o => o.isCorrect)?.label;
           isCorrect = ans === correctOption;
        }
        score = isCorrect ? points : 0;
        display = isCorrect ? '正確' : '錯誤';
      }
      totalScore += score;
      return `"${display.replace(/"/g, '""')}"`;
    });

    const rowData = [date, r.nickname || 'Guest', r.inputEmail || r.userEmail || 'Anonymous', totalTime, totalScore, ...ansCols];
    return rowData.join(',');
  });
  
  const csvContent = '\uFEFF' + headers.join(',') + '\n' + rows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `問卷結果_${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};