import React, { useState, useMemo } from 'react';
import { Transaction } from '../types';
import { ArrowLeft, Plus, Trash2, Calendar, TrendingUp, DollarSign, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import DatePickerModal from './DatePickerModal';

interface CompareViewProps {
  transactions: Transaction[];
  onBack: () => void;
}

interface CompareGroup {
  id: string;
  name: string;
  selectedDates: Date[];
  color: string;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6'];

const CompareView: React.FC<CompareViewProps> = ({ transactions, onBack }) => {
  const [groups, setGroups] = useState<CompareGroup[]>([
    { id: '1', name: '组别 A', selectedDates: [], color: COLORS[0] },
    { id: '2', name: '组别 B', selectedDates: [], color: COLORS[1] }
  ]);
  
  // Date Picker State
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

  const handleAddGroup = () => {
    if (groups.length >= 5) return;
    const newId = Date.now().toString();
    setGroups([...groups, { 
      id: newId, 
      name: `组别 ${String.fromCharCode(65 + groups.length)}`, 
      selectedDates: [],
      color: COLORS[groups.length % COLORS.length]
    }]);
  };

  const handleRemoveGroup = (id: string) => {
    if (groups.length <= 1) return;
    setGroups(groups.filter(g => g.id !== id));
  };

  const handleUpdateDates = (dates: Date[]) => {
    if (activeGroupId) {
      setGroups(groups.map(g => g.id === activeGroupId ? { ...g, selectedDates: dates } : g));
      setActiveGroupId(null);
    }
  };

  // Calculation Logic
  const chartData = useMemo(() => {
    return groups.map((group, index) => {
      let total = 0;
      let maxTransaction = 0;
      let count = 0;
      
      const dateStrings = new Set(group.selectedDates.map(d => d.toDateString()));

      transactions.forEach(t => {
        if (t.type === 'expense' && dateStrings.has(new Date(t.date).toDateString())) {
          total += t.amount;
          if (t.amount > maxTransaction) maxTransaction = t.amount;
          count++;
        }
      });

      const days = group.selectedDates.length || 1;
      const dailyAverage = total / days;
      const transAverage = count > 0 ? total / count : 0;

      return {
        name: group.name,
        amount: total,
        count: count,
        maxTransaction,
        dailyAverage,
        transAverage,
        color: group.color,
        index
      };
    });
  }, [groups, transactions]);

  // Calculate Growth/Diff relative to the first group (Baseline)
  const getComparisonStats = (currentAmount: number, index: number) => {
      if (index === 0) return { diff: 0, percent: 0, label: '基准' };
      const baseAmount = chartData[0].amount;
      if (baseAmount === 0) return { diff: 0, percent: 0, label: '-' };
      
      const diff = currentAmount - baseAmount;
      const percent = (diff / baseAmount) * 100;
      return { diff, percent, label: percent > 0 ? `+${percent.toFixed(1)}%` : `${percent.toFixed(1)}%` };
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <DatePickerModal 
         isOpen={!!activeGroupId}
         onClose={() => setActiveGroupId(null)}
         mode="day"
         multiSelect={true}
         selectedDates={groups.find(g => g.id === activeGroupId)?.selectedDates || []}
         onMultiSelect={handleUpdateDates}
         transactions={transactions}
      />

      {/* Header */}
      <div className="bg-white px-4 py-4 flex items-center shadow-sm sticky top-0 z-10 justify-between">
        <button onClick={onBack} className="text-gray-500 p-2 -ml-2 hover:bg-gray-100 rounded-full">
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-lg font-bold text-gray-800">多组深度对比</h1>
        <div className="w-8"></div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-20">
        
        {/* Chart */}
        <div className="bg-white p-4 rounded-2xl shadow-sm mb-6 border border-gray-100 h-64">
           <div className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">总支出对比</div>
           <ResponsiveContainer width="100%" height="100%">
             <BarChart data={chartData} margin={{top: 10, right: 10, left: -20, bottom: 0}}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="name" tick={{fontSize: 10, fill: '#9ca3af'}} axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9ca3af'}} />
                <Tooltip 
                    cursor={{fill: '#f9fafb'}}
                    contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)'}}
                    formatter={(val: number) => [`¥${val.toFixed(2)}`, '总支出']} 
                />
                <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
             </BarChart>
           </ResponsiveContainer>
        </div>

        {/* Detailed Metrics */}
        <div className="space-y-4">
           {groups.map((group, idx) => {
             const data = chartData[idx];
             const stats = getComparisonStats(data.amount, idx);
             
             return (
               <div key={group.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden transition-all">
                  <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{backgroundColor: group.color}}></div>
                  
                  {/* Card Header */}
                  <div className="p-4 border-b border-gray-50 flex justify-between items-start">
                     <div>
                        <div className="flex items-center gap-2 mb-1">
                            <input 
                                value={group.name}
                                onChange={(e) => setGroups(groups.map(g => g.id === group.id ? {...g, name: e.target.value} : g))}
                                className="font-bold text-lg text-gray-800 bg-transparent border-b border-dashed border-gray-300 focus:border-primary focus:outline-none w-32"
                            />
                            {idx > 0 && stats.diff !== 0 && (
                                <span className={`text-xs px-2 py-0.5 rounded font-bold flex items-center ${stats.diff > 0 ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500'}`}>
                                    <TrendingUp size={10} className={`mr-1 ${stats.diff < 0 ? 'rotate-180' : ''}`} />
                                    {stats.label}
                                </span>
                            )}
                            {idx === 0 && <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 rounded">基准</span>}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                             <Calendar size={12} />
                             {group.selectedDates.length} 天
                             <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                             {data.count} 笔
                        </div>
                     </div>

                     <div className="text-right">
                        <div className="text-xs text-gray-400 uppercase mb-0.5">总支出</div>
                        <div className="text-xl font-bold text-gray-900">¥{data.amount.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}</div>
                     </div>
                  </div>

                  {/* Actions & Dates */}
                  <div className="p-3 bg-gray-50/50 flex items-center justify-between border-b border-gray-50">
                        <div className="flex flex-wrap gap-1 max-w-[70%]">
                            {group.selectedDates.length > 0 ? group.selectedDates.slice(0, 3).map((d, i) => (
                                <span key={i} className="text-[10px] bg-white border border-gray-200 text-gray-500 px-1.5 py-0.5 rounded shadow-sm">
                                    {d.getMonth()+1}/{d.getDate()}
                                </span>
                            )) : <span className="text-[10px] text-gray-400">未选择日期</span>}
                            {group.selectedDates.length > 3 && (
                                <span className="text-[10px] text-gray-400 pt-0.5">+{group.selectedDates.length - 3}</span>
                            )}
                        </div>
                        <div className="flex gap-2">
                            {groups.length > 1 && (
                                <button onClick={() => handleRemoveGroup(group.id)} className="p-1.5 text-gray-400 hover:text-red-500 bg-white rounded-lg shadow-sm border border-gray-200">
                                    <Trash2 size={14} />
                                </button>
                            )}
                            <button onClick={() => setActiveGroupId(group.id)} className="px-3 py-1.5 bg-white text-primary text-xs font-medium rounded-lg shadow-sm border border-gray-200 active:scale-95 transition-transform">
                                选择日期
                            </button>
                        </div>
                  </div>

                  {/* Deep Analysis Grid */}
                  <div className="grid grid-cols-3 divide-x divide-gray-50">
                      <div className="p-3 text-center">
                          <div className="text-[10px] text-gray-400 mb-1">日均支出</div>
                          <div className="font-semibold text-gray-700 text-sm">¥{data.dailyAverage.toFixed(0)}</div>
                      </div>
                      <div className="p-3 text-center">
                          <div className="text-[10px] text-gray-400 mb-1">笔均支出</div>
                          <div className="font-semibold text-gray-700 text-sm">¥{data.transAverage.toFixed(0)}</div>
                      </div>
                      <div className="p-3 text-center bg-yellow-50/30">
                          <div className="text-[10px] text-yellow-600/70 mb-1">最大单笔</div>
                          <div className="font-bold text-yellow-600 text-sm">¥{data.maxTransaction.toFixed(0)}</div>
                      </div>
                  </div>
               </div>
             );
           })}
        </div>

        <button 
           onClick={handleAddGroup}
           className="w-full mt-6 py-4 border-2 border-dashed border-gray-300 rounded-2xl text-gray-400 font-medium flex items-center justify-center gap-2 hover:bg-white hover:border-primary hover:text-primary transition-all active:scale-[0.99]"
        >
           <Plus size={20} /> 添加新对比组
        </button>
      </div>
    </div>
  );
};

export default CompareView;