import React, { useState, useEffect, useRef } from 'react';
import { Transaction, Category, TransactionType } from '../types';
import { DynamicIcon } from './Icons';
import { parseWeChatText, parseScreenshot, ParsedTransaction } from '../services/geminiService';
import { Loader2, Sparkles, ClipboardPaste, Plus, Trash2, CheckCircle2, Image as ImageIcon, ArrowLeftRight, X, Save, History, Layers, AlertCircle, GitFork } from 'lucide-react';

interface AddTransactionProps {
  categories: Category[];
  onSave: (transactions: Omit<Transaction, 'id'>[], mergeTargetId?: string) => void;
  onClose: () => void;
  initialSmartPaste?: boolean;
  recentTransactions?: Transaction[]; // For merge feature
}

// Add tempId to track items before they are saved to DB
interface BatchTransaction extends Omit<Transaction, 'id'> {
  tempId: string; 
  mergeTargetId?: string; // If merging into an EXISTING (saved) transaction
  
  // Undo/Split Support for Batch Merging
  mergedChildren?: BatchTransaction[];
  originalAmount?: number;
  originalNote?: string;
}

// Helper to find category ID by name
const findCategoryId = (categories: Category[], name?: string, type: TransactionType = 'expense'): string => {
  if (!name) return categories.find(c => c.type === type)?.id || '';
  const matched = categories.find(c => 
    c.name.toLowerCase().includes(name.toLowerCase()) || 
    name.toLowerCase().includes(c.name.toLowerCase())
  );
  return matched ? matched.id : (categories.find(c => c.type === type)?.id || '');
};

