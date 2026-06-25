'use client';

import React, { useState, useEffect, useRef } from 'react';
import { SignInButton, useUser, useClerk } from '@clerk/nextjs';
import { 
  Mic, MicOff, Volume2, CheckCircle2, ChevronLeft, 
  RotateCcw, ShieldCheck, Loader2, Sparkles, Building, Landmark, 
  User, LogOut, Bookmark, Share2, Printer, Check, HeartHandshake, 
  HelpCircle, Eye, AlertCircle, Phone, X, Globe
} from 'lucide-react';

interface EligibilityResult {
  schemeId: string;
  title: string;
  ministry: string;
  description: string;
  whyEligible: string;
  benefits: string;
  stepsToApply: string[];
  documentUrl?: string | null;
  applyUrl?: string | null;
}

interface UserProfile {
  state: string;
  age: number;
  gender: string;
  casteCategory: string;
  annualIncome: number;
  occupation: string;
  disabilityStatus: string;
  disabilityPercentage: number;
  needsAndInterests: string;
}

interface SavedScheme {
  id: string;
  title: string;
  ministry: string | null;
  state: string;
  minAge: number | null;
  maxAge: number | null;
  genderRestriction: string;
  incomeCeiling: number | null;
  occupations: string;
  casteCategories: string;
  expiryDate: string | null;
  documentUrl: string | null;
  applyUrl: string | null;
  isActive: boolean;
}

interface SearchHistoryItem {
  id: string;
  query: string | null;
  state: string | null;
  age: number | null;
  gender: string | null;
  income: number | null;
  occupation: string | null;
  caste: string | null;
  detectedLanguage: string;
  createdAt: string;
}

interface DownloadedReportItem {
  id: string;
  schemeTitle: string;
  language: string;
  createdAt: string;
}

interface DBUser {
  id: string;
  phone: string;
  name: string;
  createdAt: string;
  _count: {
    savedSchemes: number;
    searchHistories: number;
  };
}

