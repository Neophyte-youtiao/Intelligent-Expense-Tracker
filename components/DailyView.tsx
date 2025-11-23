import React, { useState, useMemo, useRef } from 'react';
import { Transaction, Category } from '../types';
import { DynamicIcon } from './Icons';
import { ArrowLeft, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

interface DailyViewProps {
  transactions: Transaction[];
  categories: Category[];
  onBack: () => void;
  onDeleteTransaction: (id: string) => void;
}

const DailyView: React.FC<DailyViewProps> = ({ transactions, categories, onBack, onDeleteTransaction }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Robust Long Press State
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pointerStartPosRef = useRef<{x: number, y: number} | null>(null);

  const handlePointerDown = (e: React.PointerEvent, id: string) => {
    pointerStartPosRef.current = { x: e.clientX, y: e.clientY };
    longPressTimerRef.current = setTimeout(() => {
        if (navigator.vibrate) navigator.vibrate(50);
        onDeleteTransaction(id);
        longPressTimerRef.current = null;
        pointerStartPosRef.current = null;
    }, 600);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (longPressTimerRef.current && pointerStartPosRef.current) {
        const moveX = Math.abs(e.clientX - pointerStartPosRef.current.x);
        const moveY = Math.abs(e.clientY - pointerStartPosRef.current.y);
        if (moveX > 10 || moveY > 10) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
            pointerStartPosRef.current = null;
        }
    }
  };

  const handlePointerUpOrLeave = () => {
    if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
    }
    pointerStartPosRef.current = null;
  };

  const handlePrevDay = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() - 1);
    setCurrentDate(newDate);
  };

  const handleNextDay = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + 1);
    setCurrentDate(newDate);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      setCurrentDate(new Date(e.target.value));
    }
  };

  const dayData = useMemo(() => {
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth();
    const d = currentDate.getDate();

    return transactions.filter(t => {
      const tDate = new Date(t.date);
      return tDate.getFullYear() === y && tDate.getMonth() === m && tDate.getDate() === d;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, currentDate]);

  const stats = useMemo(() => {
    const income = dayData.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expense = dayData.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    return { income, expense };
  }, [dayData]);

  const getCategory = (id: string) => categories.find(c => c.id === id);

  const formattedDate = currentDate.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  const isoDate = currentDate.toISOString().split('T')[0];

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white px-4 py-4 flex items-center shadow-sm sticky top-0 z-10 justify-between">
        <button onClick={onBack} className="text-gray-500 p-2 -ml-2 hover:bg-gray-100 rounded-full">
          <ArrowLeft size={22} />
        </button>
        <span className="font-bold text-lg text-gray-800">当日账单</span>
        <div className="w-8"></div> {/* Spacer */}
      </div>

      {/* Date Navigator */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 flex flex-col items-center">
        <div className="flex items-center gap-4 mb-4">
            <button onClick={handlePrevDay} className="p-2 bg-gray-100 rounded-full text-gray-600 hover:bg-gray-200">
                <ChevronLeft size={20}/>
            </button>
            <div className="relative">
                <div className="flex flex-col items-center">
                    <span className="font-bold text-lg">{formattedDate}</span>
                </div>
                <input 
                    type="date" 
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    value={isoDate}
                    onChange={handleDateChange}
                />
            </div>
            <button onClick={handleNextDay} className="p-2 bg-gray-100 rounded-full text-gray-600 hover:bg-gray-200">
                <ChevronRight size={20}/>
            </button>
        </div>

        <div className="flex w-full gap-4">
            <div className="flex-1 bg-green-50 rounded-xl p-3 flex flex-col items-center border border-green-100">
                <span className="text-xs text-green-600 font-medium mb-1">今日收入</span>
                <span className="text-xl font-bold text-green-700">+{stats.income.toFixed(2)}</span>
            </div>
            <div className="flex-1 bg-red-50 rounded-xl p-3 flex flex-col items-center border border-red-100">
                <span className="text-xs text-red-600 font-medium mb-1">今日支出</span>
                <span className="text-xl font-bold text-red-700">-{stats.expense.toFixed(2)}</span>
            </div>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
         {dayData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                <Calendar size={48} className="mb-2 opacity-20" />
                <p>今日暂无账单</p>
            </div>
         ) : (
            dayData.map(t => {
                const cat = getCategory(t.categoryId);
                return (
                  <div 
                    key={t.id} 
                    className="bg-white p-4 rounded-xl shadow-sm flex items-center gap-3 border border-gray-100 select-none cursor-pointer touch-pan-y"
                    onPointerDown={(e) => handlePointerDown(e, t.id)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUpOrLeave}
                    onPointerLeave={handlePointerUpOrLeave}
                    onContextMenu={(e) => e.preventDefault()}
                  >
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${cat?.color}20`, color: cat?.color }}
                    >
                      <DynamicIcon name={cat?.icon || 'MoreHorizontal'} size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline">
                        <h3 className="font-medium text-gray-800 truncate">{t.note || cat?.name}</h3>
                        <span className={`font-bold ${t.type === 'income' ? 'text-green-600' : 'text-gray-900'}`}>
                          {t.type === 'income' ? '+' : '-'}¥{t.amount.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>{new Date(t.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        <span>{cat?.name}</span>
                      </div>
                    </div>
                  </div>
                );
            })
         )}
      </div>
    </div>
  );
};

export default DailyView;