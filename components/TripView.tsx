import React, { useState, useRef, useMemo } from 'react';
import { Trip, Transaction, Category } from '../types';
import { ArrowLeft, Plus, Calendar, MapPin, Image as ImageIcon, Trash2, X, Upload, Plane, ChevronRight, Loader2 } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { DynamicIcon } from './Icons';

interface TripViewProps {
  trips: Trip[];
  transactions: Transaction[];
  categories: Category[];
  onAddTrip: (trip: Trip) => void;
  onUpdateTrip: (trip: Trip) => void;
  onDeleteTrip: (id: string) => void;
  onBack: () => void;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#6366f1'];

// Image compression helper
const compressImage = (file: File, maxWidth: number = 800, quality: number = 0.6): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth) {
          height = (maxWidth / width) * height;
          width = maxWidth;
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            resolve(event.target?.result as string); // Fallback
            return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = (err) => resolve(event.target?.result as string); // Fallback
    };
    reader.onerror = (err) => reject(err);
  });
};

const TripView: React.FC<TripViewProps> = ({ 
  trips, transactions, categories, onAddTrip, onUpdateTrip, onDeleteTrip, onBack 
}) => {
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isProcessingImg, setIsProcessingImg] = useState(false);
  
  // Form State
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [coverImage, setCoverImage] = useState<string | undefined>(undefined);
  const [photos, setPhotos] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // --- Logic ---

  const handleCreateNew = () => {
    setTitle('');
    setStartDate(new Date().toISOString().split('T')[0]);
    setEndDate(new Date().toISOString().split('T')[0]);
    setCoverImage(undefined);
    setPhotos([]);
    setActiveTrip(null);
    setIsEditing(true);
  };

  const handleEditTrip = (trip: Trip) => {
    setActiveTrip(trip);
    setTitle(trip.title);
    setStartDate(trip.startDate);
    setEndDate(trip.endDate);
    setCoverImage(trip.coverImage);
    setPhotos(trip.photos || []);
    setIsEditing(true);
  };

  const handleSave = () => {
    if (!title || !startDate || !endDate) return alert("请填写完整信息");
    
    const newTrip: Trip = {
      id: activeTrip ? activeTrip.id : Date.now().toString(),
      title,
      startDate,
      endDate,
      coverImage,
      photos
    };

    if (activeTrip) {
      onUpdateTrip(newTrip);
    } else {
      onAddTrip(newTrip);
    }
    
    setIsEditing(false);
    setActiveTrip(null);
  };

  const handleDelete = () => {
    if (activeTrip) {
      onDeleteTrip(activeTrip.id);
      setActiveTrip(null);
      setIsEditing(false);
    }
  };

  // Image Handlers
  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsProcessingImg(true);
      try {
        const compressed = await compressImage(file, 800, 0.6);
        setCoverImage(compressed);
      } catch (err) {
        alert("图片处理失败");
      } finally {
        setIsProcessingImg(false);
      }
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setIsProcessingImg(true);
      try {
        const promises = Array.from(files).map(file => compressImage(file, 800, 0.6));
        const compressedImages = await Promise.all(promises);
        setPhotos(prev => [...prev, ...compressedImages]);
      } catch (err) {
        alert("部分图片处理失败");
      } finally {
        setIsProcessingImg(false);
      }
    }
  };

  // Stats Logic
  const getTripStats = (trip: Trip) => {
    const tripTrans = transactions.filter(t => {
      const d = t.date.split('T')[0];
      return t.type === 'expense' && d >= trip.startDate && d <= trip.endDate;
    });
    
    const total = tripTrans.reduce((sum, t) => sum + t.amount, 0);
    const days = Math.max(1, (new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime()) / (1000 * 3600 * 24) + 1);
    
    // Category Breakdown
    const catMap = new Map<string, number>();
    tripTrans.forEach(t => {
      catMap.set(t.categoryId, (catMap.get(t.categoryId) || 0) + t.amount);
    });
    
    const chartData = Array.from(catMap.entries()).map(([id, val]) => {
      const cat = categories.find(c => c.id === id);
      return { name: cat?.name || '未知', value: val, color: cat?.color };
    }).sort((a, b) => b.value - a.value);

    return { total, days, avg: total / days, chartData, list: tripTrans };
  };

  // --- Render ---

  // 1. Editor / Creator
  if (isEditing) {
    return (
      <div className="h-full flex flex-col bg-white">
        <div className="px-4 py-4 flex items-center justify-between border-b sticky top-0 bg-white z-10">
           <button onClick={() => setIsEditing(false)} className="text-gray-500">取消</button>
           <h1 className="font-bold text-lg">{activeTrip ? '编辑旅行' : '创建新旅行'}</h1>
           <button onClick={handleSave} className="text-primary font-bold" disabled={isProcessingImg}>保存</button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
           {/* Cover Image */}
           <div 
             className="w-full h-48 bg-gray-100 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden group cursor-pointer border-2 border-dashed border-gray-200"
             onClick={() => !isProcessingImg && fileInputRef.current?.click()}
           >
              {isProcessingImg ? (
                <Loader2 className="animate-spin text-gray-400" />
              ) : coverImage ? (
                <img src={coverImage} className="w-full h-full object-cover" alt="Cover" />
              ) : (
                <div className="text-gray-400 flex flex-col items-center">
                   <ImageIcon size={32} className="mb-2" />
                   <span className="text-xs">上传封面图</span>
                </div>
              )}
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleCoverUpload} />
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                 <span className="text-white text-sm font-medium">点击更换</span>
              </div>
           </div>

           <div className="space-y-4">
              <div>
                 <label className="block text-xs font-bold text-gray-400 uppercase mb-1">旅行名称</label>
                 <input 
                   value={title}
                   onChange={(e) => setTitle(e.target.value)}
                   className="w-full text-xl font-bold border-b border-gray-200 py-2 focus:outline-none focus:border-primary"
                   placeholder="例如：云南七日游"
                 />
              </div>
              <div className="flex gap-4">
                 <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">开始日期</label>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-gray-50 p-3 rounded-xl" />
                 </div>
                 <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">结束日期</label>
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full bg-gray-50 p-3 rounded-xl" />
                 </div>
              </div>
           </div>

           {/* Photos */}
           <div>
              <div className="flex justify-between items-center mb-2">
                 <label className="text-xs font-bold text-gray-400 uppercase">相册回忆</label>
                 <button onClick={() => photoInputRef.current?.click()} className="text-primary text-xs flex items-center gap-1 font-medium" disabled={isProcessingImg}>
                    {isProcessingImg ? <Loader2 size={14} className="animate-spin"/> : <Plus size={14} />} 添加照片
                 </button>
                 <input type="file" ref={photoInputRef} className="hidden" accept="image/*" multiple onChange={handlePhotoUpload} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                 {photos.map((p, idx) => (
                    <div key={idx} className="aspect-square rounded-xl overflow-hidden relative group">
                       <img src={p} className="w-full h-full object-cover" />
                       <button 
                         onClick={() => setPhotos(photos.filter((_, i) => i !== idx))}
                         className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                       >
                         <X size={12} />
                       </button>
                    </div>
                 ))}
                 <button 
                   onClick={() => photoInputRef.current?.click()}
                   disabled={isProcessingImg}
                   className="aspect-square rounded-xl bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors disabled:opacity-50"
                 >
                    {isProcessingImg ? <Loader2 className="animate-spin" /> : <Upload size={20} />}
                 </button>
              </div>
              <p className="text-[10px] text-gray-400 mt-2">提示：为节省空间，图片会被自动压缩。</p>
           </div>

           {activeTrip && (
             <button onClick={handleDelete} className="w-full py-3 text-red-500 bg-red-50 rounded-xl font-medium flex items-center justify-center gap-2 mt-8">
               <Trash2 size={18} /> 删除此旅行记录
             </button>
           )}
        </div>
      </div>
    );
  }

  // 2. Detail View
  if (activeTrip) {
    const stats = getTripStats(activeTrip);

    return (
      <div className="h-full flex flex-col bg-gray-50">
        {/* Hero Header */}
        <div className="relative h-64 w-full shrink-0">
           {activeTrip.coverImage ? (
             <img src={activeTrip.coverImage} className="w-full h-full object-cover" />
           ) : (
             <div className="w-full h-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center">
                <Plane size={64} className="text-white/30" />
             </div>
           )}
           <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
           
           <div className="absolute top-4 left-4 z-10">
              <button onClick={() => setActiveTrip(null)} className="p-2 bg-black/20 text-white rounded-full backdrop-blur-md hover:bg-black/40">
                <ArrowLeft size={24} />
              </button>
           </div>
           
           <div className="absolute bottom-6 left-6 text-white z-10">
              <h1 className="text-3xl font-bold mb-1 shadow-sm">{activeTrip.title}</h1>
              <div className="flex items-center gap-2 text-sm opacity-90">
                 <Calendar size={14} />
                 {activeTrip.startDate} ~ {activeTrip.endDate}
                 <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs ml-2">{Math.floor(stats.days)} 天</span>
              </div>
           </div>

           <button 
             onClick={() => handleEditTrip(activeTrip)}
             className="absolute bottom-6 right-6 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white px-3 py-1.5 rounded-lg text-xs font-medium border border-white/20"
           >
             编辑
           </button>
        </div>

        <div className="flex-1 overflow-y-auto -mt-4 rounded-t-3xl bg-gray-50 relative z-10 p-4 space-y-4">
           
           {/* Summary Cards */}
           <div className="grid grid-cols-2 gap-3">
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                 <p className="text-xs text-gray-400 mb-1">总花费</p>
                 <p className="text-2xl font-bold text-gray-900">¥{stats.total.toLocaleString()}</p>
              </div>
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                 <p className="text-xs text-gray-400 mb-1">日均消费</p>
                 <p className="text-xl font-bold text-gray-900">¥{stats.avg.toFixed(0)}</p>
              </div>
           </div>

           {/* Chart */}
           {stats.chartData.length > 0 && (
             <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center">
                <div className="w-1/2 h-32">
                   <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                         <Pie data={stats.chartData} innerRadius={30} outerRadius={50} paddingAngle={2} dataKey="value">
                            {stats.chartData.map((entry, index) => (
                               <Cell key={index} fill={entry.color || COLORS[index % COLORS.length]} />
                            ))}
                         </Pie>
                         <Tooltip formatter={(val: number) => `¥${val}`} />
                      </PieChart>
                   </ResponsiveContainer>
                </div>
                <div className="w-1/2 space-y-1">
                   {stats.chartData.slice(0, 4).map((item, idx) => (
                      <div key={idx} className="flex justify-between text-xs">
                         <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full" style={{backgroundColor: item.color || COLORS[idx]}}></span>
                            {item.name}
                         </span>
                         <span className="font-medium">¥{item.value}</span>
                      </div>
                   ))}
                </div>
             </div>
           )}

           {/* Photos */}
           {activeTrip.photos && activeTrip.photos.length > 0 && (
              <div>
                 <h3 className="font-bold text-gray-700 mb-2 text-sm flex items-center gap-1"><ImageIcon size={16}/> 旅途剪影</h3>
                 <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {activeTrip.photos.map((p, idx) => (
                       <img key={idx} src={p} className="h-24 w-24 object-cover rounded-xl shrink-0 shadow-sm" />
                    ))}
                 </div>
              </div>
           )}

           {/* Transactions */}
           <div>
              <h3 className="font-bold text-gray-700 mb-2 text-sm">账单明细 ({stats.list.length})</h3>
              <div className="space-y-2">
                 {stats.list.length > 0 ? stats.list.map(t => {
                   const cat = categories.find(c => c.id === t.categoryId);
                   return (
                     <div key={t.id} className="bg-white p-3 rounded-xl flex items-center justify-between border border-gray-100">
                        <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-50 text-gray-500">
                              <DynamicIcon name={cat?.icon || 'MoreHorizontal'} size={16} />
                           </div>
                           <div>
                              <p className="text-sm font-medium text-gray-800">{t.note || cat?.name}</p>
                              <p className="text-xs text-gray-400">{t.date.split('T')[0]}</p>
                           </div>
                        </div>
                        <span className="font-bold text-gray-900">¥{t.amount}</span>
                     </div>
                   );
                 }) : (
                   <p className="text-center text-gray-400 text-xs py-4">暂无账单，请在记账时确保日期在旅行范围内。</p>
                 )}
              </div>
           </div>
        </div>
      </div>
    );
  }

  // 3. List View (Default)
  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="bg-white px-4 py-4 flex items-center shadow-sm sticky top-0 z-10 justify-between">
        <button onClick={onBack} className="text-gray-500 p-2 -ml-2 hover:bg-gray-100 rounded-full">
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-lg font-bold text-gray-800">旅行账本</h1>
        <button onClick={handleCreateNew} className="text-primary p-2 hover:bg-primary/10 rounded-full">
           <Plus size={24} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
         {trips.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
               <Plane size={48} className="mb-4 opacity-20" />
               <p>还没有旅行记录</p>
               <button onClick={handleCreateNew} className="mt-4 text-primary font-medium">创建第一个旅行</button>
            </div>
         ) : (
            trips.map(trip => {
               const stats = getTripStats(trip);
               return (
                  <div 
                    key={trip.id} 
                    onClick={() => setActiveTrip(trip)}
                    className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer group active:scale-[0.98] transition-transform"
                  >
                     <div className="h-32 bg-gray-200 relative">
                        {trip.coverImage ? (
                           <img src={trip.coverImage} className="w-full h-full object-cover" />
                        ) : (
                           <div className="w-full h-full bg-gradient-to-r from-blue-400 to-indigo-500 flex items-center justify-center">
                              <Plane className="text-white/30" size={40} />
                           </div>
                        )}
                        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors"></div>
                        <div className="absolute bottom-3 left-3 text-white">
                           <h3 className="font-bold text-xl drop-shadow-md">{trip.title}</h3>
                           <p className="text-xs opacity-90 flex items-center gap-1">
                              <Calendar size={10} /> {trip.startDate} ~ {trip.endDate}
                           </p>
                        </div>
                     </div>
                     <div className="p-4 flex justify-between items-center">
                        <div>
                           <p className="text-xs text-gray-400">总花费</p>
                           <p className="text-lg font-bold text-gray-900">¥{stats.total.toLocaleString()}</p>
                        </div>
                        <div className="flex items-center gap-2">
                           {trip.photos && trip.photos.length > 0 && (
                              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full flex items-center gap-1">
                                 <ImageIcon size={10}/> {trip.photos.length}
                              </span>
                           )}
                           <ChevronRight className="text-gray-300" size={20} />
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

export default TripView;