const AddTransaction: React.FC<AddTransactionProps> = ({ 
  categories, 
  onSave, 
  onClose, 
  initialSmartPaste = false,
  recentTransactions = []
}) => {
  // Global Mode State
  const [batchMode, setBatchMode] = useState(false);
  const [showPasteInput, setShowPasteInput] = useState(initialSmartPaste);
  
  // Single Entry State
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [type, setType] = useState<TransactionType>('expense');
  const [isMergeActive, setIsMergeActive] = useState(false);
  const [singleMergeTargetId, setSingleMergeTargetId] = useState<string | null>(null);

  // Batch Entry State
  const [batchList, setBatchList] = useState<BatchTransaction[]>([]);
  // State for Batch Merge Selection Modal
  const [showBatchMergeModal, setShowBatchMergeModal] = useState(false);
  const [activeBatchTempId, setActiveBatchTempId] = useState<string | null>(null); // Use tempId instead of index

  // AI State
  const [isParsing, setIsParsing] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // UX State
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);

  // Initialize Category
  useEffect(() => {
    if (!categoryId && categories.length > 0 && !batchMode) {
      const first = categories.find(c => c.type === type);
      if (first) setCategoryId(first.id);
    }
  }, [categories, type, batchMode]); 

  // Reset merge target when type changes (Single Mode)
  useEffect(() => {
    setSingleMergeTargetId(null);
    setIsMergeActive(false);
  }, [type]);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
      setToast({msg, type});
      setTimeout(() => setToast(null), 2000);
  };

  // --- Helpers ---
  
  // Get Saved Transactions suitable for merging
  const getSavedMergeCandidates = (currentType: TransactionType) => {
    const targetType = currentType === 'expense' ? 'income' : 'expense';
    return recentTransactions
      .filter(t => t.type === targetType)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 20);
  };

  // Get Unsaved Batch Items suitable for merging
  // Now returns ALL other items regardless of type to allow same-type merge (combination)
  const getBatchMergeCandidates = (currentTempId: string) => {
    return batchList.filter(t => t.tempId !== currentTempId);
  };

  const renderMergeOption = (
      id: string, 
      note: string, 
      amount: number, 
      itemType: TransactionType, 
      dateStr: string, 
      categoryId: string,
      isSelected: boolean,
      onClick: () => void,
      isUnsaved: boolean,
      currentUserType?: TransactionType // To determine if it's Merge or Offset
  ) => {
      const cat = categories.find(c => c.id === categoryId);
      const isSameType = currentUserType && currentUserType === itemType;
      
      return (
        <div 
            key={id}
            onClick={onClick}
            className={`p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer mb-2 ${isSelected ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' : 'bg-white border-gray-200 hover:border-gray-300'}`}
        >
            <div className="flex items-center gap-3 overflow-hidden">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isUnsaved ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-500'}`}>
                    {isUnsaved ? <Layers size={16} /> : <DynamicIcon name={cat?.icon || 'MoreHorizontal'} size={16} />}
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <div className="text-sm font-medium text-gray-800 truncate">{note || cat?.name || '无备注'}</div>
                        {isUnsaved && <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 rounded">未保存</span>}
                    </div>
                    <div className="text-xs text-gray-500 flex items-center gap-2">
                        <span>{new Date(dateStr).toLocaleDateString()}</span>
                        {currentUserType && (
                            <span className={`px-1.5 rounded text-[10px] ${isSameType ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                                {isSameType ? '合并(相加)' : '抵扣(相减)'}
                            </span>
                        )}
                    </div>
                </div>
            </div>
            <div className={`font-bold ml-2 ${itemType === 'income' ? 'text-green-600' : 'text-black'}`}>
                {itemType === 'income' ? '+' : '-'}¥{amount}
            </div>
        </div>
      );
  };

  // --- Handlers for Single Mode ---

  const handleSaveSingle = (shouldClose: boolean) => {
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        showToast('请输入有效金额', 'error');
        return;
    }
    if (isMergeActive && !singleMergeTargetId) {
        alert("请选择要合并/抵扣的账单");
        return;
    }
    
    const finalCatId = isMergeActive ? categories[0].id : categoryId; 

    const newTransaction: Omit<Transaction, 'id'> = {
      amount: parseFloat(amount),
      type,
      categoryId: finalCatId, 
      date: new Date(date).toISOString(),
      note: note.trim()
    };

    onSave([newTransaction], isMergeActive ? singleMergeTargetId! : undefined);

    if (shouldClose) {
      onClose();
    } else {
      setAmount('');
      setNote('');
      setSingleMergeTargetId(null);
      setIsMergeActive(false);
      showToast('已保存！再记一笔...');
    }
  };

  // --- Handlers for Batch Mode ---

  const handleUpdateBatchItem = (tempId: string, field: keyof BatchTransaction, value: any) => {
    setBatchList(prev => prev.map(item => {
        if (item.tempId === tempId) {
            const updated = { ...item, [field]: value };
            if (field === 'type') {
                updated.mergeTargetId = undefined; 
            }
            return updated;
        }
        return item;
    }));
  };

  const handleDeleteBatchItem = (tempId: string) => {
    setBatchList(prev => {
        const newList = prev.filter(item => item.tempId !== tempId);
        if (newList.length === 0) setBatchMode(false);
        return newList;
    });
  };

  // Save a single item from the batch list
  const handleSaveSingleBatchItem = (tempId: string) => {
    const item = batchList.find(t => t.tempId === tempId);
    if (!item) return;
    
    if (!item.amount || item.amount <= 0) {
        showToast('金额必须大于0', 'error');
        return;
    }

    // Remove tempId before saving
    const { tempId: _, mergeTargetId, mergedChildren, originalAmount, originalNote, ...transactionData } = item;
    
    onSave([transactionData], mergeTargetId);
    
    // Remove from list
    handleDeleteBatchItem(tempId);
    
    showToast('已保存');
  };

  const handleOpenBatchMerge = (tempId: string) => {
     setActiveBatchTempId(tempId);
     const item = batchList.find(t => t.tempId === tempId);
     if (item) {
        setType(item.type); // Set global type so modal helpers work with correct context
     }
     setShowBatchMergeModal(true);
  };

  const handleSelectBatchMergeTarget = (targetId: string, isUnsavedBatchItem: boolean) => {
     if (!activeBatchTempId) return;

     if (isUnsavedBatchItem) {
        // --- LOCAL MERGE LOGIC (Unsaved merges into Unsaved) ---
        const sourceItem = batchList.find(t => t.tempId === activeBatchTempId);
        const targetItem = batchList.find(t => t.tempId === targetId);

        if (sourceItem && targetItem) {
            
            // Prepare Target for history if not already having children
            // We only support undo one-level deep to keep UI simple, or recursive if list structure
            // Here we treat targetItem as the container.
            const baseTarget = targetItem.mergedChildren ? targetItem : {
                 ...targetItem,
                 mergedChildren: [],
                 originalAmount: targetItem.amount,
                 originalNote: targetItem.note
             };

            let updatedTarget: BatchTransaction;

            if (sourceItem.type === baseTarget.type) {
                // SAME TYPE -> MERGE (ADDITION)
                updatedTarget = {
                    ...baseTarget,
                    amount: baseTarget.amount + sourceItem.amount,
                    note: baseTarget.note ? `${baseTarget.note} + ${sourceItem.note}` : sourceItem.note,
                    mergedChildren: [...(baseTarget.mergedChildren || []), sourceItem]
                };
                showToast('已合并(相加)', 'success');
            } else {
                // OPPOSITE TYPE -> OFFSET (SUBTRACTION)
                const newTargetAmount = baseTarget.amount - sourceItem.amount;
                const sourceTypeName = sourceItem.type === 'income' ? '收入' : '支出';
                const offsetNote = ` (抵扣${sourceTypeName} ${sourceItem.amount}: ${sourceItem.note})`;

                // Note: Logic allows negative amounts for offset remainder handling in app state,
                // but for batch edit we keep it simple. If negative, user sees 0 or negative.
                updatedTarget = {
                    ...baseTarget,
                    amount: newTargetAmount > 0 ? newTargetAmount : 0,
                    note: baseTarget.note + offsetNote,
                    mergedChildren: [...(baseTarget.mergedChildren || []), sourceItem]
                };
                showToast('已抵扣(相减)', 'success');
            }
            
            // Update Target and Remove Source from main list
            setBatchList(prev => {
                const listWithoutSource = prev.filter(t => t.tempId !== activeBatchTempId);
                return listWithoutSource.map(t => t.tempId === targetId ? updatedTarget : t);
            });
        }
     } else {
         // --- STANDARD MERGE LOGIC (Unsaved merges into Saved) ---
         setBatchList(prev => prev.map(item => {
             if (item.tempId === activeBatchTempId) {
                 return { ...item, mergeTargetId: targetId };
             }
             return item;
         }));
     }
     
     setShowBatchMergeModal(false);
     setActiveBatchTempId(null);
  };

  const handleClearBatchMerge = (tempId: string) => {
      setBatchList(prev => prev.map(item => {
          if (item.tempId === tempId) {
              return { ...item, mergeTargetId: undefined };
          }
          return item;
      }));
  };

  // Logic to Split / Undo Merge
  const handleSplitBatchItem = (tempId: string) => {
    setBatchList(prev => {
        const itemIndex = prev.findIndex(t => t.tempId === tempId);
        if (itemIndex === -1) return prev;
        
        const item = prev[itemIndex];
        if (!item.mergedChildren || item.mergedChildren.length === 0) return prev;
        
        // Revert Parent
        const revertedParent: BatchTransaction = {
            ...item,
            amount: item.originalAmount !== undefined ? item.originalAmount : item.amount,
            note: item.originalNote !== undefined ? item.originalNote : item.note,
            mergedChildren: undefined,
            originalAmount: undefined,
            originalNote: undefined
        };
        
        // Get Children to restore
        const children = item.mergedChildren;
        
        // Construct new list
        const newList = [...prev];
        newList[itemIndex] = revertedParent;
        // Insert children after the parent
        newList.splice(itemIndex + 1, 0, ...children);
        
        return newList;
    });
    showToast('已拆分/撤销合并');
  };

  const handleSaveAllBatch = () => {
    const validItems = batchList.filter(t => t.amount > 0);
    if (validItems.length === 0) {
        if (batchList.length > 0) showToast('金额必须大于0', 'error');
        return;
    }

    const regularItems = validItems.filter(t => !t.mergeTargetId);
    const mergedItems = validItems.filter(t => !!t.mergeTargetId);

    if (regularItems.length > 0) {
        // Strip batch-only fields
        onSave(regularItems.map(({tempId, mergeTargetId, mergedChildren, originalAmount, originalNote, ...rest}) => rest));
    }

    mergedItems.forEach(item => {
        const { tempId, mergeTargetId, mergedChildren, originalAmount, originalNote, ...rest } = item;
        onSave([rest], mergeTargetId);
    });

    onClose();
  };

  // --- AI Logic ---

  const handlePasteFromClipboard = async () => {
    try {
        const text = await navigator.clipboard.readText();
        setPasteText(text);
    } catch (err) {
        console.error("Clipboard failed", err);
    }
  };

  const processAIResults = (results: ParsedTransaction[]) => {
    if (results && results.length > 0) {
      if (results.length === 1 && !batchMode) {
        const res = results[0];
        setAmount(res.amount.toString());
        if (res.merchant) setNote(res.merchant);
        if (res.date) setDate(res.date);
        setCategoryId(findCategoryId(categories, res.categorySuggestion));
        setShowPasteInput(false);
      } else {
        const newBatch = results.map(res => ({
            tempId: Date.now().toString() + Math.random().toString().slice(2),
            amount: res.amount,
            type: 'expense' as TransactionType, 
            categoryId: findCategoryId(categories, res.categorySuggestion),
            date: res.date ? new Date(res.date).toISOString() : new Date().toISOString(),
            note: res.merchant,
            mergeTargetId: undefined
        }));
        setBatchList(prev => [...prev, ...newBatch]);
        setBatchMode(true);
        setShowPasteInput(false);
      }
    } else {
      alert("AI未能识别有效信息，请重试或手动输入。");
    }
  };

  const handleAIParse = async () => {
    if (!pasteText.trim()) return;
    setIsParsing(true);
    const results = await parseWeChatText(pasteText);
    setIsParsing(false);
    processAIResults(results);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    try {
        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64String = reader.result as string;
            const base64Content = base64String.split(',')[1];
            const mimeType = base64String.substring(base64String.indexOf(':') + 1, base64String.indexOf(';'));
            
            const results = await parseScreenshot(base64Content, mimeType);
            setIsParsing(false);
            processAIResults(results);
        };
        reader.readAsDataURL(file);
    } catch (err) {
        console.error("Image processing failed", err);
        setIsParsing(false);
        alert("图片处理失败");
    }
  };

  // --- Render ---

  // 1. Batch Review UI
  if (batchMode) {
    return (
        <div className="h-full flex flex-col bg-gray-50 relative">
            {/* Toast */}
            {toast && (
                <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50">
                   <div className={`px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 backdrop-blur-sm shadow-lg ${toast.type === 'success' ? 'bg-gray-900/80 text-white' : 'bg-red-500/90 text-white'}`}>
                      {toast.type === 'success' ? <CheckCircle2 size={16}/> : <AlertCircle size={16}/>}
                      {toast.msg}
                   </div>
                </div>
            )}

            {/* Batch Merge Selection Modal */}
            {showBatchMergeModal && activeBatchTempId && (
                <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end animate-fade-in">
                    <div className="bg-white w-full rounded-t-3xl p-4 h-[80vh] flex flex-col shadow-2xl">
                        <div className="flex justify-between items-center mb-4 pb-4 border-b">
                            <div>
                                <h3 className="font-bold text-lg">选择抵扣/合并目标</h3>
                                <p className="text-xs text-gray-500">将当前账单合并到...</p>
                            </div>
                            <button onClick={() => setShowBatchMergeModal(false)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200"><X size={20}/></button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto space-y-6 pb-10">
                            
                            {/* Section 1: Unsaved Batch Items */}
                            {getBatchMergeCandidates(activeBatchTempId).length > 0 && (
                                <div>
                                    <h4 className="text-xs font-bold text-orange-600 uppercase mb-2 flex items-center gap-1">
                                        <Layers size={12}/> 本次批量未保存
                                    </h4>
                                    <div className="bg-orange-50/50 rounded-xl p-1">
                                    {getBatchMergeCandidates(activeBatchTempId).map(t => 
                                        renderMergeOption(t.tempId, t.note, t.amount, t.type, t.date, t.categoryId, false, () => handleSelectBatchMergeTarget(t.tempId, true), true, type)
                                    )}
                                    </div>
                                </div>
                            )}

                            {/* Section 2: Saved History */}
                            <div>
                                <h4 className="text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-1">
                                    <History size={12}/> 历史已保存
                                </h4>
                                {getSavedMergeCandidates(type).length > 0 ? (
                                    getSavedMergeCandidates(type).map(t => 
                                        renderMergeOption(t.id, t.note, t.amount, t.type, t.date, t.categoryId, false, () => handleSelectBatchMergeTarget(t.id, false), false, type)
                                    )
                                ) : (
                                    <div className="text-center text-gray-400 text-sm py-4">无近期匹配记录(仅支持抵扣)</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="px-4 py-4 flex items-center justify-between bg-white shadow-sm sticky top-0 z-20">
                <button onClick={() => setBatchMode(false)} className="text-gray-500 font-medium">退出</button>
                <h2 className="font-bold text-lg">批量确认 ({batchList.length})</h2>
                <button onClick={handleSaveAllBatch} className="text-primary font-bold">全部保存</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {batchList.map((item) => {
                    const hasMergeTarget = !!item.mergeTargetId;
                    const mergeTarget = recentTransactions.find(t => t.id === item.mergeTargetId);
                    const hasChildren = item.mergedChildren && item.mergedChildren.length > 0;
                    
                    return (
                        <div key={item.tempId} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 relative animate-fade-in transition-all">
                            {/* Row Actions */}
                            <div className="absolute right-3 top-3 flex gap-2">
                                {hasChildren && (
                                    <button 
                                        onClick={() => handleSplitBatchItem(item.tempId)}
                                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold bg-blue-50"
                                        title="拆分/撤销合并"
                                    >
                                        <GitFork size={14} className="rotate-180" /> 拆分
                                    </button>
                                )}
                                <button 
                                    onClick={() => handleSaveSingleBatchItem(item.tempId)} 
                                    className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                    title="单独保存此项"
                                >
                                    <Save size={18}/>
                                </button>
                                <button 
                                    onClick={() => handleDeleteBatchItem(item.tempId)} 
                                    className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    title="删除"
                                >
                                    <Trash2 size={18}/>
                                </button>
                            </div>
                            
                            {/* Amount & Date */}
                            <div className="flex gap-4 mb-3 pr-24"> 
                                <div className="flex-1">
                                    <label className="text-[10px] text-gray-400 uppercase font-bold">金额</label>
                                    <input 
                                        type="number"
                                        className="w-full font-bold text-xl py-1 focus:outline-none border-b border-gray-100 focus:border-primary bg-transparent"
                                        value={item.amount}
                                        onChange={(e) => handleUpdateBatchItem(item.tempId, 'amount', parseFloat(e.target.value))}
                                    />
                                </div>
                                <div className="w-1/3">
                                    <label className="text-[10px] text-gray-400 uppercase font-bold">日期</label>
                                    <input 
                                        type="date"
                                        className="w-full text-sm py-1.5 border-b border-gray-100 focus:border-primary bg-transparent"
                                        value={item.date.split('T')[0]}
                                        onChange={(e) => handleUpdateBatchItem(item.tempId, 'date', new Date(e.target.value).toISOString())}
                                    />
                                </div>
                            </div>

                            {/* Type Toggle */}
                            <div className="flex gap-2 mb-3">
                                <button 
                                    className={`text-xs px-3 py-1 rounded-full border ${item.type === 'expense' ? 'bg-gray-800 text-white border-gray-800' : 'text-gray-500 border-gray-200'}`}
                                    onClick={() => handleUpdateBatchItem(item.tempId, 'type', 'expense')}
                                >支出</button>
                                <button 
                                    className={`text-xs px-3 py-1 rounded-full border ${item.type === 'income' ? 'bg-green-600 text-white border-green-600' : 'text-gray-500 border-gray-200'}`}
                                    onClick={() => handleUpdateBatchItem(item.tempId, 'type', 'income')}
                                >收入</button>
                            </div>

                            {/* Category & Note OR Merge Info */}
                            {hasMergeTarget ? (
                                <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-blue-800">
                                        <ArrowLeftRight size={16} />
                                        <div className="text-sm">
                                            <span className="opacity-70 text-xs mr-1">抵扣/合并到:</span>
                                            <span className="font-medium truncate max-w-[120px]">{mergeTarget?.note || '未知账单'}</span>
                                            <span className="text-xs ml-1 opacity-70">(¥{mergeTarget?.amount})</span>
                                        </div>
                                    </div>
                                    <button onClick={() => handleClearBatchMerge(item.tempId)} className="p-1 bg-white rounded-full text-gray-400 hover:text-red-500 shadow-sm">
                                        <X size={14} />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex gap-3 items-center">
                                    <div className="flex-[2]">
                                        <select 
                                            className="w-full bg-gray-50 p-2.5 rounded-lg text-sm border-none focus:ring-1 focus:ring-primary"
                                            value={item.categoryId}
                                            onChange={(e) => handleUpdateBatchItem(item.tempId, 'categoryId', e.target.value)}
                                        >
                                            {categories.filter(c => c.type === item.type).map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="flex-[3]">
                                        <input 
                                            type="text"
                                            className="w-full bg-gray-50 p-2.5 rounded-lg text-sm border-none focus:ring-1 focus:ring-primary"
                                            value={item.note}
                                            onChange={(e) => handleUpdateBatchItem(item.tempId, 'note', e.target.value)}
                                            placeholder="备注"
                                        />
                                    </div>
                                    {/* Merge Button */}
                                    <button 
                                        onClick={() => handleOpenBatchMerge(item.tempId)}
                                        className="p-2.5 bg-gray-100 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded-lg transition-colors"
                                        title="关联/抵扣其他账单"
                                    >
                                        <ArrowLeftRight size={18} />
                                    </button>
                                </div>
                            )}
                            
                            {/* Children Visualization */}
                            {hasChildren && (
                                <div className="mt-2 pl-2 border-l-2 border-blue-200">
                                    <p className="text-[10px] text-gray-400 mb-1 ml-1">已包含 {item.mergedChildren?.length} 笔合并项目:</p>
                                    <div className="flex flex-wrap gap-1">
                                        {item.mergedChildren?.map((child, idx) => (
                                            <span key={idx} className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100">
                                                {child.note || '无备注'} (¥{child.amount})
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
                
                {batchList.length === 0 && (
                    <div className="text-center text-gray-400 mt-10">
                        暂无批量数据
                    </div>
                )}
            </div>

             {/* Add Manual Item to Batch */}
             <div className="p-4 bg-white border-t border-gray-100">
                <button 
                    onClick={() => setBatchList(prev => [...prev, {
                        tempId: Date.now().toString(),
                        amount: 0,
                        type: 'expense',
                        categoryId: categories[0].id,
                        date: new Date().toISOString(),
                        note: '',
                        mergeTargetId: undefined
                    }])}
                    className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 font-medium flex items-center justify-center gap-2 hover:border-gray-300 hover:text-gray-600 transition-colors"
                >
                    <Plus size={20} /> 添加一行
                </button>
             </div>
        </div>
    );
  }

  // 2. Single Mode UI
  return (
    <div className="h-full flex flex-col bg-white relative">
      {/* Toast */}
      {toast && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-gray-900/80 text-white px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 animate-fade-in z-50 backdrop-blur-sm shadow-lg">
          {toast.type === 'success' ? <CheckCircle2 size={16} className="text-emerald-400" /> : <AlertCircle size={16} className="text-red-400" />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="px-4 py-4 flex items-center justify-between border-b bg-white sticky top-0 z-20">
        <button onClick={onClose} className="text-gray-500 p-2">取消</button>
        
        {/* Type Toggle */}
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button 
            className={`px-4 py-1 rounded-md text-sm font-medium transition-all ${type === 'expense' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
            onClick={() => setType('expense')}
          >
            支出
          </button>
          <button 
            className={`px-4 py-1 rounded-md text-sm font-medium transition-all ${type === 'income' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
            onClick={() => setType('income')}
          >
            收入
          </button>
        </div>

        <button 
          onClick={() => handleSaveSingle(true)} 
          disabled={!amount}
          className="text-primary font-bold p-2 disabled:opacity-50"
        >
          保存
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        
        {/* AI Access */}
        <div 
            onClick={() => setShowPasteInput(!showPasteInput)}
            className={`bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 p-3 rounded-xl flex items-center gap-3 mb-6 cursor-pointer active:scale-[0.98] transition-transform ${showPasteInput ? 'ring-2 ring-emerald-100' : ''}`}
        >
            <div className="w-8 h-8 rounded-full bg-white text-emerald-500 flex items-center justify-center shadow-sm shrink-0">
                <Sparkles size={16} />
            </div>
            <div className="flex-1">
                <h3 className="text-sm font-bold text-emerald-800">智能导入 / 截图识别</h3>
            </div>
        </div>

        {showPasteInput && (
            <div className="mb-6 bg-gray-50 p-3 rounded-xl border border-gray-200 animate-fade-in">
                <div className="relative">
                    <textarea 
                        className="w-full bg-white border border-gray-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none mb-2 min-h-[80px]"
                        rows={3}
                        placeholder="在此粘贴文本..."
                        value={pasteText}
                        onChange={(e) => setPasteText(e.target.value)}
                    />
                    {!pasteText && (
                        <button 
                            onClick={handlePasteFromClipboard}
                            className="absolute right-2 bottom-4 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-2 py-1 rounded border flex items-center gap-1"
                        >
                            <ClipboardPaste size={12}/> 粘贴
                        </button>
                    )}
                </div>
                
                <div className="flex gap-2">
                    <button 
                        onClick={handleAIParse}
                        disabled={isParsing || !pasteText}
                        className="flex-1 bg-emerald-600 text-white rounded-lg py-2 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {isParsing ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                        {isParsing ? '识别中...' : '识别文本'}
                    </button>

                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        accept="image/*" 
                        className="hidden" 
                        onChange={handleImageUpload}
                    />
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isParsing}
                        className="px-4 bg-white text-emerald-600 border border-emerald-200 rounded-lg py-2 text-sm font-medium flex items-center justify-center gap-2 hover:bg-emerald-50 disabled:opacity-50"
                    >
                            <ImageIcon size={20} />
                    </button>
                </div>
            </div>
        )}

        {/* Amount Input */}
        <div className="mb-8 mt-2">
          <label className="block text-xs text-gray-400 font-medium mb-1 uppercase tracking-wider">
            {isMergeActive ? (type === 'expense' ? '抵扣金额' : '合并金额') : '金额'}
          </label>
          <div className="flex items-center gap-2 border-b-2 border-gray-200 focus-within:border-primary transition-colors pb-1">
            <span className="text-3xl font-bold text-gray-400">¥</span>
            <input 
              type="number" 
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full text-4xl font-bold text-gray-900 bg-transparent focus:outline-none placeholder-gray-200"
              placeholder="0.00"
              autoFocus={!showPasteInput}
            />
          </div>
        </div>
        
        {/* Merge Toggle */}
        <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${isMergeActive ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                    <ArrowLeftRight size={18} />
                </div>
                <div>
                    <div className={`text-sm font-bold ${isMergeActive ? 'text-gray-900' : 'text-gray-500'}`}>合并/抵扣</div>
                    <div className="text-[10px] text-gray-400">
                        {isMergeActive ? `选择一笔${type === 'expense' ? '收入' : '支出'}进行关联` : '关联已有账单'}
                    </div>
                </div>
            </div>
            <button 
                onClick={() => setIsMergeActive(!isMergeActive)}
                className={`w-12 h-7 rounded-full transition-colors relative ${isMergeActive ? 'bg-blue-600' : 'bg-gray-200'}`}
            >
                <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${isMergeActive ? 'left-6' : 'left-1'}`}></div>
            </button>
        </div>

        {/* Dynamic Section: Category OR Merge List */}
        {isMergeActive ? (
            <div className="mb-6 animate-fade-in">
                <label className="block text-xs text-gray-400 font-medium mb-3 uppercase tracking-wider">
                   选择目标{type === 'expense' ? '收入' : '支出'}
                </label>
                <div className="space-y-2 max-h-60 overflow-y-auto bg-gray-50 p-2 rounded-xl border border-gray-100">
                    {getSavedMergeCandidates(type).length > 0 ? (
                        getSavedMergeCandidates(type).map(t => 
                            renderMergeOption(t.id, t.note, t.amount, t.type, t.date, t.categoryId, singleMergeTargetId === t.id, () => setSingleMergeTargetId(t.id), false, type)
                        )
                    ) : (
                        <div className="p-4 text-center text-gray-400 text-xs">无近期可抵扣记录</div>
                    )}
                </div>
            </div>
        ) : (
            <div className="mb-6 animate-fade-in">
                <label className="block text-xs text-gray-400 font-medium mb-3 uppercase tracking-wider">分类</label>
                <div className="grid grid-cols-4 gap-4">
                {categories.filter(c => c.type === type).map(cat => (
                    <button 
                    key={cat.id}
                    onClick={() => setCategoryId(cat.id)}
                    className="flex flex-col items-center gap-2 group"
                    >
                    <div 
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${categoryId === cat.id ? 'bg-primary text-white shadow-lg scale-110' : 'bg-gray-100 text-gray-500 group-active:bg-gray-200'}`}
                    >
                        <DynamicIcon name={cat.icon} size={20} />
                    </div>
                    <span className={`text-xs font-medium truncate max-w-full ${categoryId === cat.id ? 'text-primary' : 'text-gray-500'}`}>
                        {cat.name}
                    </span>
                    </button>
                ))}
                </div>
            </div>
        )}

        {/* Common Details */}
        <div className="space-y-4">
            <div>
                <label className="block text-xs text-gray-400 font-medium mb-1 uppercase tracking-wider">日期</label>
                <input 
                    type="date" 
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
            </div>
            <div>
                <label className="block text-xs text-gray-400 font-medium mb-1 uppercase tracking-wider">备注 (选填)</label>
                <input 
                    type="text" 
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={isMergeActive ? "例如: 朋友还款、公司报销..." : "例如: 午餐、打车..."}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
            </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 mb-4">
             <button 
                onClick={() => handleSaveSingle(false)}
                disabled={!amount}
                className="w-full py-3 bg-emerald-50 text-emerald-700 rounded-xl font-medium border border-emerald-100 flex items-center justify-center gap-2 active:bg-emerald-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
             >
                <Plus size={18} />
                再记一笔 (保存并继续)
             </button>
        </div>

      </div>
    </div>
  );
};

export default AddTransaction;