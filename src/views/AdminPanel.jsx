// src/views/AdminPanel.jsx
import React, { useState } from 'react';
import { 
  Edit3, Save, PenTool, Database, Trash2, Plus, 
  ImageIcon, Loader2, CheckSquare, Target, LayoutGrid, 
  ShieldAlert, CheckCircle 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ✅ 引入我們拆分出去的工具
import { uploadImageToStorage, deleteImageFromStorage } from '../utils/imageHelpers';
import HotspotAdminEditor from '../components/HotspotAdminEditor';

function AdminPanel({ initialData, onSave, isSubmitting, responses, onDeleteResponse }) {
  const [tab, setTab] = useState('design');
  const [title, setTitle] = useState(initialData.title || "");
  const [questions, setQuestions] = useState(initialData.questions || []);
  const [confirmId, setConfirmId] = useState(null);
  const [uploading, setUploading] = useState(false);

  const addQuestion = (type) => {
    const base = { id: Date.now().toString(), text: "新題目", type, points: 10 };
    if (type === 'choice') {
      setQuestions([...questions, { 
        ...base, 
        text: "選擇題", 
        isMulti: false,
        options: [{ label: "選項 A", image: "", isCorrect: false }, { label: "選項 B", image: "", isCorrect: false }]
      }]);
    } else if (type === 'hotspot') {
      const defaultPoints = [{ x: 30, y: 30 }, { x: 70, y: 30 }, { x: 70, y: 70 }, { x: 30, y: 70 }];
      setQuestions([...questions, { ...base, text: "請框出畫面中的...", image: "", targets: [{ id: 't1', points: defaultPoints }] }]);
    } else if (type === 'sorting') {
      setQuestions([...questions, { 
        ...base, 
        text: "請分類以下項目", 
        items: [{ id: 'i1', text: "項目 1", image: "", correctCategory: "" }, { id: 'i2', text: "項目 2", image: "", correctCategory: "" }], 
        categories: ["分類 A", "分類 B"] 
      }]);
    }
  };

  const updateQuestion = (idx, field, val) => {
    const next = [...questions];
    if (field === 'targets') next[idx].targets = val;
    else next[idx][field] = val;
    setQuestions(next);
  };

  const handleImageUpload = async (qIdx, file, field, optIdx = null) => {
    if (!file) return;
    setUploading(true); 
    
    let oldImageUrl = "";
    if (optIdx !== null) {
       oldImageUrl = questions[qIdx].options[optIdx].image;
    } else {
       oldImageUrl = field === 'image' ? questions[qIdx].image : questions[qIdx][field];
    }

    try {
      const newImageUrl = await uploadImageToStorage(file);
      const next = [...questions];
      if (optIdx !== null) {
        next[qIdx].options[optIdx].image = newImageUrl;
      } else {
        if(field === 'image') next[qIdx].image = newImageUrl;
        else next[qIdx][field] = newImageUrl;
      }
      setQuestions(next);

      if (oldImageUrl) {
        await deleteImageFromStorage(oldImageUrl);
      }

    } catch (e) { 
      alert("圖片上傳失敗：" + e.message);
    } finally {
      setUploading(false); 
    }
  };

  const handleOptionUpdate = (qIdx, optIdx, field, val) => {
    const next = [...questions];
    if (typeof next[qIdx].options[optIdx] === 'string') {
        next[qIdx].options[optIdx] = { label: val, image: "", isCorrect: false };
    } else {
        next[qIdx].options[optIdx][field] = val;
    }
    
    if (field === 'isCorrect' && val === true && !next[qIdx].isMulti) {
        next[qIdx].options.forEach((o, i) => {
            if (i !== optIdx) o.isCorrect = false;
        });
    }
    setQuestions(next);
  };

  const handleItemUpdate = (qIdx, iIdx, field, val) => {
    const next = [...questions];
    next[qIdx].items[iIdx][field] = val;
    setQuestions(next);
  };

  const handleItemImageUpload = async (qIdx, itemIdx, file) => {
    if (!file) return;
    setUploading(true);
    try {
      const imageUrl = await uploadImageToStorage(file);
      const next = [...questions];
      next[qIdx].items[itemIdx].image = imageUrl;
      setQuestions(next);
    } catch (e) { 
        alert("圖片上傳失敗：" + e.message);
    } finally {
        setUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100 min-h-[600px] flex flex-col relative">
      {/* 頂部導航與頁籤 */}
      <div className="bg-indigo-600 p-6">
        <div className="flex justify-between items-center text-white mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2"><Edit3 size={24}/> 後台管理系統</h2>
          {tab === 'design' && (
            <button 
              onClick={() => onSave({ title, questions })} 
              disabled={isSubmitting || uploading}
              className="bg-white/20 backdrop-blur-md text-white border border-white/30 px-6 py-2 rounded-xl text-sm font-bold hover:bg-white/30 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting || uploading ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>} 
              {uploading ? "圖片上傳中..." : "儲存發布"}
            </button>
          )}
        </div>
        
        <div className="flex gap-2">
          <button 
             onClick={() => setTab('design')}
             className={`px-6 py-3 rounded-t-xl font-bold text-sm transition-colors ${tab === 'design' ? 'bg-white text-indigo-600' : 'bg-indigo-700/50 text-indigo-100 hover:bg-indigo-700'}`}
          >
             <PenTool size={16} className="inline mr-2"/> 問題設計
          </button>
          <button 
             onClick={() => setTab('data')}
             className={`px-6 py-3 rounded-t-xl font-bold text-sm transition-colors ${tab === 'data' ? 'bg-white text-indigo-600' : 'bg-indigo-700/50 text-indigo-100 hover:bg-indigo-700'}`}
          >
             <Database size={16} className="inline mr-2"/> 填報資料管理
          </button>
        </div>
      </div>
      
      <div className="p-8 space-y-8 flex-1 bg-slate-50">
        {/* 頁籤內容：問題設計 */}
        {tab === 'design' && (
          <>
            <input className="w-full text-3xl font-bold border-b-2 border-slate-200 p-2 outline-none focus:border-indigo-500 bg-transparent transition-colors" value={title} onChange={e => setTitle(e.target.value)} placeholder="請輸入問卷標題..." />
            
            <div className="space-y-6">
              {questions.map((q, qIdx) => (
                <div key={q.id} className="p-6 bg-white rounded-2xl border border-slate-200 relative space-y-4 hover:shadow-md transition-shadow">
                  <div className="absolute top-4 right-4 flex gap-2 z-50">
                      <span className="text-xs font-bold uppercase bg-slate-100 text-slate-500 px-2 py-1 rounded">{q.type}</span>
                      <button className="text-slate-300 hover:text-red-500 transition-colors p-1 bg-white rounded-full shadow-sm" onClick={() => setQuestions(questions.filter((_, i) => i !== qIdx))}><Trash2 size={20}/></button>
                  </div>
                  
                  <div className="flex flex-col gap-3">
                    <div className="flex gap-4">
                      <input className="flex-1 p-4 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-indigo-100 outline-none" value={q.text} onChange={e => updateQuestion(qIdx, 'text', e.target.value)} placeholder="題目描述..." />
                      <div className="w-24">
                         <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">配分</label>
                         <input type="number" className="w-full p-2 border rounded-lg font-bold text-center" value={q.points || 0} onChange={e => updateQuestion(qIdx, 'points', Number(e.target.value))} />
                      </div>
                    </div>
                    <input 
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-600 focus:ring-2 focus:ring-indigo-100 outline-none" 
                      value={q.note || ''} 
                      onChange={e => updateQuestion(qIdx, 'note', e.target.value)} 
                      placeholder="在此輸入補充說明文字 (例如：請依照大小順序排列)..." 
                    />
                  </div>

                  {q.type === 'choice' && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                          <input type="checkbox" id={`multi-${q.id}`} checked={q.isMulti || false} onChange={e => updateQuestion(qIdx, 'isMulti', e.target.checked)} className="w-4 h-4 accent-indigo-600"/>
                          <label htmlFor={`multi-${q.id}`} className="text-sm font-bold text-slate-600 cursor-pointer">啟用複選</label>
                        </div>
                        <div className="space-y-2">
                          {q.options.map((opt, oIdx) => {
                             const optLabel = typeof opt === 'string' ? opt : opt.label;
                             const optImage = typeof opt === 'string' ? "" : opt.image;
                             const isCorrect = typeof opt === 'string' ? false : opt.isCorrect;
                             return (
                               <div key={oIdx} className={`flex items-start gap-2 border p-2 rounded-lg ${isCorrect ? 'bg-green-50 border-green-200' : 'bg-slate-50'}`}>
                                 <div className="mt-3">
                                   {/* 🟢 使用優化過的打勾按鈕 */}
                                   <div 
                                      onClick={() => handleOptionUpdate(qIdx, oIdx, 'isCorrect', !isCorrect)}
                                      className={`w-6 h-6 cursor-pointer flex items-center justify-center border-2 transition-all ${q.isMulti ? 'rounded-md' : 'rounded-full'} ${isCorrect ? 'bg-green-500 border-green-500' : 'bg-white border-slate-300 hover:border-green-400'}`}
                                      title={isCorrect ? "點擊取消正確答案" : "設為正確答案"}
                                   >
                                      {isCorrect && <CheckCircle size={14} className="text-white" />}
                                   </div>
                                 </div>
                                 <div className="w-12 h-12 bg-slate-200 rounded flex-shrink-0 relative overflow-hidden group/img cursor-pointer hover:opacity-80">
                                      {optImage ? <img src={optImage} className="w-full h-full object-cover" alt="opt" /> : <ImageIcon size={20} className="text-slate-400 m-auto mt-3"/>}
                                      <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => handleImageUpload(qIdx, e.target.files[0], 'options', oIdx)} />
                                 </div>
                                 <div className="flex-1">
                                      <input className="w-full p-2 border rounded text-sm focus:border-indigo-500 outline-none" value={optLabel} placeholder={`選項 ${oIdx + 1}`} onChange={(e) => handleOptionUpdate(qIdx, oIdx, 'label', e.target.value)} />
                                 </div>
                                 <button onClick={() => {
                                      const next = [...questions]; next[qIdx].options.splice(oIdx, 1); setQuestions(next);
                                 }} className="text-slate-300 hover:text-red-500 mt-2"><Trash2 size={16}/></button>
                               </div>
                             );
                          })}
                          <button onClick={() => {
                             const next = [...questions]; next[qIdx].options.push({ label: `選項 ${next[qIdx].options.length + 1}`, image: "", isCorrect: false }); setQuestions(next);
                          }} className="text-sm text-indigo-500 font-bold hover:underline flex items-center gap-1 mt-2"><Plus size={14}/> 新增選項</button>
                        </div>
                    </div>
                  )}

                  {q.type === 'hotspot' && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-4 bg-indigo-50 p-3 rounded-xl border border-indigo-100">
                          <div className="flex items-center gap-2">
                              <label className="text-sm font-bold text-slate-700">限制點擊數量：</label>
                              <input   
                                type="number" min="1" max="10"
                                className="w-20 p-2 border border-indigo-200 rounded-lg text-center font-bold text-indigo-600 outline-none focus:ring-2 focus:ring-indigo-500"
                                value={q.maxClicks || 1}
                                onChange={e => updateQuestion(qIdx, 'maxClicks', Number(e.target.value))}
                              />
                          </div>
                          <span className="text-xs text-slate-400">(例如：題目若問「找出 3 個垃圾」，請設為 3)</span>
                        </div>
                      <div className="relative aspect-video bg-slate-100 rounded-xl overflow-hidden group border-2 border-dashed border-slate-300">
                        {q.image ? (
                            <HotspotAdminEditor image={q.image} targets={q.targets} onUpdate={(newTargets) => updateQuestion(qIdx, 'targets', newTargets)} />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400"><Target size={40} className="mb-2"/>上傳圖片以開始</div>
                        )}
                        <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => handleImageUpload(qIdx, e.target.files[0], 'image')} disabled={!!q.image} />
                        {q.image && <button onClick={async (e) => { 
                          await deleteImageFromStorage(q.image);
                          updateQuestion(qIdx, 'image', ''); 
                        }} className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded hover:bg-red-500 z-10"><Trash2 size={14}/></button>}
                      </div>
                      <div className="flex gap-4 items-center">
                        <button onClick={() => {
                            const defaultPoints = [{ x: 30, y: 30 }, { x: 70, y: 30 }, { x: 70, y: 70 }, { x: 30, y: 70 }];
                            const newTargets = [...(q.targets || []), { id: Date.now().toString(), points: defaultPoints }];
                            updateQuestion(qIdx, 'targets', newTargets);
                        }} className="text-xs bg-indigo-100 text-indigo-600 px-3 py-1 rounded font-bold hover:bg-indigo-200">+ 新增判定區</button>
                        <span className="text-xs text-slate-400">目前有 {q.targets?.length || 0} 個判定區</span>
                      </div>
                    </div>
                  )}

                  {q.type === 'sorting' && (
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <label className="text-xs font-bold text-slate-400 uppercase">項目 (Items)</label>
                        {q.items.map((item, iIdx) => (
                          <div key={item.id || iIdx} className="flex flex-col gap-2 border p-2 rounded-lg bg-slate-50">
                            <div className="flex gap-2 items-start">
                              <div className="w-10 h-10 bg-slate-200 rounded flex-shrink-0 relative overflow-hidden group/img">
                                 {item.image ? <img src={item.image} className="w-full h-full object-cover" alt="item" /> : <ImageIcon size={16} className="text-slate-400 m-auto mt-2"/>}
                                 <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => handleItemImageUpload(qIdx, iIdx, e.target.files[0])} />
                              </div>
                              <input className="flex-1 p-1 border rounded text-xs" value={item.text} placeholder="項目名稱" onChange={e => handleItemUpdate(qIdx, iIdx, 'text', e.target.value)} />
                              <button onClick={() => {
                                  const next = [...questions]; next[qIdx].items.splice(iIdx, 1); setQuestions(next);
                              }} className="text-slate-300 hover:text-red-500"><Trash2 size={16}/></button>
                            </div>
                            <select 
                              className={`w-full p-1 border rounded text-xs ${!item.correctCategory ? 'border-red-300 bg-red-50' : 'bg-green-50 border-green-200'}`}
                              value={item.correctCategory || ""}
                              onChange={(e) => handleItemUpdate(qIdx, iIdx, 'correctCategory', e.target.value)}
                            >
                              <option value="">設定正確分類...</option>
                              {q.categories.map((cat, idx) => <option key={idx} value={cat}>{cat}</option>)}
                            </select>
                          </div>
                        ))}
                        <button onClick={() => {
                            const next = [...questions]; next[qIdx].items.push({ id: Date.now().toString(), text: "新項目", image: "", correctCategory: "" }); 
                            setQuestions(next);
                        }} className="text-xs text-indigo-500 font-bold">+ 加項目</button>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">分類籃 (Categories)</label>
                          {q.categories.map((cat, cIdx) => (
                          <div key={cIdx} className="flex gap-2">
                            <input className="w-full p-2 border rounded text-sm" value={cat} onChange={e => {
                               const next = [...questions]; next[qIdx].categories[cIdx] = e.target.value; setQuestions(next);
                            }} />
                            <button onClick={() => {
                               const next = [...questions]; next[qIdx].categories.splice(cIdx, 1); setQuestions(next);
                            }} className="text-slate-300 hover:text-red-500"><Trash2 size={16}/></button>
                          </div>
                        ))}
                        <button onClick={() => {
                            const next = [...questions]; next[qIdx].categories.push("新分類"); setQuestions(next);
                        }} className="text-xs text-indigo-500 font-bold">+ 加分類</button>
                      </div>
                    </div>
                  )}

                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-200 mt-8">
               <button onClick={() => addQuestion('choice')} className="py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 font-bold hover:bg-indigo-50 hover:border-indigo-300 transition-all flex items-center justify-center gap-2"><CheckSquare size={18}/> 選擇題</button>
               <button onClick={() => addQuestion('hotspot')} className="py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 font-bold hover:bg-indigo-50 hover:border-indigo-300 transition-all flex items-center justify-center gap-2"><Target size={18}/> 圖像熱點</button>
               <button onClick={() => addQuestion('sorting')} className="py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 font-bold hover:bg-indigo-50 hover:border-indigo-300 transition-all flex items-center justify-center gap-2"><LayoutGrid size={18}/> 拖曳分類</button>
            </div>
          </>
        )}

        {/* 頁籤內容：填報資料管理 */}
        {tab === 'data' && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="p-4 font-bold text-slate-600 text-sm">時間</th>
                    <th className="p-4 font-bold text-slate-600 text-sm">暱稱</th>
                    <th className="p-4 font-bold text-slate-600 text-sm">Email</th>
                    <th className="p-4 font-bold text-slate-600 text-sm text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {responses.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 text-sm text-slate-600">{new Date(r.submittedAt?.seconds * 1000).toLocaleString('zh-TW')}</td>
                      <td className="p-4 text-sm font-bold text-slate-800">{r.nickname || 'Guest'}</td>
                      <td className="p-4 text-sm text-slate-500">{r.inputEmail || r.userEmail || '-'}</td>
                      <td className="p-4 text-right">
                          <button 
                            type="button" 
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmId(r.id); 
                            }}
                            className="bg-red-50 text-red-500 hover:text-red-700 hover:bg-red-100 p-2 rounded-lg transition-colors cursor-pointer relative z-10"
                            title="刪除紀錄"
                          >
                            <Trash2 size={16}/>
                          </button>
                      </td>
                    </tr>
                  ))}
                  {responses.length === 0 && (
                    <tr><td colSpan={5} className="p-8 text-center text-slate-400">目前尚無填報資料</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 確認 Modal */}
      <AnimatePresence>
        {confirmId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
             <motion.div 
               initial={{ scale: 0.9, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               exit={{ scale: 0.9, opacity: 0 }}
               className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl"
             >
                <div className="flex items-center gap-3 text-red-600 mb-4">
                   <ShieldAlert size={28}/>
                   <h3 className="text-xl font-bold">確認刪除紀錄？</h3>
                </div>
                <p className="text-slate-500 mb-6">此動作將永久移除該數據，且無法復原。</p>
                <div className="flex gap-3">
                   <button onClick={() => setConfirmId(null)} className="flex-1 py-2 font-bold text-slate-500 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors">取消</button>
                   <button 
                      onClick={() => {
                         onDeleteResponse(confirmId);
                         setConfirmId(null);
                      }}
                      className="flex-1 py-2 font-bold text-white bg-red-500 rounded-xl hover:bg-red-600 shadow-lg shadow-red-200 transition-colors"
                   >
                      確認刪除
                   </button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default AdminPanel;