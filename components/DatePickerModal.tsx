import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, ChevronUp, Check, Layers } from 'lucide-react';
import { Transaction } from '../types';

interface DatePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect?: (date: Date) => void;
  onMultiSelect?: (dates: Date[]) => void;
  currentDate?: Date;
  selectedDates?: Date[]; // For multi-select
  mode: 'day' | 'month' | 'year';
  multiSelect?: boolean;
  transactions?: Transaction[]; // New prop for showing stats
}

type InternalView = 'day' | 'month' | 'year';

const MONTH_NAMES = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

const DatePickerModal: React.FC<DatePickerModalProps> = ({ 
  isOpen, 
  onClose, 
  onSelect, 
  onMultiSelect,
  currentDate = new Date(), 
  selectedDates = [],
  mode,
  multiSelect = false,
  transactions = []
}) => {
  const [internalDate, setInternalDate] = useState(new Date(currentDate));
  const [view, setView] = useState<InternalView>(mode);
  const [yearPageStart, setYearPageStart] = useState(currentDate.getFullYear() - 5);
  
  // Local state for multi-selection before confirming
  const [tempSelectedDates, setTempSelectedDates] = useState<Date[]>([]);
  // Range selection state
  const [rangeStart, setRangeStart] = useState<Date | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Robust Long Press Refs
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pointerStartPosRef = useRef<{x: number, y: number} | null>(null);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setInternalDate(new Date(currentDate));
      setView(mode);
      setYearPageStart(currentDate.getFullYear() - 5);
      if (multiSelect) {
        setTempSelectedDates([...selectedDates]);
        setRangeStart(null);
      }
    }
  }, [isOpen]); 

  if (!isOpen) return null;

  // --- Logic Helpers ---

  const showToast = (msg: string) => {
      setToastMsg(msg);
      setTimeout(() => setToastMsg(null), 2000);
  };

  const isSameDay = (d1: Date, d2: Date) => {
      return d1.getDate() === d2.getDate() && 
             d1.getMonth() === d2.getMonth() && 
             d1.getFullYear() === d2.getFullYear();
  };

  // --- Handlers ---

  const handleYearSelect = (year: number) => {
    const newDate = new Date(internalDate);
    newDate.setFullYear(year);
    setInternalDate(newDate);
    
    if (mode === 'year' && !multiSelect) {
      onSelect?.(newDate);
      onClose();
    } else {
      setView('month');
    }
  };

  const handleMonthSelect = (monthIndex: number) => {
    const newDate = new Date(internalDate);
    newDate.setMonth(monthIndex);
    setInternalDate(newDate);

    if (mode === 'month' && !multiSelect) {
      onSelect?.(newDate);
      onClose();
    } else {
      setView('day');
    }
  };

  // Select a range of dates
  const selectRange = (start: Date, end: Date) => {
      const s = new Date(Math.min(start.getTime(), end.getTime()));
      const e = new Date(Math.max(start.getTime(), end.getTime()));
      const newDates: Date[] = [];
      
      const current = new Date(s);
      while (current <= e) {
          newDates.push(new Date(current));
          current.setDate(current.getDate() + 1);
      }

      // Merge unique
      setTempSelectedDates(prev => {
          const existingStr = new Set(prev.map(d => d.toDateString()));
          const uniqueNew = newDates.filter(d => !existingStr.has(d.toDateString()));
          return [...prev, ...uniqueNew];
      });
      
      showToast(`已批量选中 ${newDates.length} 天`);
      setRangeStart(null);
  };

  const handleDayClick = (day: number) => {
    const newDate = new Date(internalDate);
    newDate.setDate(day);

    if (multiSelect) {
      if (rangeStart) {
          // Complete Range Selection
          selectRange(rangeStart, newDate);
      } else {
          // Toggle selection logic
          const existsIndex = tempSelectedDates.findIndex(d => isSameDay(d, newDate));

          if (existsIndex >= 0) {
            const newArr = [...tempSelectedDates];
            newArr.splice(existsIndex, 1);
            setTempSelectedDates(newArr);
          } else {
            setTempSelectedDates(prev => [...prev, newDate]);
          }
      }
    } else {
      onSelect?.(newDate);
      onClose();
    }
  };

  const handleDayLongPress = (day: number) => {
      if (!multiSelect) return;
      const newDate = new Date(internalDate);
      newDate.setDate(day);
      
      setRangeStart(newDate);
      if (navigator.vibrate) navigator.vibrate(50);
      showToast("起点已定，请点击终点日期以批量选择");
  };

  // --- Pointer Events for Long Press ---

  const handlePointerDown = (e: React.PointerEvent, day: number) => {
    e.stopPropagation(); // Stop propagation to prevent modal close on backdrop click if needed
    pointerStartPosRef.current = { x: e.clientX, y: e.clientY };
    longPressTimerRef.current = setTimeout(() => {
        handleDayLongPress(day);
        longPressTimerRef.current = null;
        pointerStartPosRef.current = null;
    }, 500);
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

  const handlePointerUp = (e: React.PointerEvent, day: number) => {
    e.stopPropagation();
    if (longPressTimerRef.current) {
        // Timer still running -> It was a short click
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
        handleDayClick(day);
    }
    pointerStartPosRef.current = null;
  };

  const handleConfirmMultiSelect = () => {
    onMultiSelect?.(tempSelectedDates);
    onClose();
  };

  const handlePrev = () => {
    const newDate = new Date(internalDate);
    if (view === 'year') {
      setYearPageStart(prev => prev - 12);
    } else if (view === 'month') {
      newDate.setFullYear(newDate.getFullYear() - 1);
      setInternalDate(newDate);
    } else {
      newDate.setMonth(newDate.getMonth() - 1);
      setInternalDate(newDate);
    }
  };

  const handleNext = () => {
    const newDate = new Date(internalDate);
    if (view === 'year') {
      setYearPageStart(prev => prev + 12);
    } else if (view === 'month') {
      newDate.setFullYear(newDate.getFullYear() + 1);
      setInternalDate(newDate);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
      setInternalDate(newDate);
    }
  };

  // --- Stats Helper ---
  const getDayNetIncome = (day: number) => {
    if (!transactions || transactions.length === 0) return null;
    
    const y = internalDate.getFullYear();
    const m = internalDate.getMonth();
    
    // Filter transactions for this specific day
    const dailyTrans = transactions.filter(t => {
      const tDate = new Date(t.date);
      return tDate.getDate() === day && tDate.getMonth() === m && tDate.getFullYear() === y;
    });

    if (dailyTrans.length === 0) return null;

    const income = dailyTrans.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expense = dailyTrans.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    
    return income - expense;
  };

  // --- Render Helpers ---

  const renderHeader = () => {
    let title = '';
    let subtitle = '';

    if (view === 'day') {
      title = `${internalDate.getMonth() + 1}月`;
      subtitle = `${internalDate.getFullYear()}年`;
    } else if (view === 'month') {
      title = `${internalDate.getFullYear()}年`;
      subtitle = '选择月份';
    } else {
      title = `${yearPageStart} - ${yearPageStart + 11}`;
      subtitle = '选择年份';
    }

    return (
      <div className="flex items-center justify-between mb-6 px-2">
        <button onClick={handlePrev} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors">
          <ChevronLeft size={20} className="text-gray-600"/>
        </button>
        <div className="flex flex-col items-center">
            <button 
                onClick={() => view === 'day' ? setView('month') : view === 'month' ? setView('year') : null}
                className={`text-xl font-bold text-gray-800 flex items-center gap-1 ${view !== 'year' ? 'hover:text-primary transition-colors' : ''}`}
            >
                {title}
                {view !== 'year' && <ChevronUp size={16} className="text-gray-400" />}
            </button>
            <button 
                onClick={() => view === 'day' ? setView('year') : null}
                className={`text-xs text-gray-400 font-medium ${view === 'day' ? 'hover:text-primary cursor-pointer' : ''}`}
            >
                {subtitle}
            </button>
        </div>
        <button onClick={handleNext} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors">
          <ChevronRight size={20} className="text-gray-600"/>
        </button>
      </div>
    );
  };

  const renderYears = () => {
    const years = Array.from({ length: 12 }, (_, i) => yearPageStart + i);
    const currentYear = internalDate.getFullYear();
    return (
      <div className="grid grid-cols-3 gap-4">
        {years.map(y => (
          <button
            key={y}
            onClick={() => handleYearSelect(y)}
            className={`py-4 rounded-xl text-lg font-medium transition-all ${
              y === currentYear 
                ? 'bg-primary text-white shadow-md' 
                : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
            }`}
          >
            {y}
          </button>
        ))}
      </div>
    );
  };

  const renderMonths = () => {
    const currentMonth = internalDate.getMonth();
    return (
      <div className="grid grid-cols-3 gap-4">
        {MONTH_NAMES.map((m, i) => (
          <button
            key={m}
            onClick={() => handleMonthSelect(i)}
            className={`py-4 rounded-xl text-lg font-medium transition-all ${
              i === currentMonth 
                ? 'bg-primary text-white shadow-md' 
                : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
            }`}
          >
            {m}
          </button>
        ))}
      </div>
    );
  };

  const renderDays = () => {
    const year = internalDate.getFullYear();
    const month = internalDate.getMonth();
    
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();

    const blanks = Array.from({ length: firstDay }, (_, i) => i);
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    const isToday = (d: number) => {
        const now = new Date();
        return now.getDate() === d && now.getMonth() === month && now.getFullYear() === year;
    };

    const isSelected = (d: number) => {
        if (multiSelect) {
          return tempSelectedDates.some(selected => 
            selected.getDate() === d && 
            selected.getMonth() === month && 
            selected.getFullYear() === year
          );
        }
        return currentDate.getDate() === d && currentDate.getMonth() === month && currentDate.getFullYear() === year;
    };

    const isRangeStart = (d: number) => {
        return rangeStart && 
               rangeStart.getDate() === d && 
               rangeStart.getMonth() === month && 
               rangeStart.getFullYear() === year;
    };

    return (
      <div>
        <div className="grid grid-cols-7 mb-2">
           {WEEKDAYS.map(w => (
               <div key={w} className="text-center text-xs text-gray-400 font-bold py-2">{w}</div>
           ))}
        </div>
        <div className="grid grid-cols-7 gap-y-2 gap-x-1">
           {blanks.map(b => <div key={`blank-${b}`} />)}
           {days.map(d => {
             const netIncome = getDayNetIncome(d);
             const selected = isSelected(d);
             const isStart = isRangeStart(d);
             
             return (
               <div
                  key={d}
                  onPointerDown={(e) => handlePointerDown(e, d)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={(e) => handlePointerUp(e, d)}
                  onPointerLeave={(e) => {
                      // Safety: if leave, cancel long press
                      if(longPressTimerRef.current) {
                          clearTimeout(longPressTimerRef.current);
                          longPressTimerRef.current = null;
                      }
                  }}
                  className={`aspect-square rounded-2xl flex flex-col items-center justify-center transition-all relative border cursor-pointer select-none touch-none
                    ${isStart ? 'bg-primary/20 border-2 border-dashed border-primary animate-pulse' : ''}
                    ${selected 
                        ? 'bg-primary text-white shadow-md border-primary' 
                        : !isStart ? 'text-gray-700 bg-white border-transparent hover:bg-gray-50' : ''
                    }
                  `}
               >
                  <span className={`text-sm font-medium ${selected ? 'text-white' : 'text-gray-700'}`}>{d}</span>
                  
                  {/* Net Income Indicator */}
                  {netIncome !== null && (
                    <span className={`text-[8px] font-bold leading-none mt-0.5 ${
                        selected 
                            ? 'text-white/90' 
                            : netIncome > 0 ? 'text-emerald-500' : netIncome < 0 ? 'text-red-400' : 'text-gray-300'
                    }`}>
                        {netIncome > 0 ? '+' : ''}{Math.round(netIncome)}
                    </span>
                  )}

                  {isToday(d) && !selected && (
                      <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-primary rounded-full"></div>
                  )}
               </div>
             );
           })}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
        <div 
            className="bg-white w-full max-w-[340px] rounded-3xl p-5 shadow-2xl transform transition-all relative overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
        >
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-400 to-teal-500"></div>
            
            {/* Toast */}
            {toastMsg && (
                <div className="absolute top-12 left-0 w-full flex justify-center z-20 pointer-events-none">
                    <div className="bg-gray-900/90 text-white text-xs px-3 py-1.5 rounded-full shadow-lg backdrop-blur-sm">
                        {toastMsg}
                    </div>
                </div>
            )}

            {renderHeader()}

            <div className="flex-1 overflow-y-auto min-h-[340px]">
                {view === 'year' && renderYears()}
                {view === 'month' && renderMonths()}
                {view === 'day' && renderDays()}
            </div>

            {multiSelect ? (
               <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                  <div className="flex flex-col">
                      <span className="text-xs text-gray-500">已选: <span className="font-bold text-gray-800">{tempSelectedDates.length}</span> 天</span>
                      <span className="text-[10px] text-gray-400">长按可批量选择</span>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={onClose} 
                      className="text-gray-500 text-sm py-2 px-4 hover:bg-gray-50 rounded-lg transition-colors"
                    >
                      取消
                    </button>
                    <button 
                      onClick={handleConfirmMultiSelect}
                      className="bg-primary text-white text-sm py-2 px-6 rounded-lg font-medium shadow-lg shadow-primary/30 active:scale-95 transition-transform flex items-center gap-1"
                    >
                      <Check size={14} /> 确认
                    </button>
                  </div>
               </div>
            ) : (
              <div className="mt-6 flex justify-center">
                  <button 
                      onClick={onClose} 
                      className="text-gray-400 text-sm py-2 px-6 hover:text-gray-600 hover:bg-gray-50 rounded-full transition-colors"
                  >
                      关闭
                  </button>
              </div>
            )}
        </div>
    </div>
  );
};

export default DatePickerModal;