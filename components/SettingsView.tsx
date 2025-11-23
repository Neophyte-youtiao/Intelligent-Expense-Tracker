import React, { useRef, useState } from 'react';
import { Category } from '../types';
import { DynamicIcon } from './Icons';
import { Image, ChevronRight, Tags, ArrowLeft, Trash2, Upload, Loader2 } from 'lucide-react';

interface SettingsViewProps {
  categories: Category[];
  onManageCategories: () => void;
  onSetBackground: (dataUrl: string | null) => void;
  currentBackground: string | null;
  onClose: () => void;
}

// Image compression helper
const compressImage = (file: File, maxWidth: number = 1080, quality: number = 0.7): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new window.Image();
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
            resolve(event.target?.result as string);
            return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = (err) => resolve(event.target?.result as string);
    };
    reader.onerror = (err) => reject(err);
  });
};

const SettingsView: React.FC<SettingsViewProps> = ({ 
  categories, 
  onManageCategories, 
  onSetBackground, 
  currentBackground,
  onClose 
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLoading(true);
      try {
        const compressed = await compressImage(file);
        onSetBackground(compressed);
      } catch (err) {
        alert("背景图片处理失败，请重试");
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-white/80 backdrop-blur-xl">
       <div className="px-4 py-4 flex items-center shadow-sm sticky top-0 z-10 bg-white/50 backdrop-blur-md">
           <button onClick={onClose} className="text-gray-600 mr-2 p-1 rounded-full hover:bg-black/5">
             <ArrowLeft size={22} />
           </button>
           <h1 className="text-lg font-bold flex-1 text-gray-800">设置 & 个性化</h1>
       </div>

       <div className="flex-1 overflow-y-auto p-4 space-y-6">
          
          {/* Background Section */}
          <section>
            <h2 className="text-xs font-bold text-gray-500 uppercase mb-3 ml-1">外观</h2>
            <div className="bg-white/60 rounded-2xl p-4 shadow-sm border border-white/40">
               <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                     <div className="bg-blue-100 text-blue-600 p-2 rounded-lg">
                        <Image size={20} />
                     </div>
                     <div>
                        <h3 className="font-medium text-gray-800">自定义背景</h3>
                        <p className="text-xs text-gray-500">从相册上传照片</p>
                     </div>
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*" 
                    onChange={handleFileChange}
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loading}
                    className="bg-gray-900 text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 active:scale-95 transition-transform disabled:opacity-50"
                  >
                    {loading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} 
                    {loading ? '处理中' : '更换'}
                  </button>
               </div>

               {currentBackground && (
                 <div className="relative w-full h-32 rounded-xl overflow-hidden group">
                    <img src={currentBackground} className="w-full h-full object-cover" alt="Preview" />
                    <button 
                      onClick={() => onSetBackground(null)}
                      className="absolute top-2 right-2 bg-red-500/80 text-white p-1.5 rounded-full shadow-lg backdrop-blur-sm"
                    >
                      <Trash2 size={14} />
                    </button>
                 </div>
               )}
            </div>
          </section>

          {/* Categories Section */}
          <section>
            <h2 className="text-xs font-bold text-gray-500 uppercase mb-3 ml-1">记账配置</h2>
            <button 
              onClick={onManageCategories}
              className="w-full bg-white/60 rounded-2xl p-4 shadow-sm border border-white/40 flex items-center justify-between active:bg-white/40 transition-colors"
            >
               <div className="flex items-center gap-3">
                  <div className="bg-emerald-100 text-emerald-600 p-2 rounded-lg">
                     <Tags size={20} />
                  </div>
                  <div className="text-left">
                     <h3 className="font-medium text-gray-800">分类管理</h3>
                     <p className="text-xs text-gray-500">{categories.length} 个分类</p>
                  </div>
               </div>
               <ChevronRight size={20} className="text-gray-400" />
            </button>
          </section>

       </div>
    </div>
  );
};

export default SettingsView;