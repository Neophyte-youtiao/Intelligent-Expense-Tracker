import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import AddTransaction from './components/AddTransaction';
import CategoryManager from './components/CategoryManager';
import SettingsView from './components/SettingsView';
import StatsView from './components/StatsView';
import FortuneView from './components/FortuneView';
import DailyView from './components/DailyView';
import CompareView from './components/CompareView';
import TripView from './components/TripView';
import { Transaction, Category, ViewState, UserProfile, Trip } from './types';
import { DEFAULT_CATEGORIES } from './constants';
import { Home, Settings as SettingsIcon, AlertTriangle } from 'lucide-react';
import { getMonthlyInsight } from './services/geminiService';

// Helper for local storage
const useLocalStorage = <T,>(key: string, initialValue: T): [T, (value: T) => void] => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      return initialValue;
    }
  });

  const setValue = (value: T) => {
    try {
      // Allow value to be a function so we have same API as useState
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error: any) {
      console.error(error);
      if (error.name === 'QuotaExceededError') {
        alert("存储空间不足，无法保存数据。建议删除一些旧的旅行照片或清理浏览器缓存。");
      }
    }
  };

  return [storedValue, setValue];
};

function App() {
  const [view, setView] = useState<ViewState>('dashboard');
  const [addMode, setAddMode] = useState<'manual' | 'smart'>('manual');
  
  // UI State
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);

  // Data
  const [transactions, setTransactions] = useLocalStorage<Transaction[]>('transactions', []);
  const [categories, setCategories] = useLocalStorage<Category[]>('categories', DEFAULT_CATEGORIES);
  const [trips, setTrips] = useLocalStorage<Trip[]>('trips', []);
  const [monthlyInsight, setMonthlyInsight] = useState<string | undefined>(undefined);
  
  // Settings
  const [backgroundImg, setBackgroundImg] = useLocalStorage<string | null>('app_bg', null);
  const [userProfile, setUserProfile] = useLocalStorage<UserProfile>('user_profile', {
    birthDate: '',
    birthTime: '',
    gender: 'male',
    hasProfile: false
  });

  const handleAddClick = () => {
    setAddMode('manual');
    setView('add');
  };

  const handleSmartAddClick = () => {
    setAddMode('smart');
    setView('add');
  };

  const addTransaction = (newTransactions: Omit<Transaction, 'id'>[], mergeTargetId?: string) => {
    if (mergeTargetId && newTransactions.length === 1) {
        // Handle Merge/Offset Logic
        const newTrans = newTransactions[0];
        const offsetAmount = newTrans.amount;
        const notePrefix = newTrans.note ? `${newTrans.note} ` : '';

        // Find and update target
        const updatedTransactions = transactions.map(t => {
            if (t.id === mergeTargetId) {
                const newAmount = t.amount - offsetAmount;
                const offsetTypeStr = newTrans.type === 'income' ? '收入' : '支出';
                if (newAmount <= 0) {
                    // Fully offset (or more), mark as 0 or could delete. Keeping as 0 for history might be better, or delete.
                    // Let's create a new updated transaction
                    return { ...t, amount: 0, note: `${t.note} (已全额抵扣: ${offsetTypeStr} ${offsetAmount})` };
                } else {
                    return { ...t, amount: newAmount, note: `${t.note} (抵扣: ${offsetTypeStr} ${offsetAmount} ${notePrefix})` };
                }
            }
            return t;
        });

        const target = transactions.find(t => t.id === mergeTargetId);
        if (target && offsetAmount > target.amount) {
            const remainder = offsetAmount - target.amount;
            const remainderTrans = {
                ...newTrans,
                id: Date.now().toString(),
                amount: remainder,
                note: `${newTrans.note} (抵扣剩余)`
            };
            setTransactions([...updatedTransactions.filter(t => t.amount > 0), remainderTrans]);
        } else {
            setTransactions(updatedTransactions.filter(t => t.amount > 0)); 
        }

    } else {
        // Normal Add
        const timestamp = Date.now();
        const transactionsToAdd = newTransactions.map((t, index) => ({
            ...t,
            id: (timestamp + index).toString() // Ensure unique IDs for batch
        }));
        setTransactions([...transactions, ...transactionsToAdd]);
    }
  };

  // Trigger Delete Modal
  const requestDeleteTransaction = (id: string) => {
    setTransactionToDelete(id);
  };

  // Confirm Delete
  const confirmDelete = () => {
    if (transactionToDelete) {
        setTransactions(transactions.filter(t => t.id !== transactionToDelete));
        setTransactionToDelete(null);
    }
  };

  const addCategory = (c: Omit<Category, 'id'>) => {
    const newC = { ...c, id: Date.now().toString() };
    setCategories([...categories, newC]);
  };

  const deleteCategory = (id: string) => {
    if (confirm('确定删除该分类吗？已有的记账记录会保留。')) {
        setCategories(categories.filter(c => c.id !== id));
    }
  };

  // Trip CRUD
  const addTrip = (trip: Trip) => {
    setTrips([...trips, trip]);
  };

  const updateTrip = (trip: Trip) => {
    setTrips(trips.map(t => t.id === trip.id ? trip : t));
  };

  const deleteTrip = (id: string) => {
    if(confirm('确定删除这个旅行记录吗？账单数据不会被删除。')) {
        setTrips(trips.filter(t => t.id !== id));
    }
  };

  // Generate insight logic
  useEffect(() => {
    const currentMonthT = transactions.filter(t => {
        const d = new Date(t.date);
        const now = new Date();
        return d.getMonth() === now.getMonth() && t.type === 'expense';
    });

    if (currentMonthT.length > 0 && process.env.API_KEY) {
        const total = currentMonthT.reduce((sum, t) => sum + t.amount, 0);
        // Group by category name
        const catTotals: Record<string, number> = {};
        currentMonthT.forEach(t => {
            const catName = categories.find(c => c.id === t.categoryId)?.name || 'Other';
            catTotals[catName] = (catTotals[catName] || 0) + t.amount;
        });
        
        const breakdown = Object.entries(catTotals).map(([name, value]) => ({name, value}));
        
        if (!monthlyInsight) {
            getMonthlyInsight(total, breakdown).then(setMonthlyInsight);
        }
    }
  }, [transactions, categories]);


  const renderView = () => {
    switch (view) {
      case 'dashboard':
        return (
            <Dashboard 
                transactions={transactions} 
                categories={categories} 
                onAddClick={handleAddClick} 
                onSmartAddClick={handleSmartAddClick}
                onStatsClick={() => setView('stats')}
                onFortuneClick={() => setView('fortune')}
                onDailyClick={() => setView('daily')}
                onCompareClick={() => setView('compare')}
                onTripClick={() => setView('trips')}
                onDeleteTransaction={requestDeleteTransaction}
                insight={monthlyInsight} 
            />
        );
      case 'add':
        return (
            <AddTransaction 
                categories={categories} 
                onSave={addTransaction} 
                onClose={() => setView('dashboard')}
                initialSmartPaste={addMode === 'smart'}
                recentTransactions={transactions}
            />
        );
      case 'settings':
        return (
            <SettingsView 
                categories={categories}
                onManageCategories={() => setView('categories')}
                onSetBackground={setBackgroundImg}
                currentBackground={backgroundImg}
                onClose={() => setView('dashboard')}
            />
        );
      case 'categories':
        return (
            <CategoryManager 
                categories={categories} 
                onAddCategory={addCategory} 
                onDeleteCategory={deleteCategory} 
                onClose={() => setView('settings')} 
            />
        );
      case 'stats':
        return (
          <StatsView 
            transactions={transactions}
            onBack={() => setView('dashboard')}
          />
        );
      case 'compare':
        return (
            <CompareView
                transactions={transactions}
                onBack={() => setView('dashboard')}
            />
        );
      case 'fortune':
        return (
            <FortuneView
                userProfile={userProfile}
                onUpdateProfile={setUserProfile}
                onBack={() => setView('dashboard')}
            />
        );
      case 'daily':
        return (
            <DailyView
                transactions={transactions}
                categories={categories}
                onBack={() => setView('dashboard')}
                onDeleteTransaction={requestDeleteTransaction}
            />
        );
      case 'trips':
        return (
            <TripView
                trips={trips}
                transactions={transactions}
                categories={categories}
                onAddTrip={addTrip}
                onUpdateTrip={updateTrip}
                onDeleteTrip={deleteTrip}
                onBack={() => setView('dashboard')}
            />
        );
      default:
        return null;
    }
  };

  return (
    <div 
        className="max-w-md mx-auto h-full shadow-2xl relative flex flex-col overflow-hidden transition-all duration-500 bg-gray-50 bg-cover bg-center"
        style={backgroundImg ? { backgroundImage: `url(${backgroundImg})` } : {}}
    >
      
      {/* Main Content */}
      <div className="flex-1 overflow-hidden relative">
        {renderView()}
      </div>

      {/* Delete Confirmation Modal */}
      {transactionToDelete && (
        <div 
            className="fixed inset-0 z-50 flex items-end bg-black/40 backdrop-blur-sm animate-fade-in"
            onClick={() => setTransactionToDelete(null)}
        >
            <div 
                className="w-full bg-white rounded-t-3xl p-6 pb-10 shadow-2xl transform transition-transform"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex flex-col items-center mb-6">
                    <div className="w-12 h-1 bg-gray-200 rounded-full mb-6"></div>
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-500 mb-4">
                        <AlertTriangle size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-800 mb-2">删除账单</h3>
                    <p className="text-gray-500 text-sm text-center">确定要删除这条记录吗？<br/>此操作无法撤销。</p>
                </div>
                <div className="flex flex-col gap-3">
                    <button 
                        onClick={confirmDelete}
                        className="w-full py-4 bg-red-500 text-white font-bold rounded-2xl active:scale-[0.98] transition-transform shadow-lg shadow-red-500/30"
                    >
                        确认删除
                    </button>
                    <button 
                        onClick={() => setTransactionToDelete(null)}
                        className="w-full py-4 bg-gray-100 text-gray-700 font-bold rounded-2xl active:scale-[0.98] transition-transform"
                    >
                        取消
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Bottom Navigation */}
      {view === 'dashboard' && (
        <div className="bg-white/80 backdrop-blur-xl border-t border-white/20 px-6 py-3 flex justify-between items-center pb-6 absolute bottom-0 w-full z-10 shadow-lg">
          <button 
            onClick={() => setView('dashboard')}
            className="flex flex-col items-center gap-1 text-primary"
          >
            <Home size={24} strokeWidth={3} />
            <span className="text-[10px] font-medium">主页</span>
          </button>
          <button 
            onClick={() => setView('settings')}
            className="flex flex-col items-center gap-1 text-gray-400"
          >
            <SettingsIcon size={24} strokeWidth={2} />
            <span className="text-[10px] font-medium">设置</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default App;