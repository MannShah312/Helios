import React, { useState, useRef, useEffect } from 'react';
import { 
  Sun, Moon, Menu, X, Upload, FileText, Image as ImageIcon, 
  ChevronLeft, ArrowRight, Bookmark, Search, Calendar, CheckCircle2,
  BookOpen, Globe, Cpu, Leaf, Landmark, MoreHorizontal, RefreshCw,
  ArrowUpRight, Flame, Target, Mic, PenTool, Book, Clock, AlertCircle, HelpCircle, Eye, EyeOff, ExternalLink, Bell
} from 'lucide-react';

const mockCategories = [
  { id: 'all', label: 'All', icon: Menu },
  { id: 'polity', label: 'Polity & Gov', icon: Landmark },
  { id: 'economy', label: 'Economy', icon: BookOpen },
  { id: 'ir', label: 'International', icon: Globe },
  { id: 'env', label: 'Environment', icon: Leaf },
  { id: 'sci', label: 'Science & Tech', icon: Cpu },
];

const mockQuickAccess = [
  { id: 1, title: 'Current Affairs', subtitle: 'Read & Analyze', icon: FileText, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-500/10' },
  { id: 2, title: 'Prelims Practice', subtitle: 'MCQs & Quizzes', icon: Target, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
  { id: 3, title: 'Mains Practice', subtitle: 'Answer Writing', icon: PenTool, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-500/10' },
  { id: 4, title: 'Interview Prep', subtitle: 'Personality Q.', icon: Mic, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-500/10' },
  { id: 5, title: 'PYQ Bank', subtitle: 'Topic-wise PYQs', icon: Book, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-500/10' },
  { id: 6, title: 'Revision', subtitle: 'Smart Revision', icon: RefreshCw, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-500/10' },
];

const App = () => {
  const [currentView, setCurrentView] = useState('upload'); // 'upload', 'processing', 'list', 'details'
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [activeDate, setActiveDate] = useState('');
  
  // Pipeline Data States
  const [currentAffairs, setCurrentAffairs] = useState(null);
  const [activeTopic, setActiveTopic] = useState(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [datesList, setDatesList] = useState([]);
  const [errorMsg, setErrorMsg] = useState(null);
  const [processingStep, setProcessingStep] = useState(0);

  // Real Streak and Goals States
  const [readStatus, setReadStatus] = useState(() => {
    try {
      const saved = localStorage.getItem('helios_read_topics');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      console.error('Failed to load read topics from localStorage:', e);
      return {};
    }
  });
  const [uploadsMetadata, setUploadsMetadata] = useState([]);
  const [isOverwriting, setIsOverwriting] = useState(false);

  // Push Notification States & Helpers
  const [pushNotificationEnabled, setPushNotificationEnabled] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.ready.then(reg => {
        reg.pushManager.getSubscription().then(sub => {
          setPushNotificationEnabled(!!sub);
        });
      });
    }
  }, []);

  const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const togglePushNotifications = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('Push notifications are not supported in this browser.');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        alert('Notification permission denied.');
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const existingSubscription = await reg.pushManager.getSubscription();

      if (existingSubscription) {
        await existingSubscription.unsubscribe();
        setPushNotificationEnabled(false);
      } else {
        const keyRes = await fetch('/api/notifications/vapid-public-key');
        const keyData = await keyRes.json();
        if (!keyData.success || !keyData.publicKey) {
          throw new Error(keyData.message || 'Failed to fetch public VAPID key');
        }

        const convertedKey = urlBase64ToUint8Array(keyData.publicKey);
        const newSubscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedKey
        });

        const res = await fetch('/api/notifications/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newSubscription)
        });

        const data = await res.json();
        if (data.success) {
          setPushNotificationEnabled(true);
        } else {
          throw new Error(data.message || 'Subscription failed on backend');
        }
      }
    } catch (err) {
      console.error('Failed to toggle push notifications:', err);
      alert(`Push subscription error: ${err.message}`);
    }
  };

  // Sync dark mode class
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Load Initial Content and Generate Date Scroller Array
  useEffect(() => {
    generateDates();
    fetchUploadsMetadata();
    const todayStr = getLocalDateStr(0);
    setActiveDate(todayStr);
    fetchDateData(todayStr);
  }, []);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  // Helper to get local date string
  const getLocalDateStr = (offset = 0) => {
    const d = new Date();
    d.setDate(d.getDate() - offset);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Generate date scroller cards for last 6 days
  const generateDates = () => {
    const list = [];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    for (let i = 0; i < 6; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      
      const year = d.getFullYear();
      const monthStr = String(d.getMonth() + 1).padStart(2, '0');
      const dayStr = String(d.getDate()).padStart(2, '0');
      const apiFormat = `${year}-${monthStr}-${dayStr}`;

      list.push({
        day: dayStr,
        month: months[d.getMonth()],
        label: i === 0 ? 'Today' : i === 1 ? 'Yesterday' : '',
        apiFormat
      });
    }
    setDatesList(list);
  };

  // Fetch all uploaded dates metadata to compute streak
  const fetchUploadsMetadata = async () => {
    try {
      const res = await fetch('/api/current-affairs/metadata/dates');
      const json = await res.json();
      if (json.success && json.data) {
        setUploadsMetadata(json.data);
      }
    } catch (err) {
      console.error('Error fetching uploads metadata:', err);
    }
  };

  // Fetch current affairs details for a date without switching view
  const fetchDateData = async (dateStr) => {
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/current-affairs/${dateStr}`);
      const json = await res.json();
      if (json.success && json.data) {
        setCurrentAffairs(json.data);
      } else {
        setCurrentAffairs(null);
      }
    } catch (err) {
      console.error('Error fetching date details:', err);
      setCurrentAffairs(null);
    }
  };

  // Fetch current affairs for a selected date and switch view
  const handleDateChange = async (dateStr) => {
    setActiveDate(dateStr);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/current-affairs/${dateStr}`);
      const json = await res.json();
      if (json.success && json.data) {
        setCurrentAffairs(json.data);
        setCurrentView('list');
      } else {
        setCurrentAffairs(null);
        setCurrentView('upload');
      }
    } catch (err) {
      console.error('Error fetching date details:', err);
      setCurrentAffairs(null);
      setCurrentView('upload');
    }
  };

  const handleDateChangeFromUpload = async (dateStr) => {
    setActiveDate(dateStr);
    setIsOverwriting(false);
    await fetchDateData(dateStr);
  };

  const toggleTopicRead = (dateStr, topicNum) => {
    setReadStatus(prev => {
      const list = prev[dateStr] || [];
      let updatedList;
      if (list.includes(topicNum)) {
        updatedList = list.filter(n => n !== topicNum);
      } else {
        updatedList = [...list, topicNum];
      }
      const updated = { ...prev, [dateStr]: updatedList };
      localStorage.setItem('helios_read_topics', JSON.stringify(updated));
      return updated;
    });
  };

  // Auto-mark topic as read when details page opens
  useEffect(() => {
    if (currentView === 'details' && activeTopic && activeDate) {
      const dateStr = activeDate;
      const topicNum = activeTopic.topicNumber;
      setReadStatus(prev => {
        const list = prev[dateStr] || [];
        if (!list.includes(topicNum)) {
          const updated = { ...prev, [dateStr]: [...list, topicNum] };
          localStorage.setItem('helios_read_topics', JSON.stringify(updated));
          return updated;
        }
        return prev;
      });
    }
  }, [currentView, activeTopic, activeDate]);

  // Streak Calculation
  const calculateStreak = (uploads, reads) => {
    if (!uploads || uploads.length === 0) return 0;
    
    const completedDates = new Set();
    uploads.forEach(u => {
      const dateStr = u.date.split('T')[0];
      const readList = reads[dateStr] || [];
      if (u.topicCount > 0 && readList.length >= u.topicCount) {
        completedDates.add(dateStr);
      }
    });

    const todayStr = getLocalDateStr(0);
    const yesterdayStr = getLocalDateStr(1);

    const isTodayCompleted = completedDates.has(todayStr);
    const hasTodayUpload = uploads.some(u => u.date.split('T')[0] === todayStr);

    let startDate;
    if (isTodayCompleted) {
      startDate = new Date();
    } else if (!hasTodayUpload || completedDates.has(yesterdayStr)) {
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 1);
    } else {
      return 0; // Today is incomplete and yesterday is incomplete
    }

    let streak = 0;
    while (true) {
      const year = startDate.getFullYear();
      const month = String(startDate.getMonth() + 1).padStart(2, '0');
      const day = String(startDate.getDate()).padStart(2, '0');
      const checkStr = `${year}-${month}-${day}`;

      const hasUpload = uploads.some(u => u.date.split('T')[0] === checkStr);
      if (hasUpload) {
        if (completedDates.has(checkStr)) {
          streak++;
        } else {
          break;
        }
      } else {
        break;
      }
      startDate.setDate(startDate.getDate() - 1);
    }
    return streak;
  };

  // Upload newspaper/headlines list image
  const handleProcessImage = async () => {
    if (!selectedFile) return;
    
    setCurrentView('processing');
    setProcessingStep(0);
    setErrorMsg(null);

    // Simulate checklist steps visually
    const stepIntervals = [
      setTimeout(() => setProcessingStep(1), 1500),
      setTimeout(() => setProcessingStep(2), 3000),
      setTimeout(() => setProcessingStep(3), 4500),
    ];

    const formData = new FormData();
    formData.append('image', selectedFile);

    try {
      const res = await fetch('/api/current-affairs/process', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      // Clear timers
      stepIntervals.forEach(clearTimeout);

      if (data.success) {
        setProcessingStep(4);
        setCurrentAffairs(data.data);
        setActiveDate(data.data.date.split('T')[0]);
        setIsOverwriting(false);
        fetchUploadsMetadata(); // Refresh metadata!
        setTimeout(() => {
          setCurrentView('list');
          setSelectedFile(null);
        }, 1000);
      } else {
        throw new Error(data.message || 'Processing failed.');
      }
    } catch (err) {
      console.error('Upload failed:', err);
      setErrorMsg(err.message || 'Failed to process current affairs.');
      setCurrentView('upload');
    }
  };

  // Categorize topics dynamically
  const getFilteredTopics = () => {
    if (!currentAffairs || !currentAffairs.topics) return [];
    if (activeCategory === 'all') return currentAffairs.topics;
    
    return currentAffairs.topics.filter(topic => {
      const subject = topic.classification.subject.toLowerCase();
      const paper = topic.classification.gsPaper;
      
      if (activeCategory === 'polity') {
        return paper === 'GS-II' && (subject.includes('polity') || subject.includes('governance') || subject.includes('justice'));
      }
      if (activeCategory === 'economy') {
        return paper === 'GS-III' && subject.includes('economy');
      }
      if (activeCategory === 'ir') {
        return paper === 'GS-II' && subject.includes('international');
      }
      if (activeCategory === 'env') {
        return paper === 'GS-III' && (subject.includes('environment') || subject.includes('climate') || subject.includes('disaster'));
      }
      if (activeCategory === 'sci') {
        return paper === 'GS-III' && (subject.includes('science') || subject.includes('technology') || subject.includes('tech'));
      }
      return false;
    });
  };

  const Header = ({ showBack = false, onBack = null }) => (
    <header className="sticky top-0 z-40 bg-white/80 dark:bg-[#0B1120]/80 backdrop-blur-lg border-b border-gray-100 dark:border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {showBack ? (
            <button onClick={onBack} className="p-2 -ml-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <ChevronLeft size={24} />
            </button>
          ) : (
            <button onClick={() => setIsMenuOpen(true)} className="p-2 -ml-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors md:hidden">
              <Menu size={24} />
            </button>
          )}
          
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setCurrentView('upload')}>
            <Sun className="text-orange-500 w-7 h-7" />
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white leading-none tracking-tight">Helios</h1>
              <p className="text-[10px] uppercase font-bold tracking-widest text-orange-500/80 leading-none mt-1">Rise &bull; Focus &bull; Conquer</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button className="hidden md:flex p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
            <Search size={20} />
          </button>
          <button className="hidden md:flex p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 relative">
            <Bookmark size={20} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-[#0B1120]"></span>
          </button>
          <button onClick={() => setIsMenuOpen(true)} className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
            <Menu size={24} className="hidden md:block" />
            <div className="w-8 h-8 rounded-full overflow-hidden md:hidden border-2 border-orange-200 dark:border-orange-800/50">
               <img src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80" alt="Profile" className="w-full h-full object-cover" />
            </div>
          </button>
          
          {/* Desktop Profile Pic */}
          <div className="hidden md:block w-9 h-9 rounded-full overflow-hidden border-2 border-orange-200 dark:border-orange-800/50 cursor-pointer hover:border-orange-400 transition-colors ml-2">
             <img src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80" alt="Profile" className="w-full h-full object-cover" />
          </div>
        </div>
      </div>
    </header>
  );

  const MenuModal = () => {
    if (!isMenuOpen) return null;
    return (
      <div className="fixed inset-0 z-50 flex justify-end">
        <div className="absolute inset-0 bg-black/20 dark:bg-black/60 backdrop-blur-sm" onClick={() => setIsMenuOpen(false)} />
        <div className="relative w-72 h-full bg-white dark:bg-slate-900 shadow-2xl animate-in slide-in-from-right flex flex-col border-l border-gray-100 dark:border-slate-800">
          <div className="p-5 flex justify-between items-center border-b border-gray-100 dark:border-slate-800">
            <h3 className="font-bold text-slate-800 dark:text-white">Settings</h3>
            <button onClick={() => setIsMenuOpen(false)} className="p-2 bg-slate-50 dark:bg-slate-800 rounded-full text-slate-500 hover:text-slate-800 dark:hover:text-white">
              <X size={18} />
            </button>
          </div>
          <div className="p-5 flex-1">
            <div className="mb-6">
              <p className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider">Appearance</p>
              <button 
                onClick={toggleTheme}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {isDarkMode ? <Moon size={20} className="text-indigo-400" /> : <Sun size={20} className="text-orange-500" />}
                  <span className="font-medium text-sm text-slate-700 dark:text-slate-200">
                    {isDarkMode ? 'Dark Mode' : 'Light Mode'}
                  </span>
                </div>
                <div className={`w-10 h-6 rounded-full p-1 transition-colors ${isDarkMode ? 'bg-indigo-500' : 'bg-slate-300'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${isDarkMode ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
              </button>
            </div>

            <div className="mb-6">
              <p className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider">Notifications</p>
              <button 
                onClick={togglePushNotifications}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Bell size={20} className={pushNotificationEnabled ? 'text-emerald-500' : 'text-slate-400'} />
                  <span className="font-medium text-sm text-slate-700 dark:text-slate-200">
                    Push Alerts
                  </span>
                </div>
                <div className={`w-10 h-6 rounded-full p-1 transition-colors ${pushNotificationEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${pushNotificationEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
              </button>
            </div>
            
            <div className="mb-6">
               <p className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider">Navigation</p>
               <button onClick={() => { setCurrentView('upload'); setIsMenuOpen(false); }} className="w-full text-left p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-medium">Dashboard Home</button>
               {currentAffairs && (
                 <button onClick={() => { setCurrentView('list'); setIsMenuOpen(false); }} className="w-full text-left p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-medium">Current Affairs</button>
               )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const UploadScreen = () => {
    const fileInputRef = useRef(null);
    const [dragActive, setDragActive] = useState(false);

    const handleFileSelect = (e) => {
      if (e.target.files && e.target.files[0]) {
        setSelectedFile(e.target.files[0]);
      }
    };

    const handleDrop = (e) => {
      e.preventDefault();
      setDragActive(false);
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        setSelectedFile(e.dataTransfer.files[0]);
      }
    };

    return (
      <div className="flex-1 flex flex-col min-h-screen bg-[#FFFDF9] dark:bg-[#0B1120] relative transition-colors">
        <Header />
        
        <main className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-6 lg:p-8 pb-24 z-10 flex flex-col">
          
          {/* Top Hero Section with Landscape Graphic */}
          <div className="relative mb-8 pt-4 md:pt-8 rounded-3xl overflow-hidden bg-gradient-to-br from-[#FFF5EC] to-white dark:from-slate-900 dark:to-slate-900 border border-orange-100/50 dark:border-slate-800/50 shadow-[0_4px_20px_rgb(0,0,0,0.02)] dark:shadow-none">
             <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-40 dark:opacity-20 flex justify-end items-end">
                <svg viewBox="0 0 800 300" preserveAspectRatio="xMaxYMax slice" className="w-full max-w-3xl h-full translate-y-[20%] translate-x-[10%]">
                  <circle cx="650" cy="180" r="140" fill="#FDBA74" />
                  <path d="M200,300 Q350,150 500,300 Z" fill="#FED7AA" />
                  <path d="M400,300 Q600,100 800,300 Z" fill="#F97316" />
                  <path d="M600,300 Q750,150 900,300 Z" fill="#7C2D12" opacity="0.8"/>
                  <path d="M500,80 Q510,70 520,80 Q510,75 500,80" fill="none" stroke="#9A3412" strokeWidth="2"/>
                  <path d="M540,60 Q550,50 560,60 Q550,55 540,60" fill="none" stroke="#9A3412" strokeWidth="2"/>
                </svg>
             </div>

             <div className="relative z-10 p-6 md:p-8 md:w-2/3">
                <h2 className="text-2xl md:text-4xl font-extrabold text-slate-900 dark:text-white mb-2 flex items-center gap-3 tracking-tight">
                  Good Morning, Aspirant! <Sun className="text-orange-500 hidden sm:block" size={32} />
                </h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm md:text-base leading-relaxed max-w-md italic font-medium">
                  "The harder you work for something, the greater you'll feel when you achieve it."
                </p>
             </div>
          </div>

          {/* Date Selector Row */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
             {datesList.map((d, i) => {
               const isSelected = activeDate === d.apiFormat;
               return (
                 <button 
                   key={i} 
                   onClick={() => handleDateChangeFromUpload(d.apiFormat)}
                   className={`px-4 py-2 rounded-full border text-xs font-bold transition-all shrink-0 ${
                     isSelected 
                       ? 'bg-orange-500 border-orange-500 text-white shadow-sm scale-105' 
                       : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-350'
                   }`}
                 >
                   {d.label ? d.label : `${d.day} ${d.month}`}
                 </button>
               );
             })}
             <button className="px-4 py-2 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 shrink-0 hover:border-slate-300 relative flex items-center justify-center gap-1.5 text-xs font-bold">
                <Calendar size={14} /> Custom
                <input 
                  type="date" 
                  onChange={(e) => handleDateChangeFromUpload(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
             </button>
          </div>

          {/* Stats Row */}
          {(() => {
            const totalTopics = currentAffairs?.topics?.length || 0;
            const readTopicsList = readStatus[activeDate] || [];
            const readCount = readTopicsList.filter(num => currentAffairs?.topics?.some(t => t.topicNumber === num)).length;
            const streakVal = calculateStreak(uploadsMetadata, readStatus);
            const isDayCompleted = totalTopics > 0 && readCount === totalTopics;

            return (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 mb-8">
                  <div className="bg-[#1A1F2E] dark:bg-slate-900 text-white rounded-[2rem] p-6 flex items-center justify-between shadow-xl shadow-blue-900/10 dark:shadow-none border border-transparent dark:border-slate-800 hover:-translate-y-1 transition-all">
                     <div className="flex items-center gap-4 md:gap-6">
                       <div className={`w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center shrink-0 ${streakVal > 0 ? 'bg-orange-500/20 text-orange-500' : 'bg-slate-700/25 text-slate-500'}`}>
                         <Flame size={32} className={streakVal > 0 ? 'fill-orange-500/20' : ''} />
                       </div>
                       <div>
                          <p className="text-xs md:text-sm text-slate-400 font-semibold uppercase tracking-wider mb-1">Study Streak</p>
                          <p className="text-3xl md:text-4xl font-bold flex items-baseline gap-2">
                             {streakVal} <span className="text-base md:text-lg font-medium text-slate-400 normal-case">Days</span>
                          </p>
                       </div>
                     </div>
                     <div className="h-12 w-px bg-slate-700/50 hidden md:block"></div>
                  </div>
                  
                  <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 flex items-center gap-4 md:gap-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 dark:border-slate-800 hover:-translate-y-1 transition-all">
                     <div className={`w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center shrink-0 border ${
                       isDayCompleted 
                         ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                         : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-100 dark:border-slate-700'
                     }`}>
                       <Target size={32} />
                     </div>
                     <div>
                        <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider mb-1">Daily Goal</p>
                        <p className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white flex items-baseline gap-2">
                           {readCount} <span className="text-base md:text-lg font-medium text-slate-400 normal-case">/ {totalTopics} read</span>
                        </p>
                     </div>
                  </div>
                </div>

                {/* Core Action: The Upload Zone */}
                <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 dark:border-slate-800 p-6 md:p-8 mb-10 flex flex-col">
                  <div className="flex items-center justify-between mb-6">
                     <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                       {currentAffairs ? (isOverwriting ? 'Re-upload Image' : 'Content Analyzed') : 'Daily Content Generation'}
                     </h3>
                     {isOverwriting && !selectedFile && (
                       <button 
                         onClick={() => setIsOverwriting(false)} 
                         className="text-xs font-bold text-slate-500 hover:text-slate-850 dark:hover:text-white px-3 py-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-750"
                       >
                         Cancel
                       </button>
                     )}
                     {!isOverwriting && (
                       <span className="text-xs font-bold bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400 px-3 py-1.5 rounded-full">
                         {currentAffairs ? 'Completed' : 'AI Powered'}
                       </span>
                     )}
                  </div>

                  {errorMsg && (
                    <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-900/50 rounded-2xl text-sm flex items-center gap-3">
                      <AlertCircle size={20} />
                      <span>{errorMsg}</span>
                    </div>
                  )}
                  
                  {currentAffairs && !isOverwriting ? (
                    <div className="border border-slate-100 dark:border-slate-800 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center gap-6 bg-slate-50/50 dark:bg-slate-800/20 w-full">
                      {currentAffairs.sourceImage?.url && (
                        <div className="w-full md:w-1/3 aspect-[4/3] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm relative shrink-0">
                          <img src={currentAffairs.sourceImage.url} alt="Uploaded Source" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-slate-900/10"></div>
                        </div>
                      )}
                      <div className="flex-1 flex flex-col justify-center text-center md:text-left">
                        <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                          Current Affairs is Ready
                        </h4>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 max-w-sm md:max-w-md">
                          Helios has processed the headlines image for {activeDate === datesList[0]?.apiFormat ? 'Today' : activeDate}. You have read {readCount} out of {totalTopics} topics.
                        </p>
                        
                        <div className="flex flex-col sm:flex-row gap-4 w-full md:max-w-md">
                          <button 
                            onClick={() => setCurrentView('list')}
                            className="flex-1 py-3 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold shadow-lg shadow-orange-500/30 transition-all active:scale-95 flex items-center justify-center gap-2 text-sm"
                          >
                            <BookOpen size={16} /> View Study Notes
                          </button>
                          <button 
                            onClick={() => setIsOverwriting(true)}
                            className="flex-1 py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-sm"
                          >
                            Re-upload Image
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {!selectedFile ? (
                        <div 
                          onClick={() => fileInputRef.current?.click()}
                          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                          onDragLeave={() => setDragActive(false)}
                          onDrop={handleDrop}
                          className={`border-2 border-dashed rounded-3xl p-8 md:p-12 flex flex-col items-center justify-center text-center cursor-pointer transition-all min-h-[280px] group ${
                            dragActive ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20' : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/20 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-orange-300 dark:hover:border-orange-700'
                          }`}
                        >
                          <div className="w-16 h-16 bg-white dark:bg-slate-800 text-orange-500 rounded-2xl flex items-center justify-center mb-5 shadow-sm border border-slate-100 dark:border-slate-700 group-hover:scale-110 transition-transform">
                            <Upload size={28} />
                          </div>
                          <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Upload Newspaper or Image for {activeDate === datesList[0]?.apiFormat ? 'Today' : activeDate}</h4>
                          <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm mb-6">
                            Select your headlines list image or paper snapshot to analyze. We'll automatically fetch, OCR, and ground the topics in Google Search.
                          </p>
                          <button className="px-6 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-full text-sm font-bold shadow-md hover:shadow-lg transition-all">
                            Browse Files
                          </button>
                        </div>
                      ) : (
                        <div className="border border-slate-100 dark:border-slate-800 rounded-3xl p-6 md:p-8 flex flex-col items-center bg-slate-50/50 dark:bg-slate-800/20 w-full">
                          <div className="relative w-full max-w-sm aspect-[4/3] bg-white dark:bg-slate-800 rounded-2xl overflow-hidden mb-6 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-center group">
                             <img src={URL.createObjectURL(selectedFile)} alt="Preview" className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500" />
                             <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent"></div>
                             <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-white">
                                <div className="truncate pr-4 flex items-center gap-2">
                                  <ImageIcon size={16} />
                                  <span className="text-sm font-medium truncate">{selectedFile.name}</span>
                                </div>
                                <span className="text-xs bg-black/50 px-2 py-1 rounded backdrop-blur-sm whitespace-nowrap font-medium">
                                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                                </span>
                             </div>
                          </div>

                          <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-full text-sm font-bold mb-8 border border-emerald-100 dark:border-emerald-800/50">
                            <CheckCircle2 size={18} />
                            Ready to process
                          </div>

                          <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
                            <button 
                              onClick={() => setSelectedFile(null)}
                              className="flex-1 py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-sm"
                            >
                              Change File
                            </button>
                            <button 
                              onClick={handleProcessImage}
                              className="flex-1 py-3 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold shadow-lg shadow-orange-500/30 transition-all active:scale-95 flex items-center justify-center gap-2 text-sm"
                            >
                              Analyze Now <ArrowRight size={16} />
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*" />
                </div>
              </>
            );
          })()}

          {/* Quick Access Grid */}
          <div>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Quick Access</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
               {mockQuickAccess.map((item) => (
                 <button 
                   key={item.id}
                   disabled={item.title === 'Current Affairs' && !currentAffairs}
                   onClick={() => item.title === 'Current Affairs' && setCurrentView('list')}
                   className="bg-white dark:bg-slate-900 rounded-2xl p-4 md:p-5 flex flex-col items-center justify-center text-center shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-100 dark:border-slate-800 hover:-translate-y-1 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   <div className={`w-12 h-12 rounded-2xl ${item.bg} ${item.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                     <item.icon size={24} />
                   </div>
                   <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1 leading-tight">{item.title}</h4>
                   <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{item.subtitle}</p>
                 </button>
               ))}
            </div>
          </div>
        </main>
      </div>
    );
  };

  const ProcessingScreen = () => {
    const steps = [
      "Reading document contents...",
      "Identifying UPSC topics...",
      "Structuring context and background...",
      "Finalizing study notes..."
    ];

    return (
      <div className="flex-1 flex flex-col min-h-screen bg-[#FFFDF9] dark:bg-[#0B1120] transition-colors">
        <Header />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-sm w-full bg-white dark:bg-slate-900 p-8 rounded-[2rem] shadow-2xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 flex flex-col items-center text-center">
            <div className="relative mb-8">
               <div className="w-20 h-20 bg-orange-50 dark:bg-slate-800 rounded-full flex items-center justify-center animate-pulse">
                  <RefreshCw size={32} className="text-orange-500 animate-spin" style={{ animationDuration: '3s' }} />
               </div>
               <div className="absolute inset-0 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
            
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Processing Upload</h3>
            
            <div className="w-full space-y-4">
              {steps.map((text, idx) => {
                const isPast = idx < processingStep;
                const isCurrent = idx === processingStep;
                return (
                  <div key={idx} className={`flex items-center gap-3 text-left transition-opacity duration-500 ${isPast || isCurrent ? 'opacity-100' : 'opacity-30'}`}>
                    {isPast ? (
                      <CheckCircle2 size={20} className="text-emerald-500 shrink-0" />
                    ) : isCurrent ? (
                      <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin shrink-0"></div>
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 shrink-0 border border-slate-200 dark:border-slate-700"></div>
                    )}
                    <span className={`text-sm font-semibold ${isCurrent ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
                      {text}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const ListScreen = () => {
    const topics = getFilteredTopics();
    const featuredTopic = topics[0];
    const restTopics = topics.slice(1);

    return (
      <div className="flex-1 flex flex-col min-h-screen bg-[#F8FAFC] dark:bg-[#0B1120] transition-colors">
        <Header showBack={true} onBack={() => setCurrentView('upload')} />
        
        {/* Top Scroller Date section */}
        <div className="bg-gradient-to-b from-orange-50 to-white dark:from-slate-900 dark:to-[#0B1120] pt-6 pb-2 px-4 border-b border-slate-100 dark:border-slate-800/50">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">Current Affairs</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Stay updated. Stay ahead.</p>

            {/* Horizontal Date Scroller */}
            <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
               {datesList.map((d, i) => {
                 const isSelected = activeDate === d.apiFormat;
                 return (
                   <button 
                     key={i} 
                     onClick={() => handleDateChange(d.apiFormat)}
                     className={`flex flex-col items-center justify-center min-w-[70px] h-20 rounded-2xl border transition-all shrink-0 ${
                       isSelected 
                        ? 'bg-slate-900 dark:bg-slate-800 border-slate-900 dark:border-slate-700 text-white shadow-md scale-105' 
                        : 'bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                     }`}
                   >
                     <span className="text-xl font-bold leading-tight">{d.day}</span>
                     <span className="text-xs font-medium">{d.month}</span>
                     {d.label && <span className={`text-[10px] mt-1 font-bold ${isSelected ? 'text-orange-400' : ''}`}>{d.label}</span>}
                   </button>
                 );
               })}
               <button className="flex flex-col items-center justify-center min-w-[70px] h-20 rounded-2xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 text-slate-400 shrink-0 hover:border-slate-300 relative">
                  <Calendar size={20} />
                  <input 
                    type="date" 
                    onChange={(e) => handleDateChange(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
               </button>
            </div>
          </div>
        </div>

        {/* Horizontal Category Scroller */}
        <div className="bg-white dark:bg-[#0B1120] border-b border-slate-100 dark:border-slate-800/50 py-4 px-4 sticky top-16 z-30">
          <div className="max-w-7xl mx-auto flex gap-6 overflow-x-auto scrollbar-hide">
             {mockCategories.map((cat) => {
               const Icon = cat.icon;
               const isSelected = activeCategory === cat.id;
               return (
                 <button 
                   key={cat.id} 
                   onClick={() => setActiveCategory(cat.id)}
                   className={`flex flex-col items-center gap-2 shrink-0 group ${isSelected ? 'text-orange-500' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                 >
                   <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${
                     isSelected ? 'bg-orange-100/50 dark:bg-orange-900/20' : 'bg-slate-50 dark:bg-slate-900 group-hover:bg-slate-100 dark:group-hover:bg-slate-800'
                   }`}>
                     <Icon size={22} />
                   </div>
                   <span className={`text-[11px] font-semibold whitespace-nowrap ${isSelected ? 'text-orange-600 dark:text-orange-400' : ''}`}>{cat.label}</span>
                 </button>
               )
             })}
          </div>
        </div>

        <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 pb-24">
          {topics.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
              <BookOpen size={48} className="mx-auto mb-4 text-slate-300 dark:text-slate-700" />
              <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2">No Topics in this Category</h4>
              <p className="text-sm text-slate-500 dark:text-slate-400">Try changing categories or choose another day to browse archives.</p>
            </div>
          ) : (
            <>
              {/* Top Featured News Section */}
              {featuredTopic && (
                <div className="mb-8">
                  <h3 className="text-lg font-bold text-orange-500 mb-4 flex items-center gap-2">Top News</h3>
                  <div 
                    onClick={() => { setActiveTopic(featuredTopic); setCurrentView('details'); }}
                    className="bg-white dark:bg-slate-900 rounded-[1.5rem] p-4 sm:p-5 flex flex-col md:flex-row gap-5 border border-slate-200/60 dark:border-slate-800 shadow-sm cursor-pointer hover:shadow-md transition-shadow group"
                  >
                    {/* Cloudinary Crop Box */}
                    <div className="w-full md:w-2/5 aspect-[16/9] md:aspect-auto md:min-h-[220px] bg-slate-850 dark:bg-slate-800 rounded-2xl relative overflow-hidden shrink-0 flex items-center justify-center border border-slate-100 dark:border-slate-700">
                       {currentAffairs?.sourceImage?.url ? (
                         <img src={currentAffairs.sourceImage.url} alt="Source headlines" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                       ) : (
                         <Landmark size={48} className="text-white/20" />
                       )}
                       <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors"></div>
                    </div>
                    
                    <div className="flex-1 flex flex-col justify-center">
                       <div className="flex items-center gap-2 mb-3 flex-wrap">
                          <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1 rounded-md">
                            {featuredTopic.classification.subject}
                          </span>
                          <span className="text-xs font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-2.5 py-1 rounded-md">
                            {featuredTopic.classification.gsPaper}
                          </span>
                          {(readStatus[activeDate] || []).includes(featuredTopic.topicNumber) && (
                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 rounded-md flex items-center gap-1">
                              <CheckCircle2 size={12} className="fill-emerald-500/25" /> Completed
                            </span>
                          )}
                       </div>
                       <h4 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white mb-3 leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                         {featuredTopic.title}
                       </h4>
                       <p className="text-slate-600 dark:text-slate-400 text-sm md:text-base leading-relaxed mb-4 line-clamp-3">
                         {featuredTopic.shortDescription}
                       </p>
                       <div className="mt-auto flex items-center justify-between text-xs font-medium text-slate-500">
                          <div className="flex items-center gap-4">
                             <span className="flex items-center gap-1.5"><Clock size={14} /> 5-10 min read</span>
                             <span className="flex items-center gap-1.5"><Calendar size={14} /> {activeDate}</span>
                          </div>
                          <Bookmark size={18} className="hover:text-slate-900 dark:hover:text-white transition-colors" />
                       </div>
                    </div>
                  </div>
                </div>
              )}

              {/* News in Shorts Grid */}
              {restTopics.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">News in Shorts</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {restTopics.map((topic, i) => (
                      <div 
                        key={i} 
                        onClick={() => { setActiveTopic(topic); setCurrentView('details'); }}
                        className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/60 dark:border-slate-800 shadow-sm cursor-pointer hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col h-full group"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 dark:text-emerald-400">
                              {topic.classification.subject}
                            </span>
                            {(readStatus[activeDate] || []).includes(topic.topicNumber) && (
                              <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                <CheckCircle2 size={10} className="fill-emerald-500/25" /> Read
                              </span>
                            )}
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            topic.importance === 'HIGH' ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' : 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400'
                          }`}>
                            {topic.importance}
                          </span>
                        </div>
                        
                        <h4 className="text-base font-bold text-slate-900 dark:text-white mb-2 leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {topic.title}
                        </h4>
                        
                        <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-3 mb-4 flex-1">
                          {topic.shortDescription}
                        </p>
                        
                        <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-100 dark:border-slate-800">
                           <span className="text-xs font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                             {topic.classification.gsPaper}
                           </span>
                           <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 dark:group-hover:bg-blue-900/20 dark:group-hover:text-blue-400 transition-colors">
                              <ArrowUpRight size={16} />
                           </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    );
  };

  const DetailsScreen = () => {
    const [revealAnswer, setRevealAnswer] = useState(false);
    if (!activeTopic) return null;

    return (
      <div className="flex-1 flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors">
        <Header showBack={true} onBack={() => setCurrentView('list')} />
        
        <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-6 pb-24">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 border border-slate-200/60 dark:border-slate-800 shadow-sm flex flex-col gap-6">
            
            {/* Header info */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-orange-500 uppercase tracking-widest">
                  Topic #{activeTopic.topicNumber} &bull; Classification
                </span>
                <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  {activeTopic.title}
                </h2>
              </div>
              <div className="flex gap-2 shrink-0 items-center flex-wrap">
                <button 
                  onClick={() => toggleTopicRead(activeDate, activeTopic.topicNumber)}
                  className={`px-3 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 border transition-colors ${
                    (readStatus[activeDate] || []).includes(activeTopic.topicNumber)
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-250 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-800'
                      : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-850 dark:text-slate-400 dark:border-slate-750'
                  }`}
                >
                  <CheckCircle2 size={14} className={(readStatus[activeDate] || []).includes(activeTopic.topicNumber) ? 'text-emerald-500 fill-emerald-500/25' : 'text-slate-400'} />
                  {(readStatus[activeDate] || []).includes(activeTopic.topicNumber) ? 'Read' : 'Mark as Read'}
                </button>
                <span className="badge bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50 px-3 py-1 rounded-md text-xs font-bold uppercase">
                  {activeTopic.classification.gsPaper}
                </span>
                <span className={`badge px-3 py-1 rounded-md text-xs font-bold uppercase ${
                  activeTopic.importance === 'HIGH' 
                    ? 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 border border-red-100 dark:border-red-900/50' 
                    : 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-100 dark:border-amber-900/50'
                }`}>
                  {activeTopic.importance} Importance
                </span>
              </div>
            </div>

            {/* Original Headline Banner */}
            <div className="bg-slate-50 dark:bg-slate-950/50 border-l-4 border-slate-400 p-4 rounded-r-xl text-slate-600 dark:text-slate-400 text-sm font-medium italic">
              Original Headline: "{activeTopic.originalHeadline}"
            </div>

            {/* Visual crop preview from original newspaper */}
            {currentAffairs?.sourceImage?.url && (
              <div className="w-full max-h-[300px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-center">
                <img src={currentAffairs.sourceImage.url} alt="Headlines crop" className="w-full object-cover object-top" />
              </div>
            )}

            {/* Capsule Capsule overview */}
            <div>
              <h3 className="text-xs uppercase tracking-wider text-slate-400 mb-2 font-bold">Brief Capsule</h3>
              <p className="text-slate-900 dark:text-slate-100 text-base md:text-lg leading-relaxed font-semibold">
                {activeTopic.shortDescription}
              </p>
            </div>

            {/* UPSC Detailed Syllabus Mapping */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 dark:bg-slate-950/30 p-6 rounded-2xl border border-slate-100 dark:border-slate-800">
               <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1">General Studies Paper</h4>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{activeTopic.classification.gsPaper}</p>
               </div>
               <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1">Subject & Topic Theme</h4>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{activeTopic.classification.subject} &bull; {activeTopic.classification.subSubject}</p>
               </div>
            </div>

            {/* Mains Analysis Dimensions */}
            <div className="flex flex-col gap-6 pt-4 border-t border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">UPSC Mains Study Note</h3>
              
              <div className="flex flex-col gap-5 text-sm md:text-base">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white mb-1.5">1. What Happened?</h4>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{activeTopic.analysis.whatHappened}</p>
                </div>
                
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white mb-1.5">2. Background & History</h4>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{activeTopic.analysis.background}</p>
                </div>

                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white mb-1.5">3. Why Important (Significance)</h4>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{activeTopic.analysis.whyImportant}</p>
                </div>

                {activeTopic.analysis.keyPoints?.length > 0 && (
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white mb-1.5">4. Core Issues & Dimensions</h4>
                    <ul className="list-disc pl-5 text-slate-600 dark:text-slate-400 space-y-1.5">
                      {activeTopic.analysis.keyPoints.map((item, idx) => <li key={idx}>{item}</li>)}
                    </ul>
                  </div>
                )}

                {activeTopic.analysis.governmentMeasures?.length > 0 && (
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white mb-1.5">5. Government Measures & Policies</h4>
                    <ul className="list-disc pl-5 text-slate-600 dark:text-slate-400 space-y-1.5">
                      {activeTopic.analysis.governmentMeasures.map((item, idx) => <li key={idx}>{item}</li>)}
                    </ul>
                  </div>
                )}

                {activeTopic.analysis.challenges?.length > 0 && (
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white mb-1.5">6. Key Challenges & Concerns</h4>
                    <ul className="list-disc pl-5 text-slate-600 dark:text-slate-400 space-y-1.5">
                      {activeTopic.analysis.challenges.map((item, idx) => <li key={idx}>{item}</li>)}
                    </ul>
                  </div>
                )}

                {activeTopic.analysis.wayForward?.length > 0 && (
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white mb-1.5">7. Way Forward / Policy Recommendations</h4>
                    <ul className="list-disc pl-5 text-slate-600 dark:text-slate-400 space-y-1.5">
                      {activeTopic.analysis.wayForward.map((item, idx) => <li key={idx}>{item}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Prelims fact segment */}
            {activeTopic.prelims && (
              <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/50 rounded-2xl p-5 flex flex-col gap-3">
                <h4 className="text-sm font-bold text-blue-700 dark:text-blue-400 flex items-center gap-2">
                  <CheckCircle2 size={16} /> Prelims Digest Quick Facts
                </h4>
                <ul className="list-disc pl-5 text-slate-600 dark:text-slate-400 text-sm space-y-1.5">
                  {activeTopic.prelims.facts.map((fact, idx) => <li key={idx}>{fact}</li>)}
                </ul>
                
                {activeTopic.prelims.keywords?.length > 0 && (
                  <div className="flex gap-2 flex-wrap pt-2">
                    {activeTopic.prelims.keywords.map((kw, idx) => (
                      <span key={idx} className="text-xs bg-slate-200/50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                        #{kw}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Active recall test card */}
            <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/50 rounded-2xl p-5 flex flex-col gap-3">
              <h4 className="text-sm font-bold text-amber-700 dark:text-amber-400 flex items-center gap-2">
                <HelpCircle size={16} /> Active Recall Revision Deck
              </h4>
              <p className="text-sm text-slate-900 dark:text-white font-semibold">
                Q: {activeTopic.revision.question}
              </p>
              
              <button 
                onClick={() => setRevealAnswer(!revealAnswer)}
                className="btn self-start py-2 px-4 rounded-xl text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center gap-1.5"
              >
                {revealAnswer ? <><EyeOff size={14} /> Hide Answer</> : <><Eye size={14} /> Reveal Answer</>}
              </button>
              
              {revealAnswer && (
                <div className="animate-fade-in text-sm text-slate-600 dark:text-slate-400 border-l-4 border-amber-500 pl-4 py-2 mt-2 bg-amber-500/5 rounded-r">
                  {activeTopic.revision.answer}
                </div>
              )}
            </div>

            {/* Sources references */}
            {activeTopic.sources?.length > 0 && (
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-3">
                <h5 className="text-xs uppercase font-bold tracking-wider text-slate-400">Grounded Citations</h5>
                <div className="flex gap-2 flex-wrap">
                  {activeTopic.sources.map((src, i) => (
                    <a 
                      key={i} 
                      href={src.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-blue-500 hover:text-blue-500 transition-colors text-slate-600 dark:text-slate-400 px-3 py-1.5 rounded-lg"
                    >
                      {src.title} <ExternalLink size={12} />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col font-sans bg-[#FFFDF9] dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 selection:bg-orange-200 selection:text-orange-900 dark:selection:bg-orange-900 dark:selection:text-orange-100 transition-colors duration-200">
      {currentView === 'upload' && <UploadScreen />}
      {currentView === 'processing' && <ProcessingScreen />}
      {currentView === 'list' && <ListScreen />}
      {currentView === 'details' && <DetailsScreen />}
      
      <MenuModal />
    </div>
  );
};

export default App;