export default function GoonjPortal() {
  // Navigation & Views
  const [activeTab, setActiveTab] = useState<'home' | 'chat' | 'results' | 'dashboard'>('home');
  
  // Auth state
  const [user, setUser] = useState<DBUser | null>(null);
  const { isLoaded, isSignedIn, user: clerkUser } = useUser();
  const { signOut, openSignIn } = useClerk();

  // Accessibility settings
  const [largeText, setLargeText] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [voiceNav, setVoiceNav] = useState(false);

  // Chat/Discovery flow states
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [chatProfile, setChatProfile] = useState<Partial<UserProfile>>({});
  const [chatTurn, setChatTurn] = useState(1);
  const [chatDetectedLanguage, setChatDetectedLanguage] = useState('English');
  const [chatDetectedDialect, setChatDetectedDialect] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [translatedQuestions, setTranslatedQuestions] = useState<string[]>([]);
  const [formAnswers, setFormAnswers] = useState<string[]>(['', '', '', '', '', '', '', '']);
  const [currentlyRecordingField, _setCurrentlyRecordingField] = useState<number | null>(null);
  const [isMatchingLoading, setIsMatchingLoading] = useState(false);
  const currentlyRecordingFieldRef = useRef<number | null>(null);
  const setCurrentlyRecordingField = (idx: number | null) => {
    currentlyRecordingFieldRef.current = idx;
    _setCurrentlyRecordingField(idx);
  };

  // Results State
  const [matchedSchemes, setMatchedSchemes] = useState<EligibilityResult[]>([]);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<{ [key: string]: 'yes' | 'no' }>({});
  const [activeShareMenu, setActiveShareMenu] = useState<string | null>(null);

  // Dashboard Lists
  const [savedSchemes, setSavedSchemes] = useState<SavedScheme[]>([]);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [downloadedReports, setDownloadedReports] = useState<DownloadedReportItem[]>([]);
  const [isDashLoading, setIsDashLoading] = useState(false);

  // Speech Recognition & Synthesis references
  const [isRecording, setIsRecording] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [speakingSchemeId, setSpeakingSchemeId] = useState<string | null>(null);
  const [speechError, setSpeechError] = useState<string | null>(null);

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const recognitionRef = useRef<any>(null);
  const voiceNavRecognitionRef = useRef<any>(null);
  const synthesisRef = useRef<any>(null);
  /* eslint-enable @typescript-eslint/no-explicit-any */
  const tempPauseVoiceNav = useRef(false);
  const voiceNavRef = useRef(voiceNav);

  useEffect(() => {
    voiceNavRef.current = voiceNav;
  }, [voiceNav]);

  const handleSendAnswerRef = useRef<any>(null);
  useEffect(() => {
    handleSendAnswerRef.current = handleSendAnswer;
  });

  const getLanguageCode = (lang: string) => {
    const nameLower = lang.toLowerCase();
    if (nameLower.includes('hindi') || nameLower.includes('hi') || nameLower.includes('bhojpuri')) return 'hi-IN';
    if (nameLower.includes('marathi') || nameLower.includes('mr')) return 'mr-IN';
    if (nameLower.includes('tamil') || nameLower.includes('ta')) return 'ta-IN';
    if (nameLower.includes('telugu') || nameLower.includes('te')) return 'te-IN';
    if (nameLower.includes('bengali') || nameLower.includes('bn')) return 'bn-IN';
    if (nameLower.includes('gujarati') || nameLower.includes('gu')) return 'gu-IN';
    if (nameLower.includes('kannada') || nameLower.includes('kn')) return 'kn-IN';
    if (nameLower.includes('malayalam') || nameLower.includes('ml')) return 'ml-IN';
    if (nameLower.includes('punjabi') || nameLower.includes('pa')) return 'pa-IN';
    if (nameLower.includes('odia') || nameLower.includes('or')) return 'or-IN';
    return 'en-IN';
  };



  // Auth Functions
  const fetchSession = async () => {
    try {
      const res = await fetch('/api/auth/session');
      const data = await res.json();
      if (data.success && data.user) {
        setUser(data.user);
        loadDashboardData();
      }
    } catch (err) {
      console.error('Session load failed:', err);
    }
  };

  const loadDashboardData = async () => {
    setIsDashLoading(true);
    try {
      const [savedRes, historyRes, reportsRes] = await Promise.all([
        fetch('/api/user/saved-schemes'),
        fetch('/api/user/search-history'),
        fetch('/api/user/reports')
      ]);

      const savedData = await savedRes.json();
      const historyData = await historyRes.json();
      const reportsData = await reportsRes.json();

      if (savedData.success) setSavedSchemes(savedData.schemes || []);
      if (historyData.success) setSearchHistory(historyData.history || []);
      if (reportsData.success) setDownloadedReports(reportsData.reports || []);
    } catch (err) {
      console.error('Failed to load dashboard logs:', err);
    } finally {
      setIsDashLoading(false);
    }
  };



  const handleLogout = async () => {
    try {
      await signOut();
      setUser(null);
      setSavedSchemes([]);
      setSearchHistory([]);
      setDownloadedReports([]);
      setActiveTab('home');
      speakText('Logged out successfully');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  // Conversational Assistant Functions
  const handleStartChat = () => {
    stopSpeaking();
    setChatMessages([
      {
        role: 'assistant',
        content: 'नमस्ते! गूंज (GOONJ) में आपका स्वागत है। प्रारंभ करने के लिए कृपया माइक्रोफोन बटन दबाएं और अपनी भाषा में कुछ भी कहें (जैसे "नमस्ते" या "हेलो")।\n\nHello! Welcome to Goonj. Please press the microphone button and speak in your language to start (e.g. "Namaste" or "Hello").'
      }
    ]);
    setChatProfile({});
    setChatTurn(1);
    setChatDetectedLanguage('English');
    setChatDetectedDialect('');
    setChatInput('');
    setMatchedSchemes([]);
    setFeedbackSubmitted({});
    setTranslatedQuestions([]);
    setFormAnswers(['', '', '', '', '', '', '', '']);
    setCurrentlyRecordingField(null);
    setActiveTab('chat');
  };

  const handleSendAnswer = async (inputText = chatInput) => {
    if (!inputText.trim()) return;
    
    // Add user message to history
    const updatedMessages = [...chatMessages, { role: 'user' as const, content: inputText }];
    setChatMessages(updatedMessages);
    setChatInput('');
    setIsChatLoading(true);
    stopSpeaking();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: inputText,
          history: updatedMessages.slice(0, -1),
          profile: chatProfile,
          turnNumber: chatTurn,
          detectedLanguage: chatDetectedLanguage
        })
      });
      const data = await res.json();

      if (data.success) {
        setChatProfile(data.profile);
        setChatDetectedLanguage(data.detectedLanguage);
        if (data.dialect) setChatDetectedDialect(data.dialect);
        if (data.translatedQuestions) setTranslatedQuestions(data.translatedQuestions);

        if (data.isComplete) {
          setMatchedSchemes(data.schemes || []);
          setChatMessages([
            ...updatedMessages,
            { role: 'assistant', content: data.nextQuestion || 'We have analyzed your profile. Here are your matched entitlement programs.' }
          ]);
          setActiveTab('results');
          loadDashboardData(); // Reload history on dashboard if logged in
        } else {
          setChatMessages([
            ...updatedMessages,
            { role: 'assistant', content: data.nextQuestion }
          ]);
          setChatTurn(2); // Go to Phase 2: Form
        }
      } else {
        alert(data.error || 'Assistant failed to process. Please retry.');
      }
    } catch (err) {
      console.error(err);
      alert('Error connecting to assistant.');
    } finally {
      setIsChatLoading(false);
    }
  };

  // Text to Speech
  const speakText = (text: string, lang = 'en-IN') => {
    if (!synthesisRef.current) return;
    synthesisRef.current.cancel();
    
    // Split text into smaller chunks to avoid length limits in some SpeechSynthesis implementations
    const cleanText = text.replace(/[*#]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);

    // Map language names to codes
    utterance.lang = getLanguageCode(lang);

    utterance.onend = () => {
      setSpeakingSchemeId(null);
    };
    synthesisRef.current.speak(utterance);
  };

  const stopSpeaking = () => {
    if (synthesisRef.current) {
      synthesisRef.current.cancel();
      setSpeakingSchemeId(null);
    }
  };

  const toggleRecordingForField = (fieldIdx: number | null) => {
    if (!recognitionRef.current) return;
    
    setSpeechError(null);
    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
      setCurrentlyRecordingField(null);
    } else {
      stopSpeaking();
      
      // Suspend voice navigation background listener if active to avoid conflicts
      if (voiceNavRef.current) {
        tempPauseVoiceNav.current = true;
        if (voiceNavRecognitionRef.current) {
          try {
            voiceNavRecognitionRef.current.stop();
          } catch (e) {
            console.error('Failed to stop voice nav before active recording:', e);
          }
        }
      }

      try {
        setCurrentlyRecordingField(fieldIdx);
        // Set dynamic language code based on current chat detected language
        const langCode = getLanguageCode(chatDetectedLanguage);
        recognitionRef.current.lang = langCode;
        console.log(`Starting Speech Recognition for field ${fieldIdx} with language:`, langCode);

        recognitionRef.current.start();
        setIsRecording(true);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const toggleRecording = () => {
    toggleRecordingForField(null);
  };

  const handleSubmitForm = async () => {
    setIsMatchingLoading(true);
    stopSpeaking();
    try {
      const res = await fetch('/api/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: formAnswers
        })
      });
      const data = await res.json();
      if (data.success) {
        setChatProfile(data.profile);
        setMatchedSchemes(data.schemes || []);
        setActiveTab('results');
        loadDashboardData(); // Reload history on dashboard if logged in
      } else {
        alert(data.error || 'Failed to find matching schemes.');
      }
    } catch (err) {
      console.error(err);
      alert('Error connecting to match engine.');
    } finally {
      setIsMatchingLoading(false);
    }
  };

  const handlePlayScheme = (scheme: EligibilityResult) => {
    if (speakingSchemeId === scheme.schemeId) {
      stopSpeaking();
    } else {
      setSpeakingSchemeId(scheme.schemeId);
      const textToRead = `${scheme.title}. Department: ${scheme.ministry}. Overview: ${scheme.description}. Why you qualify: ${scheme.whyEligible}. Benefit details: ${scheme.benefits}. Application steps: ${scheme.stepsToApply.join('. ')}`;
      speakText(textToRead, chatDetectedLanguage);
    }
  };

  // User Actions
  const handleToggleBookmark = async (schemeId: string) => {
    if (!user) {
      openSignIn();
      return;
    }

    const isBookmarked = savedSchemes.some(s => s.id === schemeId);
    try {
      if (isBookmarked) {
        const res = await fetch(`/api/user/saved-schemes?schemeId=${schemeId}`, {
          method: 'DELETE'
        });
        if (res.ok) {
          setSavedSchemes(savedSchemes.filter(s => s.id !== schemeId));
        }
      } else {
        const res = await fetch('/api/user/saved-schemes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ schemeId })
        });
        if (res.ok) {
          loadDashboardData();
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleFeedback = async (schemeId: string, helpful: boolean) => {
    try {
      const res = await fetch('/api/user/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schemeId, helpful })
      });
      if (res.ok) {
        setFeedbackSubmitted({
          ...feedbackSubmitted,
          [schemeId]: helpful ? 'yes' : 'no'
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDownloadReport = async (primaryScheme: EligibilityResult) => {
    // Save report data to localStorage
    const printData = {
      profile: chatProfile,
      schemes: matchedSchemes,
      language: chatDetectedLanguage
    };
    localStorage.setItem('goonj_print_data', JSON.stringify(printData));

    // Open print view in new window
    window.open('/print', '_blank');

    // Log download to DB if user is logged in
    if (user) {
      try {
        await fetch('/api/user/reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            schemeTitle: primaryScheme.title,
            language: chatDetectedLanguage
          })
        });
        loadDashboardData();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const getShareLink = (scheme: EligibilityResult, type: 'whatsapp' | 'telegram') => {
    const text = encodeURIComponent(
      `🔔 *${scheme.title}* (${scheme.ministry || 'Government Scheme'})\n\n` +
      `💡 *Why you qualify:* ${scheme.whyEligible}\n\n` +
      `🎁 *Benefits:* ${scheme.benefits}\n\n` +
      `📌 Discover every scheme you qualify for in your language using GOONJ!`
    );
    if (type === 'whatsapp') return `https://api.whatsapp.com/send?text=${text}`;
    return `https://t.me/share/url?url=${encodeURIComponent(window.location.origin)}&text=${text}`;
  };

  // Load session when Clerk is loaded or authentication status changes
  useEffect(() => {
    if (isLoaded) {
      fetchSession();
    }
  }, [isLoaded, isSignedIn]);

  // Load user session on mount
  useEffect(() => {
    // Check Speech Recognition support
    if (typeof window !== 'undefined') {
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      const win = window as any;
      const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;
      if (SpeechRecognition) {
        setSpeechSupported(true);
        const rec = new SpeechRecognition();
        rec.continuous = false;
        rec.interimResults = false;
        rec.lang = 'en-IN'; // Default to mixed English/Indian speech capture
        
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        rec.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          const fieldIdx = currentlyRecordingFieldRef.current;
          
          if (fieldIdx !== null) {
            setFormAnswers(prev => {
              const updated = [...prev];
              updated[fieldIdx] = transcript;
              return updated;
            });
            setIsRecording(false);
            setCurrentlyRecordingField(null);
          } else {
            setChatInput(transcript);
            setIsRecording(false);
            // Auto submit spoken answer after a short pause
            setTimeout(() => {
              handleSendAnswerRef.current(transcript);
            }, 400);
          }
        };

        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        rec.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          setIsRecording(false);
          if (event.error === 'network') {
            setSpeechError('Speech recognition requires internet. Type your answer.');
          } else if (event.error === 'not-allowed') {
            setSpeechError('Microphone permission denied.');
          } else {
            setSpeechError(`Speech error (${event.error}). Please type.`);
          }
        };

        rec.onend = () => {
          setIsRecording(false);
          // Resume background voice navigation if it was suspended
          if (voiceNavRef.current && tempPauseVoiceNav.current) {
            tempPauseVoiceNav.current = false;
            if (voiceNavRecognitionRef.current) {
              try {
                voiceNavRecognitionRef.current.start();
              } catch (e) {
                console.error('Failed to restart voice nav after active recording:', e);
              }
            }
          }
        };

        recognitionRef.current = rec;
      }
      synthesisRef.current = window.speechSynthesis;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Read out Assistant questions when they appear
  useEffect(() => {
    if (activeTab === 'chat' && chatMessages.length > 0 && autoSpeak) {
      const lastMessage = chatMessages[chatMessages.length - 1];
      if (lastMessage.role === 'assistant') {
        speakText(lastMessage.content, chatDetectedLanguage);
      }
    }
  }, [chatMessages, activeTab, autoSpeak, chatDetectedLanguage]);

  // Voice Navigation listener
  useEffect(() => {
    if (!speechSupported) return;
    
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const win = window as any;
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;
    
    if (voiceNav) {
      const navRec = new SpeechRecognition();
      navRec.continuous = true;
      navRec.interimResults = false;
      navRec.lang = 'en-IN';
      
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      navRec.onresult = (event: any) => {
        const lastIndex = event.results.length - 1;
        const transcript = event.results[lastIndex][0].transcript.toLowerCase().trim();
        console.log('Voice Navigation Heard:', transcript);

        if (transcript.includes('go home') || transcript.includes('home')) {
          setActiveTab('home');
          speakText('Going home');
        } else if (transcript.includes('dashboard') || transcript.includes('profile')) {
          setActiveTab('dashboard');
          speakText('Opening dashboard');
        } else if (transcript.includes('restart') || transcript.includes('reset')) {
          handleStartChat();
        } else if (transcript.includes('logout') || transcript.includes('log out')) {
          handleLogout();
        } else if (transcript.includes('print') || transcript.includes('download')) {
          if (matchedSchemes.length > 0) {
            handleDownloadReport(matchedSchemes[0]);
          }
        }
      };

      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      navRec.onerror = (err: any) => {
        console.error('Voice navigation error:', err.error);
      };

      navRec.onend = () => {
        // Keep listening if voiceNav is still true and not suspended for active recording
        if (voiceNav && !tempPauseVoiceNav.current) {
          try { navRec.start(); } catch { }
        }
      };

      try {
        navRec.start();
        voiceNavRecognitionRef.current = navRec;
      } catch {
        // Ignored
      }
    } else {
      if (voiceNavRecognitionRef.current) {
        voiceNavRecognitionRef.current.stop();
        voiceNavRecognitionRef.current = null;
      }
    }

    return () => {
      if (voiceNavRecognitionRef.current) {
        voiceNavRecognitionRef.current.stop();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceNav, matchedSchemes]);

  return (
    <div className={`min-h-screen flex flex-col font-sans selection:bg-purple-500 selection:text-white transition-all duration-300 ${
      largeText ? 'large-text' : ''
    } ${
      highContrast ? 'high-contrast' : ''
    }`}>
      {/* Floating Accessibility Settings Widget */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 bg-zinc-900/90 border border-zinc-800 p-2.5 rounded-2xl shadow-xl backdrop-blur-md print:hidden">
        <div className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest text-center border-b border-zinc-800 pb-1.5 mb-1">
          Accessibility
        </div>
        <button
          onClick={() => setLargeText(!largeText)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            largeText ? 'bg-purple-600 text-white shadow-md' : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
          }`}
          title="Toggle Large Text Mode for elderly & low-vision users"
        >
          Text Size: {largeText ? 'Large' : 'Normal'}
        </button>
        <button
          onClick={() => setHighContrast(!highContrast)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            highContrast ? 'bg-purple-600 text-white shadow-md' : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
          }`}
          title="Toggle High Contrast Mode for visually impaired users"
        >
          Contrast: {highContrast ? 'High' : 'Normal'}
        </button>
        <button
          onClick={() => {
            setVoiceNav(!voiceNav);
            if (!voiceNav) speakText('Voice navigation enabled. Speak commands like home, dashboard, or restart anytime.');
            else speakText('Voice navigation disabled');
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
            voiceNav ? 'bg-teal-600 text-white shadow-md animate-pulse' : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
          }`}
          title="Toggle Voice Navigation (Say commands like: home, dashboard, restart)"
        >
          <Mic size={10} /> Voice Nav: {voiceNav ? 'On' : 'Off'}
        </button>
      </div>

      {/* Main Header / Navigation Bar */}
      <header className="sticky top-0 z-40 bg-zinc-950/80 border-b border-zinc-900 backdrop-blur-md print:hidden">
        <div className="max-w-6xl mx-auto w-full px-4 h-16 flex items-center justify-between">
          <div 
            onClick={() => setActiveTab('home')}
            className="flex items-center gap-2 cursor-pointer group"
          >
            <div className="bg-gradient-to-tr from-purple-600 to-teal-500 p-1.5 rounded-xl group-hover:scale-105 transition-transform">
              <Sparkles className="text-white" size={18} />
            </div>
            <span className="font-extrabold text-xl tracking-tight text-white flex items-center gap-1">
              GOONJ <span className="text-[10px] bg-purple-950 border border-purple-800 text-purple-300 font-bold px-1.5 py-0.5 rounded uppercase">गूंज</span>
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-zinc-400">
            <button onClick={() => setActiveTab('home')} className={`hover:text-white transition-colors ${activeTab === 'home' ? 'text-purple-400' : ''}`}>Home</button>
            <button onClick={handleStartChat} className={`hover:text-white transition-colors ${activeTab === 'chat' ? 'text-purple-400' : ''}`}>Voice Finder</button>
            <a href="/admin" className="hover:text-white transition-colors">Admin Panel</a>
          </nav>

          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                    activeTab === 'dashboard' 
                      ? 'bg-purple-600/20 border-purple-500 text-purple-300' 
                      : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  <User size={14} /> {user.name}
                </button>
                <button
                  onClick={handleLogout}
                  className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-red-400 transition-colors"
                  title="Logout"
                >
                  <LogOut size={14} />
                </button>
              </div>
            ) : (
              <SignInButton mode="modal">
                <button
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-purple-900/20"
                >
                  Log In / Register
                </button>
              </SignInButton>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section & Landing Tab */}
      {activeTab === 'home' && (
        <main className="flex-1 flex flex-col items-center print:hidden">
          {/* Hero Header */}
          <section className="max-w-6xl w-full px-4 pt-16 md:pt-24 pb-12 text-center flex flex-col items-center">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-purple-950/60 border border-purple-800/60 text-purple-300 mb-6 animate-pulse">
              <Sparkles size={12} /> AI-Powered Voice Entitlement Finder
            </span>
            
            <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white leading-tight max-w-3xl mb-6">
              Government Benefits, <br/>
              <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-teal-400 bg-clip-text text-transparent">
                Explained In Your Language
              </span>
            </h1>
            
            <p className="text-zinc-400 text-base md:text-lg max-w-xl leading-relaxed mb-10">
              Speak naturally, answer a few questions, and instantly discover all central and state government schemes you qualify for.
            </p>

            {/* Pulsing microphone centered illustration */}
            <div className="relative mb-12 group cursor-pointer" onClick={handleStartChat}>
              {/* Voice waves circles */}
              <div className="absolute inset-0 bg-purple-500/20 rounded-full blur-2xl scale-125 opacity-70 group-hover:scale-150 transition-transform duration-500" />
              <div className="relative w-28 h-28 md:w-32 md:h-32 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center shadow-2xl animate-voice-pulse hover:border-purple-500/50 transition-colors">
                <Mic size={42} className="text-purple-400 group-hover:text-purple-300 transition-colors" />
              </div>
              <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest mt-4 group-hover:text-zinc-300 transition-colors">
                Click to Speak Naturally
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={handleStartChat}
                className="px-8 py-3.5 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white font-bold rounded-xl shadow-lg shadow-purple-900/30 transition-all text-sm"
              >
                Continue Without Login
              </button>
              {user ? (
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className="px-8 py-3.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-bold rounded-xl transition-all text-sm"
                >
                  View Dashboard
                </button>
              ) : (
                <SignInButton mode="modal">
                  <button
                    className="px-8 py-3.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-bold rounded-xl transition-all text-sm"
                  >
                    View Dashboard
                  </button>
                </SignInButton>
              )}
            </div>
          </section>

          {/* How Goonj Works */}
          <section className="max-w-6xl w-full px-4 py-16 border-t border-zinc-900">
            <h2 className="text-2xl md:text-3xl font-extrabold text-white text-center mb-12">
              How Goonj Works
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { step: "1", title: "Speak In Your Language", desc: "Just describe your situation using the microphone. Talk naturally in Hindi, Bhojpuri, Tamil, or any regional tongue." },
                { step: "2", title: "Answer Simple Questions", desc: "No complex forms. Our friendly AI reads out a few missing demographic questions one at a time." },
                { step: "3", title: "AI Checks Eligibility", desc: "Goonj instantly cross-references criteria databases and filters state and central scheme directives." },
                { step: "4", title: "Get Matching Schemes", desc: "View detailed results, benefits breakdowns, required documents, and get exact step-by-step checklists." }
              ].map((s, idx) => (
                <div key={idx} className="glass-panel glass-panel-hover rounded-2xl p-6 relative overflow-hidden flex flex-col h-full">
                  <div className="absolute -right-4 -bottom-6 text-8xl font-black text-purple-950/20 select-none">
                    {s.step}
                  </div>
                  <div className="w-8 h-8 rounded-full bg-purple-950/60 border border-purple-800/40 text-purple-300 font-bold flex items-center justify-center text-xs mb-4">
                    {s.step}
                  </div>
                  <h3 className="font-bold text-white text-base mb-2">{s.title}</h3>
                  <p className="text-zinc-400 text-xs leading-relaxed flex-1">{s.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Why Goonj */}
          <section className="max-w-6xl w-full px-4 py-16 border-t border-zinc-900 bg-gradient-to-b from-zinc-950/50 to-transparent">
            <h2 className="text-2xl md:text-3xl font-extrabold text-white text-center mb-12">
              Why Goonj
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
              {[
                { title: "Voice-First & Multilingual", desc: "Designed for citizens who struggle with typing. Supports Hindi, English, Bhojpuri, Bengali, Tamil, Telugu, and all major Indian languages." },
                { title: "Central & State Cataloging", desc: "Automatically matches state-specific criteria (like Bihar or Maharashtra welfare schemes) alongside nation-wide schemes." },
                { title: "Exact Step-by-Step Guidance", desc: "Tells you precisely WHY you qualify to earn trust, lists required files, and maps application timelines." },
                { title: "Full Audio Playback Assistance", desc: "Every benefit detail and instruction checklist can be read aloud in your own language with human-like voices." },
                { title: "Personalized History Logs", desc: "Register in 5 seconds with a mobile number to bookmark schemes, save search profiles, and download summaries." },
                { title: "100% Free & Secure", desc: "Built with transparency and privacy. No registration fees, no hidden portals. Entirely accessibility-friendly." }
              ].map((b, idx) => (
                <div key={idx} className="p-4 border-l border-purple-500/30">
                  <h3 className="font-extrabold text-white text-base mb-2 flex items-center gap-1.5">
                    <CheckCircle2 size={16} className="text-teal-400" />
                    {b.title}
                  </h3>
                  <p className="text-zinc-400 text-xs leading-relaxed">{b.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Language support Section */}
          <section className="max-w-6xl w-full px-4 py-16 border-t border-zinc-900">
            <h2 className="text-xl font-bold text-zinc-400 text-center mb-8 uppercase tracking-widest">
              Supported Regional Languages
            </h2>
            <div className="flex flex-wrap gap-2.5 justify-center max-w-2xl mx-auto">
              {[
                "Hindi (हिंदी)", "English", "Bhojpuri (भोजपुरी)", "Bengali (বাংলা)", 
                "Tamil (தமிழ்)", "Telugu (తెలుగు)", "Marathi (मराठी)", "Gujarati (ગુજરાતી)", 
                "Kannada (ಕನ್ನಡ)", "Malayalam (മലയാളം)", "Punjabi (ਪੰਜਾਬੀ)", "Odia (ଓଡ଼ିଆ)",
                "Any Regional Language..."
              ].map((lang, idx) => (
                <span 
                  key={idx}
                  className="px-3.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:border-purple-600/50 text-xs font-medium cursor-default transition-all hover:scale-105"
                >
                  {lang}
                </span>
              ))}
            </div>
          </section>

          {/* Trust Section */}
          <section className="max-w-6xl w-full px-4 py-12 border-t border-zinc-900 bg-zinc-950/20 text-center">
            <div className="flex flex-wrap gap-8 justify-center items-center text-xs text-zinc-400 font-semibold uppercase tracking-wider">
              <span className="flex items-center gap-1.5"><Landmark size={14} className="text-purple-400" /> Central Govt Schemes</span>
              <span className="flex items-center gap-1.5"><Building size={14} className="text-purple-400" /> State Govt Schemes</span>
              <span className="flex items-center gap-1.5"><Mic size={14} className="text-purple-400" /> Voice Assistance</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-purple-400" /> Accessibility Friendly</span>
            </div>
          </section>
        </main>
      )}

      {/* Conversational Assistant / Form Discoverer Tab */}
      {activeTab === 'chat' && (
        <main className="flex-1 flex flex-col max-w-4xl mx-auto w-full px-4 py-8 md:py-12 justify-center print:hidden animate-fade-in">
          <div className="glass-panel rounded-3xl p-6 md:p-8 border border-zinc-800 flex flex-col min-h-[480px]">
            {/* Header info */}
            <div className="flex justify-between items-center border-b border-zinc-900 pb-4 mb-6 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white flex items-center gap-1">
                  <Sparkles size={12} className="text-purple-400 animate-pulse" /> 
                  Voice Assistant Finder
                </span>
                <span className="text-zinc-600">|</span>
                <span className="text-zinc-400">
                  {chatTurn === 1 ? 'Phase 1: Language Detection' : 'Phase 2: Standard Form'}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {chatDetectedLanguage && (
                  <span className="bg-zinc-950 border border-zinc-800 px-2 py-0.5 rounded text-zinc-300 uppercase font-bold text-[10px] flex items-center gap-1">
                    <Globe size={10} className="text-purple-400" />
                    {chatDetectedLanguage} {chatDetectedDialect && `(${chatDetectedDialect})`}
                  </span>
                )}
              </div>
            </div>

            {/* Error display */}
            {speechError && (
              <div className="p-3 bg-red-950/20 border border-red-900/50 rounded-xl flex items-center gap-2 text-red-300 text-xs mb-4">
                <AlertCircle size={14} />
                <span>{speechError}</span>
              </div>
            )}

            {/* Phase 1: Speak to Detect Language */}
            {chatTurn === 1 && (
              <div className="flex-1 flex flex-col items-center justify-center py-6 text-center">
                <div className="max-w-md mx-auto space-y-6">
                  <div className="space-y-2">
                    <h2 className="text-xl md:text-2xl font-extrabold text-white">
                      प्रारंभ करने के लिए बोलें / Speak to Start
                    </h2>
                    <p className="text-zinc-400 text-xs md:text-sm leading-relaxed">
                      अपनी स्थानीय भाषा में कुछ भी कहें (जैसे "नमस्ते" या "हेलो") ताकि हम आपकी भाषा समझ सकें।
                      <br />
                      <span className="text-zinc-500 text-[11px] block mt-1">
                        Speak anything in your mother tongue so we can configure the interface for you.
                      </span>
                    </p>
                  </div>

                  <div className="flex flex-col items-center justify-center gap-4 py-6">
                    <button
                      onClick={() => toggleRecordingForField(null)}
                      disabled={!speechSupported || isChatLoading}
                      className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${
                        isRecording && currentlyRecordingField === null
                          ? 'bg-teal-500 text-white animate-voice-pulse shadow-lg shadow-teal-500/30'
                          : 'bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:scale-105 disabled:opacity-40'
                      }`}
                      title={isRecording ? 'Stop Recording' : 'Speak now'}
                    >
                      {isRecording && currentlyRecordingField === null ? <MicOff size={36} /> : <Mic size={36} />}
                    </button>
                    {isRecording && currentlyRecordingField === null && (
                      <span className="text-xs font-bold text-teal-400 animate-pulse uppercase tracking-wider">
                        Listening... Speak now
                      </span>
                    )}
                  </div>

                  {/* Fallback Input */}
                  <div className="flex gap-2 max-w-sm mx-auto">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleSendAnswer();
                      }}
                      placeholder="Or type greeting (e.g. Namaste)..."
                      className="flex-1 bg-zinc-950 border border-zinc-850 rounded-xl p-2.5 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-purple-600"
                      disabled={isChatLoading || isRecording}
                    />
                    <button
                      onClick={() => handleSendAnswer()}
                      disabled={!chatInput.trim() || isChatLoading || isRecording}
                      className="px-4 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white font-bold rounded-xl text-xs flex items-center justify-center transition-all"
                    >
                      {isChatLoading ? <Loader2 size={12} className="animate-spin" /> : 'Next'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Phase 2: Show Form */}
            {chatTurn === 2 && (
              <div className="flex-1 flex flex-col gap-6">
                <div className="p-4 bg-purple-950/20 border border-purple-900/30 rounded-2xl flex items-start gap-3">
                  <Sparkles size={16} className="text-purple-400 mt-0.5 animate-pulse" />
                  <div className="space-y-1">
                    <h3 className="text-xs font-bold text-purple-300 uppercase tracking-wider">Language Detected: {chatDetectedLanguage}</h3>
                    <p className="text-zinc-300 text-xs md:text-sm leading-relaxed">
                      कृपया नीचे दिए गए प्रपत्र को अपनी भाषा में भरें। प्रत्येक प्रश्न को सुनने के लिए लाउडस्पीकर बटन दबाएं, और उत्तर देने के लिए माइक का उपयोग करें।
                      <span className="text-zinc-500 block text-[11px] mt-1">
                        Please answer the questions below. Press the speaker to listen, and the mic to speak your answer.
                      </span>
                    </p>
                  </div>
                </div>

                {/* Form fields grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[380px] overflow-y-auto pr-2 py-2">
                  {translatedQuestions.map((qText, i) => (
                    <div key={i} className="space-y-2 p-4 rounded-2xl bg-zinc-900/30 border border-zinc-850/50 flex flex-col justify-between">
                      <div className="flex justify-between items-start gap-2">
                        <label className="text-xs md:text-sm font-semibold text-zinc-200 block flex-1">
                          <span className="text-purple-400 font-bold mr-1">Q{i + 1}.</span>
                          {qText}
                        </label>
                        <button
                          type="button"
                          onClick={() => speakText(qText, chatDetectedLanguage)}
                          className="p-1.5 rounded-lg bg-zinc-950 border border-zinc-850 hover:border-purple-600/50 text-zinc-400 hover:text-white transition-all cursor-pointer"
                          title="Listen to question"
                        >
                          <Volume2 size={12} />
                        </button>
                      </div>

                      <div className="flex gap-2 mt-2 items-center">
                        <input
                          type="text"
                          value={formAnswers[i]}
                          onChange={e => {
                            const val = e.target.value;
                            setFormAnswers(prev => {
                              const updated = [...prev];
                              updated[i] = val;
                              return updated;
                            });
                          }}
                          placeholder="Speak or type answer..."
                          className="flex-1 bg-zinc-950 border border-zinc-850 rounded-xl p-2.5 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-purple-600"
                          disabled={isMatchingLoading}
                        />
                        <button
                          type="button"
                          onClick={() => toggleRecordingForField(i)}
                          disabled={isMatchingLoading || !speechSupported}
                          className={`p-2.5 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                            isRecording && currentlyRecordingField === i
                              ? 'bg-teal-500 text-white animate-voice-pulse'
                              : 'bg-zinc-950 border border-zinc-850 text-zinc-400 hover:text-white hover:border-teal-500/50'
                          }`}
                          title="Speak answer"
                        >
                          {isRecording && currentlyRecordingField === i ? <MicOff size={14} /> : <Mic size={14} />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Submission and controls */}
                <div className="border-t border-zinc-900 pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
                  <button
                    onClick={() => {
                      stopSpeaking();
                      setActiveTab('home');
                    }}
                    className="flex items-center gap-1 text-xs text-zinc-500 hover:text-white transition-all order-2 md:order-1 cursor-pointer"
                  >
                    <ChevronLeft size={14} /> Back to Home
                  </button>

                  <div className="flex gap-3 order-1 md:order-2 w-full md:w-auto">
                    <button
                      onClick={handleStartChat}
                      className="px-4 py-2.5 rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white text-xs font-bold transition-all flex items-center gap-1.5 justify-center flex-1 md:flex-none cursor-pointer"
                    >
                      <RotateCcw size={12} /> Reset
                    </button>
                    <button
                      onClick={handleSubmitForm}
                      disabled={isMatchingLoading || !formAnswers.some(ans => ans.trim())}
                      className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 flex-1 md:flex-none cursor-pointer"
                    >
                      {isMatchingLoading ? (
                        <>
                          <Loader2 size={12} className="animate-spin" />
                          <span>Searching...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={12} className="text-teal-400" />
                          <span>Find Schemes / योजनाएं खोजें</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      )}

      {/* Results View Tab */}
      {activeTab === 'results' && (
        <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8 md:py-12 flex flex-col gap-6 print:p-0">
          {/* Print preview banner */}
          <div className="glass-panel rounded-2xl p-5 border border-zinc-800 flex flex-wrap gap-4 text-xs text-zinc-400 items-center justify-between print:hidden">
            <div className="flex items-center gap-2">
              <span className="inline-flex px-2 py-0.5 bg-purple-950/60 border border-purple-800/40 text-purple-300 font-bold rounded">
                Matched Profile
              </span>
              <span className="font-semibold text-white">{chatProfile.state}</span>
              <span className="text-zinc-700">|</span>
              <span className="font-semibold text-white">{chatProfile.age} Years</span>
              <span className="text-zinc-700">|</span>
              <span className="font-semibold text-white">{chatProfile.gender}</span>
              <span className="text-zinc-700">|</span>
              <span className="font-semibold text-white capitalize">{chatProfile.occupation || 'citizen'}</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (matchedSchemes.length > 0) {
                    handleDownloadReport(matchedSchemes[0]);
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-xs text-white font-bold rounded-xl transition-all"
              >
                <Printer size={12} className="text-purple-400" /> Save Report (PDF)
              </button>
              <button
                onClick={handleStartChat}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-zinc-850 hover:bg-zinc-900 text-[10px] text-zinc-500 hover:text-white transition-colors"
              >
                <RotateCcw size={12} /> Restart
              </button>
            </div>
          </div>

          {/* Results Summary */}
          {matchedSchemes.length === 0 ? (
            <div className="text-center py-20 glass-panel rounded-3xl p-8 border border-zinc-800 print:hidden">
              <Landmark size={48} className="text-zinc-700 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-zinc-400 mb-2">No Qualifying Entitlements</h2>
              <p className="text-zinc-500 text-sm max-w-xs mx-auto mb-8 leading-relaxed">
                We scanned our active directories but could not find schemes matching your demographics profile.
              </p>
              <button
                onClick={handleStartChat}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs transition-all"
              >
                <RotateCcw size={14} /> Retry Voice Discovery
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex justify-between items-center print:hidden">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <ShieldCheck size={18} className="text-teal-400 animate-bounce" />
                  Your Qualified Entitlements ({matchedSchemes.length})
                </h2>
              </div>

              {/* Scheme Cards mapping */}
              {matchedSchemes.map((scheme, idx) => (
                <div 
                  key={scheme.schemeId || idx} 
                  className="glass-panel rounded-2xl p-6 border border-zinc-800 relative overflow-hidden print:border-zinc-300 print:bg-white print:text-black print:shadow-none print:break-inside-avoid"
                >
                  {/* Left accent strip (hidden on print) */}
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-purple-500 to-teal-500 print:hidden" />
                  
                  {/* Card Header */}
                  <div className="flex justify-between items-start gap-4 mb-4">
                    <div>
                      <div className="flex flex-wrap gap-2 items-center mb-1">
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-purple-300 bg-purple-950/60 border border-purple-800/40 px-2 py-0.5 rounded uppercase print:border-zinc-300 print:bg-zinc-100 print:text-zinc-600">
                          <Building size={10} /> {scheme.ministry || 'Government Department'}
                        </span>
                        <span className="inline-flex px-2 py-0.5 text-[9px] font-bold text-teal-300 bg-teal-950/60 border border-teal-800/40 rounded uppercase print:border-zinc-300 print:bg-zinc-100 print:text-zinc-600">
                          Active
                        </span>
                      </div>
                      <h3 className="text-lg md:text-xl font-bold text-white leading-snug print:text-black">
                        {scheme.title}
                      </h3>
                      <p className="text-xs text-zinc-400 mt-2 leading-relaxed italic print:text-zinc-700 border-l-2 border-purple-500/40 pl-3">
                        {scheme.description}
                      </p>
                    </div>

                    {/* Speaker & Action Buttons */}
                    <div className="flex gap-2 print:hidden shrink-0">
                      <button
                        onClick={() => handleToggleBookmark(scheme.schemeId)}
                        className={`p-2.5 rounded-xl border transition-all ${
                          savedSchemes.some(s => s.id === scheme.schemeId)
                            ? 'bg-purple-600 border-purple-500 text-white'
                            : 'bg-zinc-900 border-zinc-850 text-zinc-400 hover:text-white'
                        }`}
                        title="Bookmark Scheme"
                      >
                        <Bookmark size={16} />
                      </button>
                      <button
                        onClick={() => handlePlayScheme(scheme)}
                        className={`p-2.5 rounded-xl border transition-all ${
                          speakingSchemeId === scheme.schemeId
                            ? 'bg-teal-500 border-teal-400 text-white animate-pulse'
                            : 'bg-zinc-900 border-zinc-850 text-zinc-400 hover:text-white'
                        }`}
                        title={speakingSchemeId === scheme.schemeId ? 'Stop Speaking' : 'Read details aloud'}
                      >
                        <Volume2 size={16} />
                      </button>
                      <div className="relative">
                        <button
                          onClick={() => setActiveShareMenu(activeShareMenu === scheme.schemeId ? null : scheme.schemeId)}
                          className="p-2.5 rounded-xl border bg-zinc-900 border-zinc-850 text-zinc-400 hover:text-white transition-all"
                          title="Share Scheme"
                        >
                          <Share2 size={16} />
                        </button>
                        {activeShareMenu === scheme.schemeId && (
                          <div className="absolute right-0 mt-2 z-50 w-32 bg-zinc-950 border border-zinc-800 rounded-xl shadow-xl p-1 text-[11px] font-bold">
                            <a 
                              href={getShareLink(scheme, 'whatsapp')} 
                              target="_blank" 
                              className="block px-3 py-2 text-zinc-300 hover:bg-zinc-900 rounded-lg hover:text-white"
                              onClick={() => setActiveShareMenu(null)}
                            >
                              WhatsApp
                            </a>
                            <a 
                              href={getShareLink(scheme, 'telegram')} 
                              target="_blank" 
                              className="block px-3 py-2 text-zinc-300 hover:bg-zinc-900 rounded-lg hover:text-white"
                              onClick={() => setActiveShareMenu(null)}
                            >
                              Telegram
                            </a>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(`${scheme.title} - ${scheme.whyEligible}. Learn more on Goonj.`);
                                alert('Link copied to clipboard!');
                                setActiveShareMenu(null);
                              }}
                              className="w-full text-left block px-3 py-2 text-zinc-300 hover:bg-zinc-900 rounded-lg hover:text-white"
                            >
                              Copy Details
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Why eligible card */}
                  <div className="bg-zinc-950/60 border border-zinc-850 rounded-xl p-4 mb-4 text-xs text-zinc-300 leading-relaxed print:bg-zinc-50 print:border-zinc-200 print:text-zinc-800">
                    <span className="font-extrabold text-white text-[9px] uppercase tracking-wider block mb-1 print:text-zinc-600">
                      Why You Qualify
                    </span>
                    {scheme.whyEligible}
                  </div>

                  {/* Benefit highlights */}
                  <div className="bg-zinc-950/40 border border-zinc-850 rounded-xl p-4 mb-4 text-xs text-zinc-300 leading-relaxed print:bg-zinc-50 print:border-zinc-200 print:text-zinc-800">
                    <span className="font-extrabold text-white text-[9px] uppercase tracking-wider block mb-1 print:text-zinc-600">
                      Benefits Offered
                    </span>
                    {scheme.benefits}
                  </div>

                  {/* Step by step checklist timeline */}
                  <div>
                    <span className="font-extrabold text-white text-xs uppercase tracking-wider block mb-3 print:text-zinc-800">
                      Application steps Checklist
                    </span>
                    
                    <div className="space-y-2">
                      {scheme.stepsToApply.map((step, sIdx) => (
                        <div key={sIdx} className="flex items-start gap-3 bg-zinc-950/20 border border-zinc-900/60 p-3 rounded-xl hover:border-zinc-850 transition-colors print:border-zinc-150 print:bg-white print:text-zinc-800">
                          <input
                            type="checkbox"
                            className="mt-0.5 w-4 h-4 rounded border-zinc-800 text-purple-600 bg-zinc-900 cursor-pointer focus:ring-0 print:border-zinc-300 print:bg-zinc-50"
                          />
                          <span className="text-xs text-zinc-300 font-medium leading-relaxed print:text-zinc-800">
                            {step}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Apply URL Section */}
                  <div className="mt-5 pt-4 border-t border-zinc-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">
                        {scheme.applyUrl ? 'Official Application Portal' : scheme.documentUrl ? 'Application / Circular Source' : 'Official Application Portal'}
                      </span>
                      <span className="text-xs text-zinc-300 font-semibold mt-0.5 block truncate max-w-[280px]" title={scheme.applyUrl || scheme.documentUrl || 'Search portal'}>
                        {scheme.applyUrl || scheme.documentUrl || 'Search eligibility & apply process'}
                      </span>
                    </div>
                    <a
                      href={(() => {
                        if (scheme.applyUrl) {
                          const clean = scheme.applyUrl.trim();
                          if (clean.startsWith('http://') || clean.startsWith('https://')) {
                            return clean;
                          }
                          if (clean.includes('.') && !clean.includes(' ')) {
                            return `https://${clean}`;
                          }
                          return `https://www.google.com/search?q=${encodeURIComponent(scheme.applyUrl)}`;
                        }
                        if (scheme.documentUrl) {
                          const clean = scheme.documentUrl.replace(/^(Official Portal:\s*|Official:\s*)/i, '').trim();
                          if (clean.startsWith('http://') || clean.startsWith('https://')) {
                            return clean;
                          }
                          if (clean.includes('.') && !clean.includes(' ')) {
                            return `https://${clean}`;
                          }
                          return `https://www.google.com/search?q=${encodeURIComponent(scheme.documentUrl)}`;
                        }
                        return `https://www.google.com/search?q=${encodeURIComponent(scheme.title + ' scheme apply online official website')}`;
                      })()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-teal-900/20 shrink-0 print:hidden cursor-pointer"
                    >
                      <Globe size={12} /> Apply Now / View Portal
                    </a>
                  </div>

                  {/* Feedback widget */}
                  <div className="border-t border-zinc-900/60 mt-6 pt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400 print:hidden">
                    <div className="flex items-center gap-1.5">
                      <HelpCircle size={14} className="text-purple-400" /> Was this assessment information helpful?
                    </div>
                    <div className="flex gap-2">
                      {feedbackSubmitted[scheme.schemeId] ? (
                        <span className="text-teal-400 font-semibold flex items-center gap-1">
                          <Check size={12} /> Thank you for your feedback!
                        </span>
                      ) : (
                        <>
                          <button
                            onClick={() => handleFeedback(scheme.schemeId, true)}
                            className="px-3 py-1 bg-zinc-900 border border-zinc-850 hover:bg-zinc-850 hover:text-white rounded-lg transition-colors"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => handleFeedback(scheme.schemeId, false)}
                            className="px-3 py-1 bg-zinc-900 border border-zinc-850 hover:bg-zinc-850 hover:text-white rounded-lg transition-colors"
                          >
                            No
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      {/* User Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8 md:py-12 print:hidden">
          {user ? (
            <div className="space-y-8">
              {/* Profile details summary card */}
              <div className="glass-panel rounded-2xl p-6 border border-zinc-800 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-28 h-28 bg-purple-500/10 rounded-full blur-2xl" />
                <div className="flex flex-wrap gap-4 items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-gradient-to-tr from-purple-600 to-teal-500 p-2.5 rounded-2xl">
                      <User size={24} className="text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">{user.name}</h2>
                      <p className="text-xs text-zinc-400 flex items-center gap-1">
                        <Phone size={10} /> {user.phone} • Active Citizen Account
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-6 text-center text-xs">
                    <div className="bg-zinc-950/60 border border-zinc-900 px-4 py-2.5 rounded-xl">
                      <div className="font-extrabold text-white text-lg">{savedSchemes.length}</div>
                      <div className="text-zinc-500 font-semibold uppercase tracking-wider text-[9px] mt-0.5">Saved Schemes</div>
                    </div>
                    <div className="bg-zinc-950/60 border border-zinc-900 px-4 py-2.5 rounded-xl">
                      <div className="font-extrabold text-white text-lg">{searchHistory.length}</div>
                      <div className="text-zinc-500 font-semibold uppercase tracking-wider text-[9px] mt-0.5">Total Searches</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Main dashboard sections grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Bookmarks Column */}
                <div className="lg:col-span-2 space-y-4">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Bookmark size={18} className="text-purple-400" /> Saved Welfare Schemes ({savedSchemes.length})
                  </h3>

                  {isDashLoading ? (
                    <div className="py-20 flex justify-center text-zinc-400">
                      <Loader2 className="animate-spin text-purple-400" />
                    </div>
                  ) : savedSchemes.length === 0 ? (
                    <div className="text-center py-16 border border-dashed border-zinc-800 rounded-2xl bg-zinc-950/20 text-zinc-500">
                      <Bookmark className="mx-auto text-zinc-700 mb-3" size={32} />
                      <p className="text-xs">No bookmarks saved yet.</p>
                      <button 
                        onClick={handleStartChat}
                        className="mt-3 text-xs text-purple-400 hover:text-purple-300 font-bold"
                      >
                        Start voice search
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {savedSchemes.map(sch => (
                        <div key={sch.id} className="glass-panel glass-panel-hover rounded-xl p-5 border border-zinc-850 flex flex-col justify-between">
                          <div>
                            <span className="inline-block px-2 py-0.5 rounded text-[9px] font-bold bg-purple-950 border border-purple-900 text-purple-300 uppercase mb-2">
                              {sch.state}
                            </span>
                            <h4 className="font-bold text-white text-sm line-clamp-1" title={sch.title}>{sch.title}</h4>
                            <p className="text-zinc-400 text-[11px] line-clamp-2 mt-1 leading-relaxed">{sch.documentUrl || 'Official guideline PDF cataloged.'}</p>
                          </div>
                          <div className="flex justify-between items-center mt-4 border-t border-zinc-900 pt-3 text-xs text-zinc-500">
                            <span>{sch.ministry || 'State Scheme'}</span>
                            <button
                              onClick={async () => {
                                // Load details and matching format
                                stopSpeaking();
                                setIsChatLoading(true);
                                setActiveTab('chat');
                                try {
                                  const res = await fetch('/api/chat', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      message: `I need information on ${sch.title}`,
                                      turnNumber: 8,
                                      profile: { state: sch.state }
                                    })
                                  });
                                  const data = await res.json();
                                  if (data.success) {
                                    setMatchedSchemes(data.schemes || []);
                                    setChatMessages([
                                      { role: 'assistant', content: `Here is the assessment details for ${sch.title}.` }
                                    ]);
                                    setActiveTab('results');
                                  }
                                } catch (e) {
                                  console.error(e);
                                  setActiveTab('dashboard');
                                } finally {
                                  setIsChatLoading(false);
                                }
                              }}
                              className="text-xs text-purple-400 hover:text-purple-300 font-bold flex items-center gap-0.5"
                            >
                              <Eye size={12} /> View Details
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Search History & Report log Column */}
                <div className="space-y-6">
                  {/* Search History list */}
                  <div className="space-y-4">
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <RotateCcw size={16} className="text-purple-400" /> Search History
                    </h3>

                    {searchHistory.length === 0 ? (
                      <div className="text-center py-8 border border-dashed border-zinc-900 bg-zinc-950/20 text-zinc-500 rounded-xl text-xs">
                        No previous searches recorded.
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                        {searchHistory.map((hist, idx) => (
                          <div key={hist.id || idx} className="bg-zinc-950 border border-zinc-900 p-3.5 rounded-xl hover:border-zinc-800 transition-colors">
                            <div className="flex justify-between items-center text-[10px] text-zinc-500 font-bold mb-1.5 uppercase">
                              <span>Query: {hist.query || 'Welfare'}</span>
                              <span className="uppercase">{hist.detectedLanguage}</span>
                            </div>
                            <div className="text-xs text-zinc-300 font-semibold">
                              Profile: {hist.state} • {hist.age} yrs • {hist.gender} • {hist.occupation}
                            </div>
                            <div className="text-[10px] text-zinc-500 mt-2 text-right">
                              {new Date(hist.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Download Logs */}
                  <div className="space-y-4 border-t border-zinc-900 pt-6">
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Printer size={16} className="text-purple-400" /> Downloaded Reports
                    </h3>

                    {downloadedReports.length === 0 ? (
                      <div className="text-center py-8 border border-dashed border-zinc-900 bg-zinc-950/20 text-zinc-500 rounded-xl text-xs">
                        No downloaded report logs found.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {downloadedReports.map((rep, idx) => (
                          <div key={rep.id || idx} className="flex justify-between items-center text-xs bg-zinc-900/40 border border-zinc-850 p-2.5 rounded-xl">
                            <div className="truncate max-w-[200px]" title={rep.schemeTitle}>
                              <span className="font-semibold text-white">{rep.schemeTitle}</span>
                              <span className="block text-[9px] text-zinc-500 uppercase mt-0.5">Language: {rep.language}</span>
                            </div>
                            <span className="text-[10px] text-zinc-400 font-medium shrink-0">
                              {new Date(rep.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-20 glass-panel rounded-3xl p-8 border border-zinc-800 max-w-xl mx-auto w-full">
              <User size={48} className="text-zinc-700 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-zinc-300 mb-2">Login Required</h2>
              <p className="text-zinc-500 text-xs max-w-xs mx-auto mb-6 leading-relaxed">
                Log in with your name and mobile number to unlock saved schemes, logs history, and download capabilities.
              </p>
              <SignInButton mode="modal">
                <button
                  className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs transition-all"
                >
                  Log In / Register
                </button>
              </SignInButton>
            </div>
          )}
        </main>
      )}

      {/* Main Footer */}
      <footer className="mt-auto border-t border-zinc-900 bg-zinc-950 py-8 text-center text-xs text-zinc-500 print:hidden">
        <div className="max-w-6xl mx-auto w-full px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 font-bold text-white text-sm">
            <Sparkles size={14} className="text-purple-400 animate-pulse" /> GOONJ (गूंज)
          </div>
          <div className="flex flex-wrap gap-4 justify-center">
            <a href="#" className="hover:text-zinc-300">About</a>
            <a href="#" className="hover:text-zinc-300">Privacy Policy</a>
            <a href="#" className="hover:text-zinc-300">Terms & Conditions</a>
            <a href="#" className="hover:text-zinc-300">Contact</a>
            <a href="#" className="hover:text-zinc-300">Feedback</a>
          </div>
          <div>
            &copy; {new Date().getFullYear()} GOONJ Welfare. All rights reserved.
          </div>
        </div>
      </footer>


    </div>
  );
}
