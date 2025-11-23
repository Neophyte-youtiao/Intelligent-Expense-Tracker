import React, { useState, useEffect } from 'react';
import { UserProfile, DailyFortune } from '../types';
import { getBaziFortune } from '../services/geminiService';
import { ArrowLeft, Sparkles, User, Calendar, Clock, Loader2, Compass, Heart, Briefcase, Coins } from 'lucide-react';

interface FortuneViewProps {
  userProfile: UserProfile;
  onUpdateProfile: (profile: UserProfile) => void;
  onBack: () => void;
}

const FortuneView: React.FC<FortuneViewProps> = ({ userProfile, onUpdateProfile, onBack }) => {
  const [loading, setLoading] = useState(false);
  const [fortune, setFortune] = useState<DailyFortune | null>(null);
  
  // Form State
  const [birthDate, setBirthDate] = useState(userProfile.birthDate || '1990-01-01');
  const [birthTime, setBirthTime] = useState(userProfile.birthTime || '12:00');
  const [gender, setGender] = useState<'male' | 'female'>(userProfile.gender || 'male');

  const hasProfile = userProfile.hasProfile;

  // If user has profile, auto-fetch fortune on mount (mock check for daily cache)
  useEffect(() => {
    if (hasProfile && !fortune) {
      fetchFortune();
    }
  }, [hasProfile]);

  const handleSaveProfile = () => {
    onUpdateProfile({ birthDate, birthTime, gender, hasProfile: true });
    fetchFortune();
  };

  const fetchFortune = async () => {
    setLoading(true);
    try {
      const result = await getBaziFortune(birthDate, birthTime, gender);
      setFortune({
        date: new Date().toISOString().split('T')[0],
        ...result
      });
    } catch (e) {
      alert("大师正在闭关（网络错误），请稍后再试");
    } finally {
      setLoading(false);
    }
  };

  if (!hasProfile) {
    return (
      <div className="h-full flex flex-col bg-white/90 backdrop-blur-xl">
        <div className="px-4 py-4 flex items-center">
            <button onClick={onBack} className="text-gray-600 mr-2"><ArrowLeft size={24}/></button>
            <h1 className="text-xl font-bold text-gray-800">八字运势配置</h1>
        </div>
        <div className="p-6 flex flex-col gap-6 items-center pt-12">
            <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 mb-2">
                <Sparkles size={40} />
            </div>
            <p className="text-center text-gray-600 mb-4">请输入您的生辰八字，AI 大师将为您推算每日运势。</p>
            
            <div className="w-full space-y-4">
                <div className="bg-white p-4 rounded-xl border border-gray-200">
                    <label className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                        <Calendar size={16}/> 出生日期
                    </label>
                    <input 
                        type="date" 
                        value={birthDate}
                        onChange={(e) => setBirthDate(e.target.value)}
                        className="w-full text-lg font-medium bg-transparent focus:outline-none"
                    />
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200">
                    <label className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                        <Clock size={16}/> 出生时间
                    </label>
                    <input 
                        type="time" 
                        value={birthTime}
                        onChange={(e) => setBirthTime(e.target.value)}
                        className="w-full text-lg font-medium bg-transparent focus:outline-none"
                    />
                </div>
                <div className="flex gap-4">
                    <button 
                        onClick={() => setGender('male')}
                        className={`flex-1 py-3 rounded-xl border-2 font-medium transition-all ${gender === 'male' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-400'}`}
                    >
                        男
                    </button>
                    <button 
                        onClick={() => setGender('female')}
                        className={`flex-1 py-3 rounded-xl border-2 font-medium transition-all ${gender === 'female' ? 'border-pink-500 bg-pink-50 text-pink-600' : 'border-gray-200 text-gray-400'}`}
                    >
                        女
                    </button>
                </div>
            </div>

            <button 
                onClick={handleSaveProfile}
                className="w-full bg-gray-900 text-white py-4 rounded-xl font-bold text-lg shadow-lg mt-4 active:scale-95 transition-transform"
            >
                开启运势
            </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col relative overflow-hidden bg-gradient-to-br from-purple-900/90 to-indigo-900/90 text-white backdrop-blur-xl">
        {/* Header */}
        <div className="px-4 py-4 flex items-center relative z-10">
            <button onClick={onBack} className="text-white/80 hover:text-white mr-2"><ArrowLeft size={24}/></button>
            <h1 className="text-lg font-bold">今日运程</h1>
            <div className="flex-1"></div>
            <button onClick={() => onUpdateProfile({...userProfile, hasProfile: false})} className="text-xs bg-white/10 px-2 py-1 rounded">重置八字</button>
        </div>

        {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center relative z-10">
                <Loader2 size={48} className="animate-spin text-purple-300 mb-4" />
                <p className="text-purple-200 animate-pulse">大师正在排盘推演...</p>
            </div>
        ) : fortune ? (
            <div className="flex-1 overflow-y-auto p-4 relative z-10 pb-20">
                {/* Score Card */}
                <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 text-center mb-6 border border-white/10 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-purple-400 to-transparent opacity-50"></div>
                    <p className="text-purple-200 text-sm mb-1">{new Date().toLocaleDateString('zh-CN', {year:'numeric', month:'long', day:'numeric'})}</p>
                    <div className="text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-yellow-200 to-amber-500 drop-shadow-sm mb-2">
                        {fortune.overallScore}
                        <span className="text-xl text-white/60 font-normal ml-1">分</span>
                    </div>
                    <p className="text-lg text-white font-medium">{fortune.summary}</p>
                </div>

                {/* Lucky Info */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-white/5 rounded-2xl p-4 flex flex-col items-center border border-white/5">
                        <span className="text-xs text-purple-300 mb-1">幸运色</span>
                        <div className="w-8 h-8 rounded-full shadow-lg border-2 border-white/20 mb-1" style={{backgroundColor: 'gold'}}></div>
                        <span className="font-bold">{fortune.luckyColor}</span>
                    </div>
                    <div className="bg-white/5 rounded-2xl p-4 flex flex-col items-center border border-white/5">
                        <span className="text-xs text-purple-300 mb-1">财神方位</span>
                        <Compass className="text-yellow-400 mb-1" size={32} />
                        <span className="font-bold">{fortune.luckyDirection}</span>
                    </div>
                </div>

                {/* Detailed Tips */}
                <div className="space-y-4">
                    <div className="bg-white/5 rounded-2xl p-4 flex gap-4 border border-white/5">
                        <div className="bg-yellow-500/20 p-3 rounded-full h-fit text-yellow-300"><Coins size={20} /></div>
                        <div>
                            <h3 className="font-bold text-yellow-100 mb-1">财运</h3>
                            <p className="text-sm text-white/80 leading-relaxed">{fortune.wealthTip}</p>
                        </div>
                    </div>
                    <div className="bg-blue-500/10 rounded-2xl p-4 flex gap-4 border border-white/5">
                        <div className="bg-blue-500/20 p-3 rounded-full h-fit text-blue-300"><Briefcase size={20} /></div>
                        <div>
                            <h3 className="font-bold text-blue-100 mb-1">事业</h3>
                            <p className="text-sm text-white/80 leading-relaxed">{fortune.careerTip}</p>
                        </div>
                    </div>
                    <div className="bg-pink-500/10 rounded-2xl p-4 flex gap-4 border border-white/5">
                        <div className="bg-pink-500/20 p-3 rounded-full h-fit text-pink-300"><Heart size={20} /></div>
                        <div>
                            <h3 className="font-bold text-pink-100 mb-1">感情</h3>
                            <p className="text-sm text-white/80 leading-relaxed">{fortune.loveTip}</p>
                        </div>
                    </div>
                </div>
            </div>
        ) : null}

        {/* Decorative Background Elements */}
        <div className="absolute top-[-20%] left-[-20%] w-[140%] h-[60%] bg-purple-600/30 blur-[100px] rounded-full pointer-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[80%] h-[40%] bg-blue-600/20 blur-[80px] rounded-full pointer-events-none"></div>
    </div>
  );
};

export default FortuneView;