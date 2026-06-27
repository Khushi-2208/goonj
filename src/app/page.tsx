'use client';

import React, { useState, useEffect, useRef } from 'react';
import { SignInButton, useUser, useClerk } from '@clerk/nextjs';
import { motion } from 'framer-motion';
import {
  Mic, MicOff, Volume2, CheckCircle2, ChevronLeft,
  RotateCcw, ShieldCheck, Loader2, Sparkles, Building, Landmark,
  User, LogOut, Bookmark, Share2, Printer, Check,
  HelpCircle, Eye, AlertCircle, Phone, Globe, ArrowRight, PlayCircle
} from 'lucide-react';

interface EligibilityResult { schemeId: string; title: string; ministry: string; description: string; whyEligible: string; benefits: string; stepsToApply: string[]; documentUrl?: string | null; applyUrl?: string | null; }
interface UserProfile { state: string; age: number; gender: string; casteCategory: string; annualIncome: number; occupation: string; disabilityStatus: string; disabilityPercentage: number; needsAndInterests: string; }
interface SavedScheme { id: string; title: string; ministry: string | null; state: string; minAge: number | null; maxAge: number | null; genderRestriction: string; incomeCeiling: number | null; occupations: string; casteCategories: string; expiryDate: string | null; documentUrl: string | null; applyUrl: string | null; isActive: boolean; }
interface SearchHistoryItem { id: string; query: string | null; state: string | null; age: number | null; gender: string | null; income: number | null; occupation: string | null; caste: string | null; detectedLanguage: string; createdAt: string; }
interface DownloadedReportItem { id: string; schemeTitle: string; language: string; createdAt: string; }
interface DBUser { id: string; phone: string; name: string; createdAt: string; _count: { savedSchemes: number; searchHistories: number; }; }

// Replace your existing fadeUp variable with this:
const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number] // Add 'as [number, number, number, number]'
    }
  }
};
const staggerContainer = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };

