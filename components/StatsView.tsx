import React, { useState, useMemo } from 'react';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell 
} from 'recharts';
import { Transaction } from '../types';
import { ArrowLeft, ChevronLeft, ChevronRight, BarChart2, TrendingUp } from 'lucide-react';

interface StatsViewProps {
  transactions: Transaction[];
  onBack: () => void;
}

type TimeRange = 'month' | 'year';
type ChartType = 'bar' | 'line';

const StatsView: React.FC<StatsViewProps> = ({ transactions, onBack }) => {
  const [range, setRange] = useState<TimeRange>('month');
  const [chartType, setChartType] = useState<ChartType>('line');
  const [currentDate, setCurrentDate] = useState(new Date());

  // Helper to change date
  const handlePrev = () => {
    const newDate = new Date(currentDate);
    if (range === 'month') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setFullYear(newDate.getFullYear() - 1);
    }
    setCurrentDate(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(currentDate);
    if (range === 'month') {
      newDate.setMonth(newDate.getMonth() + 1);
    } else {
      newDate.setFullYear(newDate.getFullYear() + 1);
    }
    setCurrentDate(newDate);
  };

  // Prepare Data
  const chartData = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const data = [];

    // Filter only expenses
    const expenses = transactions.filter(t => t.type === 'expense');

    if (range === 'month') {
      // Daily breakdown for the month
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const dailyMap = new Map<number, number>();

      expenses.forEach(t => {
        const tDate = new Date(t.date);
        if (tDate.getFullYear() === year && tDate.getMonth() === month) {
          const day = tDate.getDate();
          dailyMap.set(day, (dailyMap.get(day) || 0) + t.amount);
        }
      });

      for (let i = 1; i <= daysInMonth; i++) {
        data.push({
          label: `${i}日`,
          key: i,
          amount: dailyMap.get(i) || 0
        });
      }
    } else {
      // Monthly breakdown for the year
      const monthlyMap = new Map<number, number>();

      expenses.forEach(t => {
        const tDate = new Date(t.date);
        if (tDate.getFullYear() === year) {
          const m = tDate.getMonth();
          monthlyMap.set(m, (monthlyMap.get(m) || 0) + t.amount);
        }
      });

      for (let i = 0; i < 12; i++) {
        data.push({
          label: `${i + 1}月`,
          key: i,
          amount: monthlyMap.get(i) || 0
        });
      }
    }

    return data;
  }, [transactions, currentDate, range]);

  const totalAmount = useMemo(() => chartData.reduce((sum, item) => sum + item.amount, 0), [chartData]);
  const maxAmount = useMemo(() => Math.max(...chartData.map(d => d.amount), 100), [chartData]);

  // Display Title
  const title = range === 'month' 
    ? `${currentDate.getFullYear()}年 ${currentDate.getMonth() + 1}月`
    : `${currentDate.getFullYear()}年`;

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white px-4 py-4 flex items-center shadow-sm sticky top-0 z-10 justify-between">
        <button onClick={onBack} className="text-gray-500 p-2 -ml-2 hover:bg-gray-100 rounded-full">
          <ArrowLeft size={22} />
        </button>
        
        {/* Date Switcher */}
        <div className="flex items-center gap-2 bg-gray-100 rounded-full px-1 py-1">
           <button onClick={() => setRange('month')} className={`px-4 py-1 rounded-full text-xs font-medium transition-all ${range === 'month' ? 'bg-white shadow text-primary' : 'text-gray-500'}`}>
             月视图
           </button>
           <button onClick={() => setRange('year')} className={`px-4 py-1 rounded-full text-xs font-medium transition-all ${range === 'year' ? 'bg-white shadow text-primary' : 'text-gray-500'}`}>
             年视图
           </button>
        </div>

        <button 
          onClick={() => setChartType(prev => prev === 'line' ? 'bar' : 'line')}
          className="text-gray-500 p-2 hover:bg-gray-100 rounded-full"
        >
           {chartType === 'line' ? <BarChart2 size={22} /> : <TrendingUp size={22} />}
        </button>
      </div>

      {/* Date Navigation & Total */}
      <div className="bg-white pb-6 pt-2 px-6 flex flex-col items-center border-b border-gray-100">
         <div className="flex items-center gap-4 mb-2">
            <button onClick={handlePrev} className="p-1 text-gray-400 hover:text-gray-600"><ChevronLeft size={20}/></button>
            <span className="font-semibold text-lg">{title}</span>
            <button onClick={handleNext} className="p-1 text-gray-400 hover:text-gray-600"><ChevronRight size={20}/></button>
         </div>
         <div className="text-gray-500 text-xs mb-1">总支出</div>
         <div className="text-3xl font-bold text-gray-900">¥{totalAmount.toLocaleString()}</div>
      </div>

      {/* Chart Area */}
      <div className="bg-white mt-3 p-4 h-64 shadow-sm w-full">
         <ResponsiveContainer width="100%" height="100%">
            {chartType === 'line' ? (
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="label" tick={{fontSize: 10, fill: '#9ca3af'}} axisLine={false} tickLine={false} interval={range === 'month' ? 4 : 1} />
                <YAxis tick={{fontSize: 10, fill: '#9ca3af'}} axisLine={false} tickLine={false} />
                <Tooltip 
                    contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} 
                    formatter={(value: number) => [`¥${value}`, '支出']}
                />
                <Line type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={3} dot={false} activeDot={{r: 6}} />
              </LineChart>
            ) : (
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                 <XAxis dataKey="label" tick={{fontSize: 10, fill: '#9ca3af'}} axisLine={false} tickLine={false} interval={range === 'month' ? 4 : 1} />
                 <YAxis tick={{fontSize: 10, fill: '#9ca3af'}} axisLine={false} tickLine={false} />
                 <Tooltip 
                    cursor={{fill: '#f9fafb'}}
                    contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} 
                    formatter={(value: number) => [`¥${value}`, '支出']}
                />
                 <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.amount > 0 ? '#10b981' : '#e5e7eb'} />
                    ))}
                 </Bar>
              </BarChart>
            )}
         </ResponsiveContainer>
      </div>

      {/* Data List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
         <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">详细数据</h3>
         {[...chartData].reverse().map((item) => {
             if (item.amount === 0) return null;
             return (
               <div key={item.key} className="flex justify-between items-center bg-white p-3 rounded-xl border border-gray-100">
                  <span className="text-gray-600 font-medium">{item.label}</span>
                  <div className="flex items-center gap-3">
                     <div className="h-1.5 rounded-full bg-emerald-100 w-16 overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 rounded-full" 
                          style={{width: `${(item.amount / maxAmount) * 100}%`}}
                        ></div>
                     </div>
                     <span className="font-bold text-gray-800 w-16 text-right">¥{item.amount.toFixed(0)}</span>
                  </div>
               </div>
             )
         })}
      </div>
    </div>
  );
};

export default StatsView;