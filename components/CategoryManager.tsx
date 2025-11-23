import React, { useState } from 'react';
import { Category } from '../types';
import { DynamicIcon, IconMap } from './Icons';
import { Trash2, Plus } from 'lucide-react';

interface CategoryManagerProps {
  categories: Category[];
  onAddCategory: (c: Omit<Category, 'id'>) => void;
  onDeleteCategory: (id: string) => void;
  onClose: () => void;
}

const CategoryManager: React.FC<CategoryManagerProps> = ({ categories, onAddCategory, onDeleteCategory, onClose }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('MoreHorizontal');
  const [selectedColor, setSelectedColor] = useState('#10b981');

  const iconKeys = Object.keys(IconMap).slice(0, 12); // Show subset
  const colors = ['#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6', '#10b981', '#ec4899', '#6366f1', '#14b8a6'];

  const handleAdd = () => {
    if (!newCatName) return;
    onAddCategory({
      name: newCatName,
      icon: selectedIcon,
      color: selectedColor,
      type: 'expense' // Default to expense for simplicity
    });
    setIsAdding(false);
    setNewCatName('');
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
       <div className="bg-white px-4 py-4 flex items-center shadow-sm sticky top-0 z-10">
           <button onClick={onClose} className="text-gray-500 mr-4">Back</button>
           <h1 className="text-lg font-bold flex-1">Manage Categories</h1>
           <button onClick={() => setIsAdding(true)} className="text-primary font-medium flex items-center gap-1">
              <Plus size={18}/> Add
           </button>
       </div>

       <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {isAdding && (
                <div className="bg-white p-4 rounded-2xl shadow-md mb-4 animate-fade-in">
                    <h3 className="font-bold text-gray-800 mb-3">New Category</h3>
                    <input 
                        className="w-full border-b-2 border-gray-200 py-2 mb-4 focus:outline-none focus:border-primary text-lg"
                        placeholder="Category Name"
                        value={newCatName}
                        onChange={(e) => setNewCatName(e.target.value)}
                    />
                    <div className="mb-3">
                        <p className="text-xs text-gray-400 mb-2">Icon</p>
                        <div className="flex gap-2 overflow-x-auto pb-2">
                            {iconKeys.map(k => (
                                <button 
                                    key={k} 
                                    onClick={() => setSelectedIcon(k)}
                                    className={`p-2 rounded-lg ${selectedIcon === k ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}
                                >
                                    <DynamicIcon name={k} size={20}/>
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="mb-4">
                        <p className="text-xs text-gray-400 mb-2">Color</p>
                        <div className="flex gap-3">
                            {colors.map(c => (
                                <button 
                                    key={c}
                                    onClick={() => setSelectedColor(c)}
                                    className={`w-8 h-8 rounded-full border-2 ${selectedColor === c ? 'border-gray-900 scale-110' : 'border-transparent'}`}
                                    style={{backgroundColor: c}}
                                />
                            ))}
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => setIsAdding(false)} className="flex-1 py-2 text-gray-500 bg-gray-100 rounded-xl">Cancel</button>
                        <button onClick={handleAdd} className="flex-1 py-2 text-white bg-primary rounded-xl font-medium">Create</button>
                    </div>
                </div>
            )}

            {categories.filter(c => c.type === 'expense').map(cat => (
                <div key={cat.id} className="bg-white p-4 rounded-xl flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                        <div 
                            className="w-10 h-10 rounded-full flex items-center justify-center"
                            style={{backgroundColor: `${cat.color}20`, color: cat.color}}
                        >
                            <DynamicIcon name={cat.icon} size={20} />
                        </div>
                        <span className="font-medium text-gray-800">{cat.name}</span>
                    </div>
                    <button onClick={() => onDeleteCategory(cat.id)} className="text-gray-300 hover:text-red-500 p-2">
                        <Trash2 size={18} />
                    </button>
                </div>
            ))}
       </div>
    </div>
  );
};

export default CategoryManager;