export default function GoonjPortal() {
  const [activeTab, setActiveTab] = useState<'home' | 'chat' | 'results' | 'dashboard'>('home');
  const [user, setUser] = useState<DBUser | null>(null);
  const { isLoaded, isSignedIn, user: clerkUser } = useUser();
  const { signOut, openSignIn } = useClerk();

  const [largeText, setLargeText] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [voiceNav, setVoiceNav] = useState(false);

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

  const [matchedSchemes, setMatchedSchemes] = useState<EligibilityResult[]>([]);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<{ [key: string]: 'yes' | 'no' }>({});
  const [activeShareMenu, setActiveShareMenu] = useState<string | null>(null);

  const [savedSchemes, setSavedSchemes] = useState<SavedScheme[]>([]);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [downloadedReports, setDownloadedReports] = useState<DownloadedReportItem[]>([]);
  const [isDashLoading, setIsDashLoading] = useState(false);

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

  useEffect(() => { voiceNavRef.current = voiceNav; }, [voiceNav]);

  const handleSendAnswerRef = useRef<any>(null);
  useEffect(() => { handleSendAnswerRef.current = handleSendAnswer; });

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

  const fetchSession = async () => {
    try {
      const res = await fetch('/api/auth/session');
      const data = await res.json();
      if (data.success && data.user) {
        setUser(data.user);
        loadDashboardData();
      }
    } catch (err) { console.error('Session load failed:', err); }
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
    } catch (err) { console.error('Failed to load dashboard logs:', err); } finally { setIsDashLoading(false); }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      setUser(null); setSavedSchemes([]); setSearchHistory([]); setDownloadedReports([]);
      setActiveTab('home'); speakText('Logged out successfully');
    } catch (err) { console.error('Logout failed:', err); }
  };

  const handleStartChat = () => {
    stopSpeaking();
    setChatMessages([{ role: 'assistant', content: 'नमस्ते! गूंज (GOONJ) में आपका स्वागत है। प्रारंभ करने के लिए कृपया माइक्रोफोन बटन दबाएं और अपनी भाषा में कुछ भी कहें (जैसे "नमस्ते" या "हेलो")।\n\nHello! Welcome to Goonj. Please press the microphone button and speak in your language to start.' }]);
    setChatProfile({}); setChatTurn(1); setChatDetectedLanguage('English'); setChatDetectedDialect('');
    setChatInput(''); setMatchedSchemes([]); setFeedbackSubmitted({}); setTranslatedQuestions([]);
    setFormAnswers(['', '', '', '', '', '', '', '']); setCurrentlyRecordingField(null); setActiveTab('chat');
  };

  const handleSendAnswer = async (inputText = chatInput) => {
    if (!inputText.trim()) return;
    const updatedMessages = [...chatMessages, { role: 'user' as const, content: inputText }];
    setChatMessages(updatedMessages); setChatInput(''); setIsChatLoading(true); stopSpeaking();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: inputText, history: updatedMessages.slice(0, -1), profile: chatProfile, turnNumber: chatTurn, detectedLanguage: chatDetectedLanguage })
      });
      const data = await res.json();
      if (data.success) {
        setChatProfile(data.profile); setChatDetectedLanguage(data.detectedLanguage);
        if (data.dialect) setChatDetectedDialect(data.dialect);
        if (data.translatedQuestions) setTranslatedQuestions(data.translatedQuestions);
        if (data.isComplete) {
          setMatchedSchemes(data.schemes || []);
          setChatMessages([...updatedMessages, { role: 'assistant', content: data.nextQuestion || 'We have analyzed your profile. Here are your matched entitlement programs.' }]);
          setActiveTab('results'); loadDashboardData();
        } else {
          setChatMessages([...updatedMessages, { role: 'assistant', content: data.nextQuestion }]);
          setChatTurn(2);
        }
      } else { alert(data.error || 'Assistant failed to process. Please retry.'); }
    } catch (err) { console.error(err); alert('Error connecting to assistant.'); } finally { setIsChatLoading(false); }
  };

  const speakText = (text: string, lang = 'en-IN') => {
    if (!synthesisRef.current) return;
    synthesisRef.current.cancel();
    const cleanText = text.replace(/[*#]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = getLanguageCode(lang);
    utterance.onend = () => { setSpeakingSchemeId(null); };
    synthesisRef.current.speak(utterance);
  };

  const stopSpeaking = () => { if (synthesisRef.current) { synthesisRef.current.cancel(); setSpeakingSchemeId(null); } };

  const toggleRecordingForField = (fieldIdx: number | null) => {
    if (!recognitionRef.current) return;
    setSpeechError(null);
    if (isRecording) {
      recognitionRef.current.stop(); setIsRecording(false); setCurrentlyRecordingField(null);
    } else {
      stopSpeaking();
      if (voiceNavRef.current) {
        tempPauseVoiceNav.current = true;
        if (voiceNavRecognitionRef.current) { try { voiceNavRecognitionRef.current.stop(); } catch (e) { console.error('Failed to stop voice nav:', e); } }
      }
      try {
        setCurrentlyRecordingField(fieldIdx);
        recognitionRef.current.lang = getLanguageCode(chatDetectedLanguage);
        recognitionRef.current.start(); setIsRecording(true);
      } catch (err) { console.error(err); }
    }
  };

  const handleSubmitForm = async () => {
    setIsMatchingLoading(true); stopSpeaking();
    try {
      const res = await fetch('/api/match', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers: formAnswers }) });
      const data = await res.json();
      if (data.success) {
        setChatProfile(data.profile); setMatchedSchemes(data.schemes || []); setActiveTab('results'); loadDashboardData();
      } else { alert(data.error || 'Failed to find matching schemes.'); }
    } catch (err) { console.error(err); alert('Error connecting to match engine.'); } finally { setIsMatchingLoading(false); }
  };

  const handlePlayScheme = (scheme: EligibilityResult) => {
    if (speakingSchemeId === scheme.schemeId) { stopSpeaking(); } else {
      setSpeakingSchemeId(scheme.schemeId);
      speakText(`${scheme.title}. Department: ${scheme.ministry}. Overview: ${scheme.description}. Why you qualify: ${scheme.whyEligible}. Benefit details: ${scheme.benefits}. Application steps: ${scheme.stepsToApply.join('. ')}`, chatDetectedLanguage);
    }
  };

  const handleToggleBookmark = async (schemeId: string) => {
    if (!user) { openSignIn(); return; }
    const isBookmarked = savedSchemes.some(s => s.id === schemeId);
    try {
      if (isBookmarked) {
        const res = await fetch(`/api/user/saved-schemes?schemeId=${schemeId}`, { method: 'DELETE' });
        if (res.ok) setSavedSchemes(savedSchemes.filter(s => s.id !== schemeId));
      } else {
        const res = await fetch('/api/user/saved-schemes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ schemeId }) });
        if (res.ok) loadDashboardData();
      }
    } catch (err) { console.error(err); }
  };

  const handleFeedback = async (schemeId: string, helpful: boolean) => {
    try {
      const res = await fetch('/api/user/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ schemeId, helpful }) });
      if (res.ok) setFeedbackSubmitted({ ...feedbackSubmitted, [schemeId]: helpful ? 'yes' : 'no' });
    } catch (err) { console.error(err); }
  };

  const handleDownloadReport = async (primaryScheme: EligibilityResult) => {
    localStorage.setItem('goonj_print_data', JSON.stringify({ profile: chatProfile, schemes: matchedSchemes, language: chatDetectedLanguage }));
    window.open('/print', '_blank');
    if (user) {
      try {
        await fetch('/api/user/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ schemeTitle: primaryScheme.title, language: chatDetectedLanguage }) });
        loadDashboardData();
      } catch (err) { console.error(err); }
    }
  };

  const getShareLink = (scheme: EligibilityResult, type: 'whatsapp' | 'telegram') => {
    const text = encodeURIComponent(`🔔 *${scheme.title}* (${scheme.ministry || 'Government Scheme'})\n\n💡 *Why you qualify:* ${scheme.whyEligible}\n\n🎁 *Benefits:* ${scheme.benefits}\n\n📌 Discover every scheme you qualify for in your language using GOONJ!`);
    if (type === 'whatsapp') return `https://api.whatsapp.com/send?text=${text}`;
    return `https://t.me/share/url?url=${encodeURIComponent(window.location.origin)}&text=${text}`;
  };

  useEffect(() => { if (isLoaded) fetchSession(); }, [isLoaded, isSignedIn]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const win = window as any;
      const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;
      if (SpeechRecognition) {
        setSpeechSupported(true);
        const rec = new SpeechRecognition();
        rec.continuous = false; rec.interimResults = false; rec.lang = 'en-IN';
        rec.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          const fieldIdx = currentlyRecordingFieldRef.current;
          if (fieldIdx !== null) {
            setFormAnswers(prev => { const updated = [...prev]; updated[fieldIdx] = transcript; return updated; });
            setIsRecording(false); setCurrentlyRecordingField(null);
          } else {
            setChatInput(transcript); setIsRecording(false);
            setTimeout(() => { handleSendAnswerRef.current(transcript); }, 400);
          }
        };
        rec.onerror = (event: any) => {
          console.error('Speech error:', event.error); setIsRecording(false);
          if (event.error === 'network') setSpeechError('Requires internet. Type your answer.');
          else if (event.error === 'not-allowed') setSpeechError('Microphone permission denied.');
          else setSpeechError(`Speech error (${event.error}). Please type.`);
        };
        rec.onend = () => {
          setIsRecording(false);
          if (voiceNavRef.current && tempPauseVoiceNav.current) {
            tempPauseVoiceNav.current = false;
            if (voiceNavRecognitionRef.current) { try { voiceNavRecognitionRef.current.start(); } catch (e) { } }
          }
        };
        recognitionRef.current = rec;
      }
      synthesisRef.current = window.speechSynthesis;
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'chat' && chatMessages.length > 0 && autoSpeak) {
      const lastMessage = chatMessages[chatMessages.length - 1];
      if (lastMessage.role === 'assistant') speakText(lastMessage.content, chatDetectedLanguage);
    }
  }, [chatMessages, activeTab, autoSpeak, chatDetectedLanguage]);

  useEffect(() => {
    if (!speechSupported) return;
    const win = window as any;
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (voiceNav) {
      const navRec = new SpeechRecognition();
      navRec.continuous = true; navRec.interimResults = false; navRec.lang = 'en-IN';
      navRec.onresult = (event: any) => {
        const lastIndex = event.results.length - 1;
        const transcript = event.results[lastIndex][0].transcript.toLowerCase().trim();
        if (transcript.includes('go home') || transcript.includes('home')) { setActiveTab('home'); speakText('Going home'); }
        else if (transcript.includes('dashboard') || transcript.includes('profile')) { setActiveTab('dashboard'); speakText('Opening dashboard'); }
        else if (transcript.includes('restart') || transcript.includes('reset')) { handleStartChat(); }
        else if (transcript.includes('logout') || transcript.includes('log out')) { handleLogout(); }
        else if (transcript.includes('print') || transcript.includes('download')) { if (matchedSchemes.length > 0) handleDownloadReport(matchedSchemes[0]); }
      };
      navRec.onerror = () => { };
      navRec.onend = () => { if (voiceNav && !tempPauseVoiceNav.current) { try { navRec.start(); } catch { } } };
      try { navRec.start(); voiceNavRecognitionRef.current = navRec; } catch { }
    } else {
      if (voiceNavRecognitionRef.current) { voiceNavRecognitionRef.current.stop(); voiceNavRecognitionRef.current = null; }
    }
    return () => { if (voiceNavRecognitionRef.current) { voiceNavRecognitionRef.current.stop(); } };
  }, [voiceNav, matchedSchemes]);

  return (
    <div className={`min-h-screen flex flex-col font-sans selection:bg-orange-200 selection:text-slate-900 transition-all duration-300 ${largeText ? 'large-text' : ''} ${highContrast ? 'high-contrast' : ''}`}>

      {/* Main Header / Navigation Bar (Height reduced) */}
      <header className={`fixed top-0 w-full z-50 transition-all duration-300 ${activeTab === 'home' ? 'bg-slate-900/50 backdrop-blur-md border-b border-white/10' : 'bg-white/80 border-b border-slate-200/60 backdrop-blur-xl'} print:hidden`}>
        <div className="max-w-7xl mx-auto w-full px-6 h-16 flex items-center justify-between">
          <div onClick={() => setActiveTab('home')} className="flex items-center gap-2.5 cursor-pointer group">
            <div className={`p-1.5 rounded-lg transition-all shadow-md ${activeTab === 'home' ? 'bg-orange-500 text-white' : 'bg-slate-900 text-white group-hover:bg-orange-500 group-hover:scale-105'}`}>
              <Landmark size={18} />
            </div>
            <span className={`font-black text-xl tracking-tight flex items-center gap-2 ${activeTab === 'home' ? 'text-white' : 'text-slate-900'}`}>
              GOONJ <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${activeTab === 'home' ? 'bg-white/20 text-white' : 'bg-orange-100 text-orange-700'}`}>गूंज</span>
            </span>
          </div>

          <nav className={`hidden md:flex items-center gap-6 text-sm font-bold ${activeTab === 'home' ? 'text-slate-300' : 'text-slate-500'}`}>
            <button
              onClick={() => setActiveTab('home')}
              className={`transition-colors ${activeTab === 'home' ? 'text-white' : 'hover:text-slate-900'}`}
            >
              Overview
            </button>

            <button
              onClick={handleStartChat}
              className={`transition-colors ${activeTab === 'chat' ? 'text-orange-500' : (activeTab === 'home' ? 'hover:text-white' : 'hover:text-orange-500')}`}
            >
              Voice Finder
            </button>

            <a
              href="/admin"
              className={`transition-colors ${activeTab === 'home' ? 'hover:text-white' : 'hover:text-slate-900'}`}
            >
              Admin Portal
            </a>
          </nav>

          <div className="flex items-center gap-3">
            {!isLoaded ? (
              <div className="h-8 w-24 bg-slate-200/20 animate-pulse rounded-lg" />
            ) : isSignedIn ? (
              user ? (
                <div className="flex items-center gap-3">
                  <button onClick={() => setActiveTab('dashboard')} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold transition-all shadow-sm ${activeTab === 'dashboard' ? 'bg-orange-500 text-white' : (activeTab === 'home' ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-white border border-slate-200 text-slate-800 hover:bg-slate-50')}`}>
                    <User size={14} /> {user.name}
                  </button>
                  <button onClick={handleLogout} className={`p-2 rounded-lg transition-colors shadow-sm ${activeTab === 'home' ? 'bg-white/10 text-slate-300 hover:bg-red-500/80 hover:text-white' : 'bg-white border border-slate-200 text-slate-400 hover:bg-red-50 hover:text-red-600 hover:border-red-200'}`} title="Logout">
                    <LogOut size={14} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-200/50 rounded-lg text-sm font-bold animate-pulse text-slate-500">
                  <Loader2 className="animate-spin" size={14} /> Syncing
                </div>
              )
            ) : (
              <SignInButton mode="modal">
                <button className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-lg transition-all shadow-md shadow-orange-500/30">
                  Log In / Register
                </button>
              </SignInButton>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section & Landing Tab */}
      {activeTab === 'home' && (
        <main className="flex-1 flex flex-col items-center print:hidden w-full">
          {/* Immersive Hero Header (Height reduced to fit exactly on screen) */}
          <div className="relative w-full h-[calc(100vh-4rem)] flex items-center justify-center overflow-hidden pt-12 pb-6">
            {/* Background Image & Overlays */}
            <div className="absolute inset-0 z-0">
              <img
                src="https://images.unsplash.com/photo-1521791055366-0d553872125f?auto=format&fit=crop&q=80"
                alt="Citizens looking forward"
                className="w-full h-full object-cover scale-105"
              />
              <div className="absolute inset-0 bg-slate-950/85" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-50/10 via-transparent to-slate-900/40" />
            </div>

            {/* Hero Content (Paddings and margins tightened) */}
            <motion.div
              initial="hidden" animate="visible" variants={staggerContainer}
              className="relative z-10 max-w-5xl mx-auto px-6 text-center flex flex-col items-center justify-center h-full"
            >
              <motion.span variants={fadeUp} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold bg-white/10 border border-white/20 text-orange-400 mb-6 backdrop-blur-md">
                <Sparkles size={14} /> Built for the citizens of India
              </motion.span>

              <motion.h1 variants={fadeUp} className="text-4xl md:text-5xl lg:text-7xl font-black tracking-tight text-white leading-[1.1] mb-4 drop-shadow-lg">
                Discover your <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-orange-300 to-amber-200">
                  Entitlements
                </span>
              </motion.h1>

              <motion.p variants={fadeUp} className="text-slate-300 text-base md:text-xl max-w-2xl leading-relaxed mb-8 font-medium">
                Government benefits, explained in your language. Speak naturally and instantly find every scheme you qualify for.
              </motion.p>

              <motion.div variants={fadeUp} className="relative mb-8 group cursor-pointer" onClick={handleStartChat}>
                <div className="absolute inset-0 bg-orange-500/30 rounded-full blur-[40px] scale-150 opacity-80 group-hover:scale-[2] transition-transform duration-700" />
                <div className="relative w-24 h-24 md:w-28 md:h-28 rounded-full bg-gradient-to-tr from-orange-600 to-amber-500 border-4 border-white/20 flex items-center justify-center shadow-2xl animate-voice-pulse hover:from-orange-500 hover:to-amber-400 transition-colors backdrop-blur-xl">
                  <Mic size={44} className="text-white drop-shadow-md" />
                </div>
                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-bold text-white uppercase tracking-widest group-hover:text-orange-400 transition-colors">
                  Tap to Start Speaking
                </div>
              </motion.div>

              <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3 justify-center mt-2">
                <button onClick={handleStartChat} className="px-6 py-3.5 bg-white text-slate-900 font-black rounded-xl shadow-xl hover:bg-slate-100 transition-all text-sm flex items-center justify-center gap-2 group">
                  <PlayCircle size={18} className="text-orange-500 group-hover:scale-110 transition-transform" /> Continue Without Login
                </button>
                {user ? (
                  <button onClick={() => setActiveTab('dashboard')} className="px-6 py-3.5 bg-white text-slate-900 font-black rounded-xl shadow-xl hover:bg-slate-100 transition-all text-sm flex items-center justify-center gap-2">
                    View My Dashboard
                  </button>
                ) : (
                  <SignInButton mode="modal">
                    <button className="px-6 py-3.5 bg-white text-slate-900 font-black rounded-xl shadow-xl hover:bg-slate-100 transition-all text-sm flex items-center justify-center gap-2">
                      View My Dashboard
                    </button>
                  </SignInButton>
                )}
              </motion.div>
            </motion.div>
          </div>

          {/* Premium Bento Grid: How Goonj Works */}
          <section className="max-w-7xl w-full px-6 py-24 z-10 relative">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight">How Goonj Works</h2>
              <p className="text-slate-500 mt-4 text-lg font-medium">A seamless, AI-powered civic experience.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { step: "1", title: "Speak In Your Language", desc: "Just describe your situation using the microphone. Talk naturally in Hindi, Bhojpuri, Tamil, or any regional tongue." },
                { step: "2", title: "Answer Simple Questions", desc: "No complex forms. Our friendly AI reads out a few missing demographic questions one at a time." },
                { step: "3", title: "AI Checks Eligibility", desc: "Goonj instantly cross-references criteria databases and filters state and central scheme directives." },
                { step: "4", title: "Get Matching Schemes", desc: "View detailed results, benefits breakdowns, required documents, and get exact step-by-step checklists." }
              ].map((s, idx) => (
                <div key={idx} className="glass-panel glass-panel-hover rounded-3xl p-8 relative overflow-hidden flex flex-col h-full border-t-4 border-t-orange-500 group">
                  <div className="absolute -right-4 -bottom-6 text-8xl font-black text-slate-100 select-none z-[-1] transition-transform group-hover:scale-110">
                    {s.step}
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-700 font-black flex items-center justify-center text-lg mb-6 shadow-sm">
                    {s.step}
                  </div>
                  <h3 className="font-black text-slate-900 text-xl mb-3">{s.title}</h3>
                  <p className="text-slate-600 text-base leading-relaxed flex-1 font-medium">{s.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Why Goonj */}
          <section className="max-w-7xl w-full px-6 py-16 border-t border-slate-200/60 bg-white/40 backdrop-blur-md rounded-3xl mb-16 shadow-sm">
            <h2 className="text-3xl md:text-5xl font-black text-slate-900 text-center mb-16">
              Why Goonj
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10 text-left">
              {[
                { title: "Voice-First & Multilingual", desc: "Designed for citizens who struggle with typing. Supports Hindi, English, Bhojpuri, Bengali, Tamil, Telugu, and all major Indian languages." },
                { title: "Central & State Cataloging", desc: "Automatically matches state-specific criteria (like Bihar or Maharashtra welfare schemes) alongside nation-wide schemes." },
                { title: "Exact Step-by-Step Guidance", desc: "Tells you precisely WHY you qualify to earn trust, lists required files, and maps application timelines." },
                { title: "Full Audio Playback Assistance", desc: "Every benefit detail and instruction checklist can be read aloud in your own language with human-like voices." },
                { title: "Personalized History Logs", desc: "Register in 5 seconds with a mobile number to bookmark schemes, save search profiles, and download summaries." },
                { title: "100% Free & Secure", desc: "Built with transparency and privacy. No registration fees, no hidden portals. Entirely accessibility-friendly." }
              ].map((b, idx) => (
                <div key={idx} className="p-6 border-l-[6px] border-amber-400 bg-white/70 backdrop-blur-md rounded-r-2xl shadow-sm">
                  <h3 className="font-black text-slate-900 text-lg mb-3 flex items-center gap-2">
                    <CheckCircle2 size={20} className="text-emerald-500" />
                    {b.title}
                  </h3>
                  <p className="text-slate-600 text-base leading-relaxed font-medium">{b.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Language support Section */}
          <section className="max-w-7xl w-full px-6 py-16 border-t border-slate-200">
            <h2 className="text-sm font-black text-slate-400 text-center mb-10 uppercase tracking-widest">
              Supported Regional Languages
            </h2>
            <div className="flex flex-wrap gap-4 justify-center max-w-4xl mx-auto">
              {[
                "Hindi (हिन्दी)", "English", "Bhojpuri (भोजपुरी)", "Bengali (বাংলা)",
                "Tamil (தமிழ்)", "Telugu (తెలుగు)", "Marathi (मराठी)", "Gujarati (ગુજરાતી)",
                "Kannada (ಕನ್ನಡ)", "Malayalam (മലയാളം)", "Punjabi (ਪੰਜਾਬി)", "Odia (ଓଡ଼ିଆ)",
                "Any Regional Language..."
              ].map((lang, idx) => (
                <span
                  key={idx}
                  className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-orange-400 text-sm font-bold cursor-default transition-all hover:scale-105 shadow-sm"
                >
                  {lang}
                </span>
              ))}
            </div>
          </section>

          {/* Trust Section */}
          <section className="w-full py-16 border-t border-slate-200 bg-white/80 backdrop-blur-md text-center relative z-10">
            <div className="max-w-7xl mx-auto flex flex-wrap gap-12 justify-center items-center text-sm text-slate-400 font-bold uppercase tracking-widest">
              <span className="flex items-center gap-3"><Landmark size={24} className="text-slate-300" /> Central Schemes</span>
              <span className="flex items-center gap-3"><Building size={24} className="text-slate-300" /> State Portals</span>
              <span className="flex items-center gap-3"><ShieldCheck size={24} className="text-slate-300" /> Secure & Private</span>
            </div>
          </section>
        </main>
      )}

      {/* Conversational Assistant / Form Discoverer Tab */}
      {activeTab === 'chat' && (
        <main className="flex-1 flex flex-col max-w-4xl mx-auto w-full px-6 py-24 justify-center print:hidden relative z-10">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-panel rounded-[2rem] p-8 md:p-12 flex flex-col min-h-[550px] shadow-2xl shadow-slate-200/50">
            {/* Header info */}
            <div className="flex justify-between items-center border-b border-slate-200 pb-5 mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg text-orange-600">
                  <Mic size={18} />
                </div>
                <span className="font-black text-lg text-slate-900">Voice Assistant</span>
                <span className="text-slate-300 px-2">/</span>
                <span className="text-slate-500 font-bold text-sm tracking-wider uppercase">
                  {chatTurn === 1 ? 'Phase 1: Detection' : 'Phase 2: Details'}
                </span>
              </div>
              {chatDetectedLanguage && (
                <span className="bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg text-slate-700 uppercase font-bold text-[10px] flex items-center gap-2 shadow-sm">
                  <Globe size={14} className="text-orange-500" />
                  {chatDetectedLanguage} {chatDetectedDialect && `(${chatDetectedDialect})`}
                </span>
              )}
            </div>

            {speechError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700 text-sm mb-6 shadow-sm font-bold">
                <AlertCircle size={20} className="shrink-0 text-red-500" />
                <span>{speechError}</span>
              </div>
            )}

            {/* Phase 1: Speak to Detect Language */}
            {chatTurn === 1 && (
              <div className="flex-1 flex flex-col items-center justify-center py-3 text-center">
                <div className="max-w-md mx-auto space-y-6">
                  <div className="space-y-3">
                    <div className="w-10 h-1 bg-orange-500 rounded-full mx-auto" />
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                      बोलकर शुरू करें<br />Speak to Start
                    </h2>
                    <p className="text-slate-600 text-sm leading-relaxed bg-white/80 backdrop-blur-sm p-4 rounded-2xl border border-slate-200/80 shadow-sm font-medium">
                      अपनी स्थानीय भाषा में कुछ भी कहें (जैसे "नमस्ते") ताकि हम आपकी भाषा समझ सकें।
                      <br />
                      <span className="text-slate-500 text-xs">
                        Speak anything in your mother tongue so we can configure the interface for you.
                      </span>
                    </p>
                  </div>

                  <div className="flex flex-col items-center justify-center gap-3 py-2">
                    <div className="relative">
                      <div className={`absolute inset-0 rounded-full blur-xl scale-110 transition-opacity ${isRecording && currentlyRecordingField === null ? 'bg-red-400/40 opacity-100' : 'bg-orange-400/30 opacity-70'
                        }`} />
                      <button
                        onClick={() => toggleRecordingForField(null)}
                        disabled={!speechSupported || isChatLoading}
                        className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-xl ring-4 ring-white ${isRecording && currentlyRecordingField === null
                            ? 'bg-gradient-to-br from-red-500 to-red-600 text-white animate-voice-pulse'
                            : 'bg-gradient-to-br from-slate-900 to-slate-700 text-white hover:from-orange-500 hover:to-orange-600 hover:scale-110 disabled:opacity-50 disabled:hover:scale-100'
                          }`}
                      >
                        {isRecording && currentlyRecordingField === null ? <MicOff size={30} /> : <Mic size={30} />}
                      </button>
                    </div>
                    {isRecording && currentlyRecordingField === null ? (
                      <span className="text-xs font-black text-red-500 animate-pulse uppercase tracking-widest bg-red-50 px-3 py-1.5 rounded-full border border-red-100 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> Listening... Speak now
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                        Tap the mic to begin
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 max-w-sm mx-auto">
                    <div className="flex-1 h-px bg-slate-200" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">or</span>
                    <div className="flex-1 h-px bg-slate-200" />
                  </div>

                  <div className="flex gap-2 max-w-sm mx-auto w-full">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSendAnswer(); }}
                      placeholder="Or type greeting here..."
                      className="flex-1 bg-white border border-slate-200 rounded-xl p-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-300 shadow-sm font-bold transition-all"
                      disabled={isChatLoading || isRecording}
                    />
                    <button
                      onClick={() => handleSendAnswer()}
                      disabled={!chatInput.trim() || isChatLoading || isRecording}
                      className="px-5 bg-gradient-to-br from-slate-900 to-slate-700 hover:from-orange-500 hover:to-orange-600 disabled:from-slate-300 disabled:to-slate-300 text-white font-bold rounded-xl text-sm flex items-center justify-center transition-all shadow-md"
                    >
                      {isChatLoading ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Phase 2: Show Form */}
            {chatTurn === 2 && (
              <div className="flex-1 flex flex-col gap-6">
                <div className="p-5 bg-orange-50 border border-orange-200 rounded-2xl flex items-start gap-4 shadow-sm">
                  <Volume2 size={24} className="text-orange-600 shrink-0 mt-1" />
                  <div className="space-y-2">
                    <p className="text-slate-800 text-base font-bold leading-relaxed">
                      कृपया नीचे दिए गए प्रपत्र को अपनी भाषा में भरें। प्रत्येक प्रश्न को सुनने के लिए लाउडस्पीकर बटन दबाएं, और उत्तर देने के लिए माइक का उपयोग करें।
                    </p>
                    <p className="text-slate-500 text-sm font-medium">
                      Please answer the questions below. Press the speaker to listen, and the mic to speak your answer.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-h-[450px] overflow-y-auto p-2">
                  {translatedQuestions.map((qText, i) => (
                    <div key={i} className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-4">
                      <div className="flex justify-between items-start gap-3">
                        <label className="text-base font-black text-slate-800 leading-snug flex-1">
                          <span className="text-orange-500 mr-2 opacity-80">{i + 1}.</span>
                          {qText}
                        </label>
                        <button
                          type="button"
                          onClick={() => speakText(qText, chatDetectedLanguage)}
                          className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 text-slate-400 transition-all cursor-pointer shadow-sm"
                        >
                          <Volume2 size={18} />
                        </button>
                      </div>

                      <div className="flex gap-3 items-center">
                        <input
                          type="text"
                          value={formAnswers[i]}
                          onChange={e => {
                            const val = e.target.value;
                            setFormAnswers(prev => { const updated = [...prev]; updated[i] = val; return updated; });
                          }}
                          placeholder="Speak or type answer..."
                          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-sm font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 shadow-inner"
                          disabled={isMatchingLoading}
                        />
                        <button
                          type="button"
                          onClick={() => toggleRecordingForField(i)}
                          disabled={isMatchingLoading || !speechSupported}
                          className={`p-3.5 rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-sm border ${isRecording && currentlyRecordingField === i
                              ? 'bg-red-500 text-white border-red-600 animate-pulse'
                              : 'bg-slate-900 text-white border-slate-900 hover:bg-orange-500 hover:border-orange-500'
                            }`}
                        >
                          {isRecording && currentlyRecordingField === i ? <MicOff size={18} /> : <Mic size={18} />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-slate-200 pt-6 mt-2 flex flex-col md:flex-row justify-between items-center gap-4">
                  <button onClick={() => { stopSpeaking(); setActiveTab('home'); }} className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-slate-800 transition-all">
                    <ChevronLeft size={18} /> Back to Home
                  </button>

                  <div className="flex gap-3 w-full md:w-auto">
                    <button onClick={handleStartChat} className="px-6 py-3.5 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-sm font-black transition-all flex items-center gap-2 justify-center flex-1 md:flex-none shadow-sm">
                      <RotateCcw size={16} /> Reset
                    </button>
                    <button onClick={handleSubmitForm} disabled={isMatchingLoading || !formAnswers.some(ans => ans.trim())} className="px-8 py-3.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white text-sm font-black transition-all flex items-center justify-center gap-2 flex-1 md:flex-none shadow-lg shadow-orange-500/20">
                      {isMatchingLoading ? (
                        <> <Loader2 size={18} className="animate-spin" /> Searching... </>
                      ) : (
                        <> <CheckCircle2 size={18} /> Find Schemes </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </main>
      )}

      {/* Results View Tab */}
      {activeTab === 'results' && (
        <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-24 flex flex-col gap-8 print:p-0 relative z-10">
          <div className="glass-panel rounded-2xl p-6 flex flex-wrap gap-5 text-sm text-slate-700 items-center justify-between print:hidden shadow-sm">
            <div className="flex items-center gap-3">
              <span className="inline-flex px-3 py-1.5 bg-slate-900 text-white font-black rounded-lg text-xs uppercase tracking-widest">
                Profile match
              </span>
              <span className="font-bold text-slate-900">{chatProfile.state}</span>
              <span className="text-slate-300">|</span>
              <span className="font-bold text-slate-900">{chatProfile.age} Years</span>
              <span className="text-slate-300">|</span>
              <span className="font-bold text-slate-900">{chatProfile.gender}</span>
              <span className="text-slate-300">|</span>
              <span className="font-bold text-slate-900 capitalize">{chatProfile.occupation || 'citizen'}</span>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => { if (matchedSchemes.length > 0) handleDownloadReport(matchedSchemes[0]); }} className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-sm text-slate-700 font-bold rounded-xl transition-all shadow-sm">
                <Printer size={16} className="text-orange-500" /> Save PDF
              </button>
              <button onClick={handleStartChat} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-sm text-white font-bold transition-colors shadow-sm">
                <RotateCcw size={16} /> New Search
              </button>
            </div>
          </div>

          {matchedSchemes.length === 0 ? (
            <div className="text-center py-24 glass-panel rounded-3xl p-10 print:hidden shadow-lg shadow-slate-200/50">
              <Landmark size={56} className="text-slate-300 mx-auto mb-6" />
              <h2 className="text-3xl font-black text-slate-900 mb-3">No Qualifying Schemes Found</h2>
              <p className="text-slate-500 text-lg max-w-md mx-auto mb-10 leading-relaxed font-medium">
                We scanned the official directories but could not find active schemes matching your demographics at this time.
              </p>
              <button onClick={handleStartChat} className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-slate-900 hover:bg-orange-500 text-white font-bold text-sm transition-all shadow-xl">
                <RotateCcw size={18} /> Adjust your profile
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="flex justify-between items-center print:hidden">
                <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3 border-b-[3px] border-orange-500 pb-2">
                  <ShieldCheck size={28} className="text-orange-500" />
                  Your Qualified Schemes ({matchedSchemes.length})
                </h2>
              </div>

              {matchedSchemes.map((scheme, idx) => (
                <div key={scheme.schemeId || idx} className="glass-panel rounded-3xl p-8 relative overflow-hidden print:border-slate-300 print:bg-white print:text-black print:shadow-none print:break-inside-avoid shadow-lg shadow-slate-200/50">
                  <div className="flex justify-between items-start gap-6 mb-8">
                    <div>
                      <div className="flex flex-wrap gap-3 items-center mb-4">
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-black text-slate-600 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg uppercase tracking-widest">
                          <Building size={14} /> {scheme.ministry || 'Government Department'}
                        </span>
                        <span className="inline-flex px-3 py-1.5 text-[10px] font-black text-emerald-700 bg-emerald-100 border border-emerald-200 rounded-lg uppercase tracking-widest">
                          Eligible Match
                        </span>
                      </div>
                      <h3 className="text-2xl md:text-3xl font-black text-slate-900 leading-snug">
                        {scheme.title}
                      </h3>
                      <p className="text-base text-slate-600 mt-3 leading-relaxed font-medium">
                        {scheme.description}
                      </p>
                    </div>

                    <div className="flex gap-2 print:hidden shrink-0">
                      <button onClick={() => handleToggleBookmark(scheme.schemeId)} className={`p-4 rounded-2xl border shadow-sm transition-all ${savedSchemes.some(s => s.id === scheme.schemeId) ? 'bg-orange-500 border-orange-600 text-white' : 'bg-white border-slate-200 text-slate-400 hover:text-orange-500 hover:border-orange-200'}`} title="Bookmark Scheme">
                        <Bookmark size={20} />
                      </button>
                      <button onClick={() => handlePlayScheme(scheme)} className={`p-4 rounded-2xl border shadow-sm transition-all ${speakingSchemeId === scheme.schemeId ? 'bg-emerald-500 border-emerald-600 text-white animate-pulse' : 'bg-white border-slate-200 text-slate-400 hover:text-emerald-500 hover:border-emerald-200'}`} title="Read details aloud">
                        <Volume2 size={20} />
                      </button>
                      <div className="relative">
                        <button onClick={() => setActiveShareMenu(activeShareMenu === scheme.schemeId ? null : scheme.schemeId)} className="p-4 rounded-2xl border shadow-sm bg-white border-slate-200 text-slate-400 hover:text-blue-500 hover:border-blue-200 transition-all">
                          <Share2 size={20} />
                        </button>
                        {activeShareMenu === scheme.schemeId && (
                          <div className="absolute right-0 mt-2 z-50 w-40 bg-white border border-slate-200 rounded-2xl shadow-2xl p-2 text-sm font-bold text-slate-700">
                            <a href={getShareLink(scheme, 'whatsapp')} target="_blank" className="block px-4 py-2.5 hover:bg-slate-50 rounded-xl hover:text-orange-500" onClick={() => setActiveShareMenu(null)}>WhatsApp</a>
                            <a href={getShareLink(scheme, 'telegram')} target="_blank" className="block px-4 py-2.5 hover:bg-slate-50 rounded-xl hover:text-orange-500" onClick={() => setActiveShareMenu(null)}>Telegram</a>
                            <div className="h-px bg-slate-100 my-1" />
                            <button onClick={() => { navigator.clipboard.writeText(`${scheme.title} - ${scheme.whyEligible}. Learn more on Goonj.`); alert('Link copied!'); setActiveShareMenu(null); }} className="w-full text-left block px-4 py-2.5 hover:bg-slate-50 rounded-xl hover:text-orange-500">Copy Details</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div className="bg-orange-50/50 border border-orange-100 rounded-2xl p-6 text-sm text-slate-800 leading-relaxed font-medium">
                      <span className="font-black text-orange-600 text-[10px] uppercase tracking-widest block mb-3 flex items-center gap-2">
                        <CheckCircle2 size={14} /> Why You Qualify
                      </span>
                      {scheme.whyEligible}
                    </div>
                    <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-6 text-sm text-slate-800 leading-relaxed font-medium">
                      <span className="font-black text-emerald-600 text-[10px] uppercase tracking-widest block mb-3 flex items-center gap-2">
                        <Sparkles size={14} /> Benefits Offered
                      </span>
                      {scheme.benefits}
                    </div>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 md:p-8">
                    <span className="font-black text-slate-900 text-sm uppercase tracking-widest block mb-5 flex items-center gap-2">
                      <ArrowRight size={16} className="text-orange-500" /> Application Steps Checklist
                    </span>
                    <div className="space-y-4">
                      {scheme.stepsToApply.map((step, sIdx) => (
                        <div key={sIdx} className="flex items-start gap-4">
                          <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-black shrink-0 mt-0.5">
                            {sIdx + 1}
                          </div>
                          <span className="text-base text-slate-700 font-medium leading-relaxed">
                            {step}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-8 pt-6 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                    <div>
                      <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest block mb-1">
                        {scheme.applyUrl ? 'Official Portal' : 'Reference Source'}
                      </span>
                      <span className="text-base text-slate-900 font-bold block truncate max-w-[320px]">
                        {scheme.applyUrl || scheme.documentUrl || 'Search online for portal'}
                      </span>
                    </div>
                    <a
                      href={scheme.applyUrl || `https://www.google.com/search?q=${encodeURIComponent(scheme.title + ' apply online official')}`}
                      target="_blank"
                      className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-slate-900 hover:bg-orange-500 text-white font-black rounded-xl text-sm transition-all shadow-lg shrink-0 print:hidden"
                    >
                      <Globe size={18} /> Open Portal
                    </a>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-5 mt-8 flex flex-wrap items-center justify-between gap-4 text-sm text-slate-600 print:hidden">
                    <div className="flex items-center gap-2 font-bold text-slate-500">
                      <HelpCircle size={18} className="text-slate-400" /> Was this assessment helpful?
                    </div>
                    <div className="flex gap-2">
                      {feedbackSubmitted[scheme.schemeId] ? (
                        <span className="text-emerald-600 font-black flex items-center gap-2 bg-emerald-50 px-4 py-2 rounded-xl">
                          <Check size={16} /> Thank you!
                        </span>
                      ) : (
                        <>
                          <button onClick={() => handleFeedback(scheme.schemeId, true)} className="px-5 py-2 bg-white border border-slate-300 hover:border-orange-500 hover:text-orange-600 rounded-xl transition-all font-bold shadow-sm text-slate-700">Yes</button>
                          <button onClick={() => handleFeedback(scheme.schemeId, false)} className="px-5 py-2 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl transition-all font-bold shadow-sm text-slate-700">No</button>
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
        <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-24 print:hidden relative z-10">
          {!isLoaded || (isSignedIn && !user) ? (
            <div className="flex flex-col items-center justify-center py-40 text-slate-400">
              <Loader2 className="animate-spin text-orange-500 mb-6" size={40} />
              <p className="text-sm font-black uppercase tracking-widest">Loading Profile...</p>
            </div>
          ) : user ? (
            <div className="space-y-8">
              <div className="glass-panel rounded-3xl p-8 md:p-12 relative overflow-hidden bg-slate-900 text-white">
                <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500 rounded-full blur-[80px] opacity-20 -z-10" />
                <div className="flex flex-wrap gap-8 items-center justify-between relative z-10">
                  <div className="flex items-center gap-5">
                    <div className="bg-white/10 p-5 rounded-2xl backdrop-blur-md border border-white/20">
                      <User size={40} className="text-orange-400" />
                    </div>
                    <div>
                      <h2 className="text-3xl font-black">{user.name}</h2>
                      <p className="text-sm text-slate-400 flex items-center gap-2 font-medium mt-2">
                        <Phone size={14} /> {user.phone} • Verified Citizen
                      </p>
                    </div>
                  </div>
<div className="flex gap-4 text-center text-sm">
  <div className="bg-white px-8 py-5 rounded-2xl min-w-[130px] shadow-xl shadow-black/10 border border-white/20">
    <div className="font-black text-4xl text-slate-900">{savedSchemes.length}</div>
    <div className="text-orange-500 font-bold uppercase tracking-widest text-[10px] mt-2">Saved</div>
  </div>
  <div className="bg-white px-8 py-5 rounded-2xl min-w-[130px] shadow-xl shadow-black/10 border border-white/20">
    <div className="font-black text-4xl text-slate-900">{searchHistory.length}</div>
    <div className="text-orange-500 font-bold uppercase tracking-widest text-[10px] mt-2">Searches</div>
  </div>
</div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                  <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                    <Bookmark size={24} className="text-orange-500" /> Saved Welfare Schemes
                  </h3>

                  {isDashLoading ? (
                    <div className="py-20 flex justify-center text-slate-400">
                      <Loader2 className="animate-spin text-orange-500" size={32} />
                    </div>
                  ) : savedSchemes.length === 0 ? (
                    <div className="text-center py-20 border-2 border-dashed border-slate-200 rounded-3xl bg-white text-slate-400 shadow-sm">
                      <Bookmark className="mx-auto text-slate-300 mb-5" size={48} />
                      <p className="text-base font-bold">You haven't bookmarked any schemes yet.</p>
                      <button onClick={handleStartChat} className="mt-6 px-6 py-3 bg-slate-900 text-white rounded-xl hover:bg-orange-500 font-bold shadow-md transition-colors">
                        Start voice search
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-4">
                      {savedSchemes.map(sch => (
                        <div key={sch.id} className="glass-panel glass-panel-hover rounded-2xl p-6 flex flex-col justify-between shadow-sm">
                          <div>
                            <span className="inline-block px-3 py-1.5 rounded-lg text-[10px] font-black bg-slate-100 border border-slate-200 text-slate-500 uppercase tracking-widest mb-4">
                              {sch.state}
                            </span>
                            <h4 className="font-black text-slate-900 text-lg line-clamp-2 leading-tight" title={sch.title}>{sch.title}</h4>
                            <p className="text-slate-500 text-sm line-clamp-2 mt-2 leading-relaxed font-medium">{sch.documentUrl || 'Official guideline PDF cataloged.'}</p>
                          </div>
                          <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-100">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{sch.ministry || 'State'}</span>
                            <button onClick={async () => {
                              stopSpeaking(); setIsChatLoading(true); setActiveTab('chat');
                              try {
                                const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: `I need information on ${sch.title}`, turnNumber: 8, profile: { state: sch.state } }) });
                                const data = await res.json();
                                if (data.success) { setMatchedSchemes(data.schemes || []); setChatMessages([{ role: 'assistant', content: `Here is the assessment details for ${sch.title}.` }]); setActiveTab('results'); }
                              } catch (e) { setActiveTab('dashboard'); } finally { setIsChatLoading(false); }
                            }}
                              className="text-sm text-slate-900 hover:text-white hover:bg-orange-500 font-black flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-xl transition-all"
                            >
                              <Eye size={16} /> View
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-10">
                  <div>
                    <h3 className="text-xl font-black text-slate-900 flex items-center gap-3 mb-6">
                      <RotateCcw size={24} className="text-slate-400" /> History
                    </h3>
                    {searchHistory.length === 0 ? (
                      <div className="text-center py-12 border-2 border-dashed border-slate-200 bg-white text-slate-400 rounded-2xl text-sm font-bold">
                        No previous searches.
                      </div>
                    ) : (
                      <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2">
                        {searchHistory.map((hist, idx) => (
                          <div key={hist.id || idx} className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm hover:border-orange-300 transition-colors">
                            <div className="flex justify-between items-center text-xs text-slate-400 font-black mb-3 uppercase tracking-widest">
                              <span className="truncate max-w-[150px]">Q: {hist.query || 'Welfare'}</span>
                              <span className="bg-slate-100 px-2.5 py-1 rounded-md text-slate-600">{hist.detectedLanguage}</span>
                            </div>
                            <div className="text-sm text-slate-800 font-bold">
                              {hist.state} • {hist.age}y • {hist.gender}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-3 font-bold uppercase tracking-widest">
                              {new Date(hist.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="border-t-[3px] border-slate-100 pt-8">
                    <h3 className="text-xl font-black text-slate-900 flex items-center gap-3 mb-6">
                      <Printer size={24} className="text-slate-400" /> Downloads
                    </h3>
                    {downloadedReports.length === 0 ? (
                      <div className="text-center py-10 border-2 border-dashed border-slate-200 bg-white text-slate-400 rounded-2xl text-sm font-bold">
                        No downloaded reports.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {downloadedReports.map((rep, idx) => (
                          <div key={rep.id || idx} className="flex justify-between items-center bg-slate-50 border border-slate-200 p-4 rounded-xl shadow-sm">
                            <div className="truncate max-w-[200px]" title={rep.schemeTitle}>
                              <span className="font-bold text-slate-800 text-sm">{rep.schemeTitle}</span>
                              <span className="block text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1.5">Lang: {rep.language}</span>
                            </div>
                            <span className="text-[10px] text-slate-500 font-black shrink-0 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200">
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
            <div className="text-center py-24 glass-panel rounded-3xl p-10 max-w-xl mx-auto w-full shadow-xl shadow-slate-200/50 border-t-4 border-t-slate-900">
              <div className="bg-slate-900 w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-inner rotate-3">
                <User size={40} className="text-white -rotate-3" />
              </div>
              <h2 className="text-3xl font-black text-slate-900 mb-4">Login Required</h2>
              <p className="text-slate-500 text-base max-w-sm mx-auto mb-10 leading-relaxed font-medium">
                Log in securely to save schemes, track your applications, and download eligibility reports.
              </p>
              <SignInButton mode="modal">
                <button className="px-10 py-4 bg-orange-500 hover:bg-orange-600 text-white font-black rounded-xl text-base transition-all shadow-xl shadow-orange-500/20 w-full md:w-auto">
                  Log In / Register
                </button>
              </SignInButton>
            </div>
          )}
        </main>
      )}

      {/* Main Footer */}
      <footer className="mt-auto border-t border-slate-200/60 bg-white py-10 text-center text-sm text-slate-400 print:hidden font-bold relative z-10">
        <div className="max-w-7xl mx-auto w-full px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2 font-black text-slate-800 text-base">
            <Landmark size={20} className="text-slate-300" /> GOONJ (गूंज)
          </div>
          <div className="flex flex-wrap gap-8 justify-center uppercase tracking-widest text-[10px]">
            <a href="#" className="hover:text-slate-900 transition-colors">About</a>
            <a href="#" className="hover:text-slate-900 transition-colors">Privacy</a>
            <a href="#" className="hover:text-slate-900 transition-colors">Terms</a>
            <a href="#" className="hover:text-slate-900 transition-colors">Help</a>
          </div>
          <div className="text-xs text-slate-300 font-medium">
            &copy; {new Date().getFullYear()} GOONJ. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
