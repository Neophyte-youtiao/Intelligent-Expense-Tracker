import React, { useMemo, useState, useRef } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Transaction, Category } from '../types';
import { DynamicIcon } from './Icons';
import DatePickerModal from './DatePickerModal';
import { Plus, Sparkles, ChevronRight, MoonStar, ChevronLeft, Calendar, Filter, BarChart2, Plane } from 'lucide-react';

interface DashboardProps {
  transactions: Transaction[];
  categories: Category[];
  onAddClick: () => void;
  onSmartAddClick: () => void;
  onStatsClick: () => void;
  onFortuneClick: () => void;
  onDailyClick: () => void;
  onCompareClick?: () => void;
  onTripClick?: () => void;
  onDeleteTransaction: (id: string) => void;
  insight?: string;
}

type ViewRange = 'day' | 'month' | 'year';

const Dashboard: React.FC<DashboardProps> = ({ 
  transactions, 
  categories, 
  onAddClick, 
  onSmartAddClick, 
  onStatsClick, 
  onFortuneClick,
  onDailyClick,
  onCompareClick,
  onTripClick,
  onDeleteTransaction,
  insight 
}) => {
  const [viewRange, setViewRange] = useState<ViewRange>('month');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // Robust Long Press State
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pointerStartPosRef = useRef<{x: number, y: number} | null>(null);

  const handlePointerDown = (e: React.PointerEvent, id: string) => {
    // Store start position
    pointerStartPosRef.current = { x: e.clientX, y: e.clientY };
    
    // Start timer
    longPressTimerRef.current = setTimeout(() => {
        if (navigator.vibrate) navigator.vibrate(50);
        onDeleteTransaction(id);
        // Clear refs after triggering
        longPressTimerRef.current = null;
        pointerStartPosRef.current = null;
    }, 600);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    // If we have a timer and a start position, check distance
    if (longPressTimerRef.current && pointerStartPosRef.current) {
        const moveX = Math.abs(e.clientX - pointerStartPosRef.current.x);
        const moveY = Math.abs(e.clientY - pointerStartPosRef.current.y);
        
        // If moved more than 10px, it's a scroll/drag, cancel long press
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

  const handlePrev = () => {
    const newDate = new Date(selectedDate);
    if (viewRange === 'day') newDate.setDate(newDate.getDate() - 1);
    if (viewRange === 'month') newDate.setMonth(newDate.getMonth() - 1);
    if (viewRange === 'year') newDate.setFullYear(newDate.getFullYear() - 1);
    setSelectedDate(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(selectedDate);
    if (viewRange === 'day') newDate.setDate(newDate.getDate() + 1);
    if (viewRange === 'month') newDate.setMonth(newDate.getMonth() + 1);
    if (viewRange === 'year') newDate.setFullYear(newDate.getFullYear() + 1);
    setSelectedDate(newDate);
  };

  const isCurrentTime = useMemo(() => {
    const now = new Date();
    if (viewRange === 'year') return selectedDate.getFullYear() === now.getFullYear();
    if (viewRange === 'month') return selectedDate.getMonth() === now.getMonth() && selectedDate.getFullYear() === now.getFullYear();
    return selectedDate.toDateString() === now.toDateString();
  }, [selectedDate, viewRange]);
  
  // Filter transactions based on range
  const filteredData = useMemo(() => {
    const y = selectedDate.getFullYear();
    const m = selectedDate.getMonth();
    const d = selectedDate.getDate();

    return transactions.filter(t => {
      const tDate = new Date(t.date);
      if (viewRange === 'year') return tDate.getFullYear() === y;
      if (viewRange === 'month') return tDate.getFullYear() === y && tDate.getMonth() === m;
      if (viewRange === 'day') return tDate.getFullYear() === y && tDate.getMonth() === m && tDate.getDate() === d;
      return false;
    });
  }, [transactions, selectedDate, viewRange]);

  // For Charts & Totals: Only Expenses
  const expenseData = useMemo(() => filteredData.filter(t => t.type === 'expense'), [filteredData]);
  
  // For List: All transactions sorted by date desc
  const listData = useMemo(() => {
    return [...filteredData].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [filteredData]);

  const totalExpense = useMemo(() => {
    return expenseData.reduce((sum, t) => sum + t.amount, 0);
  }, [expenseData]);

  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    expenseData.forEach(t => {
      const current = map.get(t.categoryId) || 0;
      map.set(t.categoryId, current + t.amount);
    });

    return Array.from(map.entries())
      .map(([id, value]) => {
        const cat = categories.find(c => c.id === id);
        return {
          name: cat?.name || 'Unknown',
          value,
          color: cat?.color || '#ccc',
          id
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [expenseData, categories]);

  const getCategory = (id: string) => categories.find(c => c.id === id);

  const dateLabel = useMemo(() => {
    if (viewRange === 'year') return `${selectedDate.getFullYear()}年`;
    if (viewRange === 'month') return selectedDate.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' });
    return selectedDate.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' });
  }, [selectedDate, viewRange]);

  const rangeLabel = useMemo(() => {
     switch(viewRange) {
         case 'day': return '今日支出';
         case 'month': return '本月支出';
         case 'year': return '本年支出';
     }
  }, [viewRange]);

  return (
    <div className="flex flex-col h-full bg-transparent relative">
      <DatePickerModal 
        isOpen={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        onSelect={setSelectedDate}
        currentDate={selectedDate}
        mode={viewRange}
      />

      {/* Header */}
      <div 
        className="bg-primary/90 backdrop-blur-md pt-8 pb-16 px-6 rounded-b-[2.5rem] shadow-lg text-white relative z-10 border-b border-white/10 transition-all duration-300"
      >
        {/* Top Controls */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex bg-black/10 rounded-lg p-1 backdrop-blur-sm">
             {(['day', 'month', 'year'] as const).map(r => (
                 <button
                    key={r}
                    onClick={() => setViewRange(r)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${viewRange === r ? 'bg-white text-primary shadow-sm' : 'text-white/70 hover:bg-white/10'}`}
                 >
                    {r === 'day' ? '日' : r === 'month' ? '月' : '年'}
                 </button>
             ))}
          </div>
          
          <div className="flex gap-2">
            <button 
                onClick={(e) => { e.stopPropagation(); onTripClick?.(); }}
                className="bg-white/20 hover:bg-white/30 p-2 rounded-full transition-colors flex items-center gap-1 px-3 backdrop-blur-sm"
                title="旅行账本"
              >
                <Plane size={14} className="text-white" />
            </button>
            <button 
                onClick={(e) => { e.stopPropagation(); onCompareClick?.(); }}
                className="bg-white/20 hover:bg-white/30 p-2 rounded-full transition-colors flex items-center gap-1 px-3 backdrop-blur-sm"
                title="账单对比"
              >
                <BarChart2 size={14} className="text-white" />
            </button>
            <button 
                onClick={(e) => { e.stopPropagation(); onFortuneClick(); }}
                className="bg-white/20 hover:bg-white/30 p-2 rounded-full transition-colors flex items-center gap-1 px-3 backdrop-blur-sm"
              >
                <MoonStar size={14} className="text-yellow-200" />
                <span className="text-xs">运势</span>
            </button>
          </div>
        </div>

        {/* Amount & Date Block */}
        <div className="flex flex-col mb-2">
            
            <div 
               onClick={onStatsClick}
               className="text-sm opacity-80 flex items-center gap-1 cursor-pointer active:opacity-70 transition-opacity mb-1"
             >
                {rangeLabel}
                <ChevronRight size={14} className="opacity-70" />
            </div>

            <div className="flex justify-between items-end w-full">
                {/* Amount */}
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-medium opacity-90">¥</span>
                  <span className="text-5xl font-bold tracking-tight">{totalExpense.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                </div>

                {/* Big Visible Date Picker Button */}
                <div className="flex items-center gap-1 bg-white/10 rounded-xl p-1 backdrop-blur-md border border-white/10 mb-1">
                    <button onClick={handlePrev} className="p-2 hover:bg-white/10 rounded-lg active:scale-90 transition-transform">
                        <ChevronLeft size={18}/>
                    </button>
                    
                    <button 
                        onClick={() => setShowDatePicker(true)}
                        className="relative px-2 py-1 min-w-[100px] text-center group cursor-pointer rounded-lg hover:bg-white/5 transition-colors"
                    >
                        <div className="flex items-center justify-center gap-2">
                            <Calendar size={16} className="opacity-80"/>
                            <span className="font-bold text-lg">{dateLabel}</span>
                        </div>
                        <div className="text-[10px] opacity-60 font-medium -mt-1 group-hover:opacity-100 transition-opacity">
                            点击选择
                        </div>
                    </button>

                    <button onClick={handleNext} className="p-2 hover:bg-white/10 rounded-lg active:scale-90 transition-transform">
                        <ChevronRight size={18}/>
                    </button>
                </div>
            </div>
        </div>

        {/* Insight Bubble */}
        {insight && viewRange === 'month' && isCurrentTime && (
           <div className="mt-2 text-sm bg-white/10 p-3 rounded-xl backdrop-blur-sm border border-white/10 flex gap-2 items-start animate-fade-in">
             <span className="text-yellow-300 mt-0.5">✨</span>
             <span className="opacity-90">{insight}</span>
           </div>
        )}
      </div>

      {/* Content Scrollable Area */}
      <div className="flex-1 overflow-y-auto no-scrollbar -mt-8 px-4 pb-24">
        
        {/* Chart Card */}
        {categoryBreakdown.length > 0 ? (
        <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-sm p-4 mb-4 border border-white/40">
          <h2 className="text-gray-500 text-sm font-medium mb-2 flex items-center gap-1">
             <Filter size={12} />
             {viewRange === 'year' ? '年度' : viewRange === 'month' ? '月度' : '当日'}分类占比
          </h2>
          <div className="h-48 w-full flex items-center">
            <ResponsiveContainer width="50%" height="100%">
              <PieChart>
                <Pie
                  data={categoryBreakdown}
                  innerRadius={40}
                  outerRadius={60}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {categoryBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `¥${value}`} />
              </PieChart>
            </ResponsiveContainer>
            <div className="w-1/2 pl-2 space-y-2">
              {categoryBreakdown.slice(0, 3).map(item => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{backgroundColor: item.color}}></div>
                    <span className="text-gray-600 truncate w-20">{item.name}</span>
                  </div>
                  <span className="font-medium text-gray-800">¥{item.value.toFixed(0)}</span>
                </div>
              ))}
              {categoryBreakdown.length > 3 && (
                 <div className="text-xs text-gray-400 pl-4">+ {categoryBreakdown.length - 3} 更多</div>
              )}
            </div>
          </div>
        </div>
        ) : (
          <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-sm p-8 mb-4 flex flex-col items-center justify-center text-gray-400 border border-white/40">
             <p>{viewRange === 'day' && isCurrentTime ? '今日暂无支出' : '该时间段无支出记录'}</p>
             {isCurrentTime && <button onClick={onAddClick} className="mt-2 text-primary text-sm font-medium">记一笔</button>}
          </div>
        )}

        {/* Transaction List */}
        <div className="flex items-center justify-between mb-2 px-2 shadow-black drop-shadow-sm">
            <h2 className="text-gray-600 text-sm font-medium">
                {viewRange === 'day' ? '当日' : viewRange === 'year' ? '年度' : '本月'}交易 ({listData.length})
            </h2>
            <span className="text-[10px] text-gray-400">长按可删除</span>
        </div>
        
        <div className="space-y-3">
          {listData.length > 0 ? listData.map(t => {
            const cat = getCategory(t.categoryId);
            return (
              <div 
                key={t.id} 
                className="bg-white/80 backdrop-blur-md p-3 rounded-xl shadow-sm flex items-center gap-3 active:scale-[0.99] transition-transform border border-white/40 select-none cursor-pointer touch-pan-y"
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
                  <div className="flex justify-between text-xs text-gray-500 mt-0.5">
                    <span>{new Date(t.date).toLocaleDateString()} {new Date(t.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                    <span>{cat?.name}</span>
                  </div>
                </div>
              </div>
            );
          }) : (
             <div className="text-center text-gray-400 text-xs py-4">无交易记录</div>
          )}
        </div>
      </div>

      {/* Floating Action Buttons */}
      <div className="absolute bottom-24 right-6 flex flex-col items-center gap-4 z-20">
        <button 
            onClick={onSmartAddClick}
            className="w-12 h-12 bg-white text-emerald-600 rounded-full shadow-lg flex items-center justify-center active:scale-90 transition-transform border border-emerald-100"
            title="微信/支付宝 智能导入"
        >
            <Sparkles size={20} />
        </button>
        <button 
            onClick={onAddClick}
            className="w-14 h-14 bg-primary text-white rounded-full shadow-xl shadow-primary/40 flex items-center justify-center active:scale-90 transition-transform"
        >
            <Plus size={28} />
        </button>
      </div>
    </div>
  );
};

export default Dashboard;