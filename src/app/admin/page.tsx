'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useUser, SignInButton, useClerk } from '@clerk/nextjs';
import { 
  Upload, Link as LinkIcon, Calendar, Check, Trash2, RefreshCw, 
  FileText, ArrowLeft, Loader2, Edit2, Users, Search, Heart, 
  Building, Globe, MapPin, X, AlertCircle, ShieldCheck
} from 'lucide-react';

interface Scheme {
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
  isActive: boolean;
  createdAt: string;
}

interface AnalyticsStats {
  totalUsers: number;
  totalSearches: number;
  languages: { name: string; count: number }[];
  states: { name: string; count: number }[];
  mostSavedSchemes: { id: string; title: string; savedCount: number; feedbackCount: number }[];
  feedback: {
    total: number;
    helpful: number;
    percent: number;
  };
}

export default function AdminDashboard() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { signOut } = useClerk();
  const [secretKey, setSecretKey] = useState('');
  const [secretError, setSecretError] = useState<string | null>(null);
  const [verifyingSecret, setVerifyingSecret] = useState(false);

  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [purging, setPurging] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  // Edit Mode states
  const [editId, setEditId] = useState<string | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [ministry, setMinistry] = useState('');
  const [state, setState] = useState('Central');
  const [minAge, setMinAge] = useState('');
  const [maxAge, setMaxAge] = useState('');
  const [genderRestriction, setGenderRestriction] = useState('All');
  const [incomeCeiling, setIncomeCeiling] = useState('');
  const [occupations, setOccupations] = useState('');
  const [casteCategories, setCasteCategories] = useState('General, OBC, SC, ST');
  const [expiryDate, setExpiryDate] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [ingestionType, setIngestionType] = useState<'pdf' | 'url'>('pdf');
  const [linkUrl, setLinkUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const fetchSchemes = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/schemes');
      const data = await res.json();
      if (data.success) {
        setSchemes(data.schemes);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      setAnalyticsLoading(true);
      const res = await fetch('/api/admin/analytics');
      const data = await res.json();
      if (data.success) {
        setAnalytics(data.stats);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const isAdmin = user?.publicMetadata?.role === 'admin';

  useEffect(() => {
    if (isLoaded && isSignedIn && isAdmin) {
      fetchSchemes();
      fetchAnalytics();
    }
  }, [isLoaded, isSignedIn, isAdmin]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const showNotification = (text: string, isError = false) => {
    setMessage({ text, isError });
    setTimeout(() => setMessage(null), 6000);
  };

  // Switch to Edit Mode
  const handleEditClick = (scheme: Scheme) => {
    setEditId(scheme.id);
    setTitle(scheme.title);
    setMinistry(scheme.ministry || '');
    setState(scheme.state);
    setMinAge(scheme.minAge !== null ? scheme.minAge.toString() : '');
    setMaxAge(scheme.maxAge !== null ? scheme.maxAge.toString() : '');
    setGenderRestriction(scheme.genderRestriction);
    setIncomeCeiling(scheme.incomeCeiling !== null ? scheme.incomeCeiling.toString() : '');
    setOccupations(scheme.occupations);
    setCasteCategories(scheme.casteCategories);
    setIsActive(scheme.isActive);
    setExpiryDate(scheme.expiryDate ? new Date(scheme.expiryDate).toISOString().split('T')[0] : '');
    // Reset ingestion file indicators for editing (only upload if they choose to)
    setFile(null);
    setLinkUrl('');
  };

  const handleCancelEdit = () => {
    setEditId(null);
    setTitle('');
    setMinistry('');
    setState('Central');
    setMinAge('');
    setMaxAge('');
    setGenderRestriction('All');
    setIncomeCeiling('');
    setOccupations('');
    setCasteCategories('General, OBC, SC, ST');
    setIsActive(true);
    setExpiryDate('');
    setFile(null);
    setLinkUrl('');
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !state.trim()) {
      showNotification('Scheme Title and State are required.', true);
      return;
    }

    setSubmitting(true);
    const formData = new FormData();
    formData.append('title', title);
    formData.append('ministry', ministry);
    formData.append('state', state);
    if (minAge) formData.append('minAge', minAge);
    else formData.append('minAge', '');
    if (maxAge) formData.append('maxAge', maxAge);
    else formData.append('maxAge', '');
    formData.append('genderRestriction', genderRestriction);
    if (incomeCeiling) formData.append('incomeCeiling', incomeCeiling);
    else formData.append('incomeCeiling', '');
    formData.append('occupations', occupations);
    formData.append('casteCategories', casteCategories);
    if (expiryDate) formData.append('expiryDate', expiryDate);
    else formData.append('expiryDate', '');
    formData.append('isActive', isActive ? 'true' : 'false');

    if (editId) {
      formData.append('id', editId);
    }

    // Ingestion options (only optional in edit mode, required in create mode)
    if (ingestionType === 'pdf' && file) {
      formData.append('file', file);
    } else if (ingestionType === 'url' && linkUrl.trim()) {
      formData.append('linkUrl', linkUrl.trim());
    } else if (!editId) {
      showNotification('Please supply either a guideline PDF file or a webpage link URL.', true);
      setSubmitting(false);
      return;
    }

    try {
      const url = '/api/admin/schemes';
      const method = editId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        showNotification(
          editId 
            ? 'Scheme successfully updated!' 
            : `Scheme successfully ingested! Processed ${data.chunksProcessed} vector chunks.`
        );
        handleCancelEdit();
        fetchSchemes();
        fetchAnalytics();
      } else {
        showNotification(data.error || 'Failed to process scheme.', true);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred during save.';
      showNotification(message, true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteScheme = async (id: string) => {
    if (!confirm('Are you sure you want to delete this scheme? All metadata and vector index will be lost permanently.')) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/schemes?id=${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        showNotification('Scheme deleted successfully.');
        fetchSchemes();
        fetchAnalytics();
      } else {
        showNotification(data.error || 'Failed to delete scheme.', true);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred.';
      showNotification(message, true);
    }
  };

  const handlePurgeExpired = async () => {
    setPurging(true);
    try {
      const res = await fetch('/api/admin/purge', {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        showNotification(data.message);
        fetchSchemes();
        fetchAnalytics();
      } else {
        showNotification(data.error || 'Failed to run database clean-up.', true);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred.';
      showNotification(message, true);
    } finally {
      setPurging(false);
    }
  };

  const indianStates = [
    'Central', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 
    'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 
    'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 
    'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'
  ];

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-zinc-400">
        <Loader2 className="animate-spin text-purple-500 mb-4" size={36} />
        <p className="text-xs uppercase tracking-widest font-bold">Verifying Session...</p>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl" />

        <div className="glass-panel max-w-md w-full rounded-3xl p-8 border border-zinc-900 shadow-2xl relative z-10 text-center">
          <span className="inline-flex p-3 bg-purple-950/60 border border-purple-800/40 rounded-2xl text-purple-400 mb-6">
            <ShieldCheck size={32} />
          </span>
          <h2 className="text-2xl font-black text-white tracking-tight mb-2">Admin Dashboard Secure Entry</h2>
          <p className="text-zinc-400 text-xs leading-relaxed mb-8">
            Access to this administrative control system is restricted. Please sign in with Clerk to verify your identity.
          </p>
          <SignInButton mode="modal">
            <button className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white font-bold rounded-xl shadow-lg shadow-purple-900/30 transition-all text-xs uppercase tracking-wider">
              Sign In with Clerk
            </button>
          </SignInButton>
          <div className="mt-6">
            <Link href="/" className="inline-flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 transition-colors text-xs font-semibold">
              <ArrowLeft size={12} /> Back to Goonj Portal
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (isSignedIn && !isAdmin) {
    const handleVerifySecret = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!secretKey.trim()) return;
      setVerifyingSecret(true);
      setSecretError(null);
      try {
        const res = await fetch('/api/admin/verify-secret', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ secretKey })
        });
        const data = await res.json();
        if (data.success) {
          if (user) {
            await user.reload();
          }
        } else {
          setSecretError(data.error || 'Verification failed.');
        }
      } catch (err) {
        setSecretError('Network error. Failed to verify secret.');
      } finally {
        setVerifyingSecret(false);
      }
    };

    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl" />

        <div className="glass-panel max-w-md w-full rounded-3xl p-8 border border-zinc-900 shadow-2xl relative z-10">
          <div className="text-center mb-6">
            <span className="inline-flex p-3 bg-teal-950/60 border border-teal-800/40 rounded-2xl text-teal-400 mb-4 animate-pulse">
              <AlertCircle size={32} />
            </span>
            <h2 className="text-2xl font-black text-white tracking-tight">Specify Admin Passcode</h2>
            <p className="text-zinc-400 text-xs leading-relaxed mt-2">
              Your account is not configured as an administrator. Enter the secret key from your environment settings to promote this account.
            </p>
          </div>

          {secretError && (
            <div className="p-3 bg-red-950/20 border border-red-900/50 rounded-xl flex items-center gap-2 text-red-300 text-xs mb-4">
              <AlertCircle size={14} className="shrink-0" />
              <span>{secretError}</span>
            </div>
          )}

          <form onSubmit={handleVerifySecret} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                Admin Secret Key
              </label>
              <input
                type="password"
                value={secretKey}
                onChange={e => setSecretKey(e.target.value)}
                placeholder="Enter ADMIN_SECRET_KEY"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-xs md:text-sm text-white focus:outline-none focus:border-purple-600 tracking-widest text-center"
                required
              />
            </div>

            <button
              type="submit"
              disabled={verifyingSecret}
              className="w-full py-3.5 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 text-white font-bold rounded-xl shadow-lg transition-all text-xs uppercase tracking-wider flex items-center justify-center gap-2"
            >
              {verifyingSecret ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Verifying Passcode...
                </>
              ) : (
                'Verify & Authorize'
              )}
            </button>
          </form>

          <div className="mt-6 flex justify-between items-center text-xs">
            <Link href="/" className="inline-flex items-center gap-1 text-zinc-500 hover:text-zinc-300 transition-colors font-semibold">
              <ArrowLeft size={12} /> Back to Goonj
            </Link>
            <button
              onClick={() => signOut()}
              className="text-zinc-500 hover:text-red-400 transition-colors font-semibold uppercase tracking-wider text-[10px]"
            >
              Switch Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 md:p-12 max-w-6xl mx-auto">
      {/* Top Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10 pb-6 border-b border-zinc-900">
        <div>
          <Link href="/" className="inline-flex items-center gap-2 text-zinc-400 hover:text-zinc-200 transition-colors mb-2 text-xs font-bold uppercase tracking-wider">
            <ArrowLeft size={14} /> Back to Goonj Portal
          </Link>
          <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-2">
            GOONJ Administration Dashboard
          </h1>
          <p className="text-zinc-500 text-xs mt-1">
            Feed schemes, modify guidelines databases, monitor auto-expiry, and audit voice-search analytics.
          </p>
        </div>

        <button
          onClick={handlePurgeExpired}
          disabled={purging}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800 transition-all text-xs font-bold uppercase tracking-wider disabled:opacity-50"
        >
          {purging ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          Deactivate & Purge Expired Schemes
        </button>
      </div>

      {/* Analytics Dashboard Grid */}
      <section className="mb-10 space-y-6">
        <h2 className="text-base font-bold text-zinc-400 uppercase tracking-widest">
          Discovery Analytics Monitor
        </h2>
        
        {analyticsLoading ? (
          <div className="py-8 flex justify-center text-zinc-500">
            <Loader2 className="animate-spin text-purple-400" />
          </div>
        ) : analytics ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Top Stat cards */}
            <div className="glass-panel rounded-2xl p-5 border border-zinc-900 flex items-center gap-4">
              <div className="bg-purple-950/60 border border-purple-900/40 p-3 rounded-xl text-purple-400">
                <Users size={20} />
              </div>
              <div>
                <span className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Registered Citizens</span>
                <span className="text-xl font-extrabold text-white">{analytics.totalUsers}</span>
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-5 border border-zinc-900 flex items-center gap-4">
              <div className="bg-teal-950/60 border border-teal-900/40 p-3 rounded-xl text-teal-400">
                <Search size={20} />
              </div>
              <div>
                <span className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Voice Searches Processed</span>
                <span className="text-xl font-extrabold text-white">{analytics.totalSearches}</span>
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-5 border border-zinc-900 flex items-center gap-4">
              <div className="bg-rose-950/60 border border-rose-900/40 p-3 rounded-xl text-rose-400">
                <Heart size={20} />
              </div>
              <div>
                <span className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Citizen Helpfulness Ratio</span>
                <span className="text-xl font-extrabold text-white">
                  {analytics.feedback.percent}% ({analytics.feedback.helpful}/{analytics.feedback.total})
                </span>
              </div>
            </div>

            {/* Demographics / Lists summary */}
            <div className="glass-panel rounded-2xl p-5 border border-zinc-900 space-y-4">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5 border-b border-zinc-900 pb-2">
                <Globe size={14} className="text-purple-400" /> Active Regional Languages
              </h3>
              {analytics.languages.length === 0 ? (
                <p className="text-xs text-zinc-600">No searches recorded yet.</p>
              ) : (
                <ul className="space-y-2 text-xs">
                  {analytics.languages.map((l, i) => (
                    <li key={i} className="flex justify-between items-center text-zinc-400">
                      <span className="capitalize">{l.name}</span>
                      <span className="font-bold text-white">{l.count} checks</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="glass-panel rounded-2xl p-5 border border-zinc-900 space-y-4">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5 border-b border-zinc-900 pb-2">
                <MapPin size={14} className="text-purple-400" /> Top Active States
              </h3>
              {analytics.states.length === 0 ? (
                <p className="text-xs text-zinc-600">No states recorded yet.</p>
              ) : (
                <ul className="space-y-2 text-xs">
                  {analytics.states.map((s, i) => (
                    <li key={i} className="flex justify-between items-center text-zinc-400">
                      <span>{s.name}</span>
                      <span className="font-bold text-white">{s.count} checks</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="glass-panel rounded-2xl p-5 border border-zinc-900 space-y-4">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5 border-b border-zinc-900 pb-2">
                <Building size={14} className="text-purple-400" /> Top Saved Schemes
              </h3>
              {analytics.mostSavedSchemes.length === 0 ? (
                <p className="text-xs text-zinc-600">No schemes bookmarked yet.</p>
              ) : (
                <ul className="space-y-2 text-xs">
                  {analytics.mostSavedSchemes.map((s, i) => (
                    <li key={i} className="flex justify-between items-center text-zinc-400">
                      <span className="truncate max-w-[140px] font-semibold text-zinc-300" title={s.title}>{s.title}</span>
                      <span className="font-bold text-white shrink-0">{s.savedCount} saves</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <p className="text-xs text-zinc-650">Analytics unavailable.</p>
        )}
      </section>

      {/* Notifications */}
      {message && (
        <div className={`p-4 rounded-xl mb-8 flex items-start gap-3 border ${
          message.isError 
            ? 'bg-red-950/20 border-red-900/50 text-red-200' 
            : 'bg-teal-950/20 border-teal-900/50 text-teal-200'
        }`}>
          {message.isError ? <AlertCircle size={20} className="shrink-0 mt-0.5" /> : <Check size={20} className="shrink-0 mt-0.5" />}
          <span className="text-xs md:text-sm font-semibold">{message.text}</span>
        </div>
      )}

      {/* Main Form and Database Table layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form panel */}
        <div className="lg:col-span-1 glass-panel rounded-2xl p-6 h-fit border border-zinc-900">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-base font-extrabold text-white flex items-center gap-2">
              <Upload size={16} className="text-purple-400 animate-bounce" />
              {editId ? 'Edit Active Scheme' : 'Ingest New Scheme'}
            </h2>
            {editId && (
              <button 
                onClick={handleCancelEdit}
                className="p-1 rounded bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white"
                title="Cancel Edit"
              >
                <X size={12} />
              </button>
            )}
          </div>
          
          <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                Scheme Title
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. PM Kisan Samman Nidhi"
                className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-purple-600"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                Ministry / Department
              </label>
              <input
                type="text"
                value={ministry}
                onChange={e => setMinistry(e.target.value)}
                placeholder="e.g. Ministry of Agriculture"
                className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-purple-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                  State Scope
                </label>
                <select
                  value={state}
                  onChange={e => setState(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-purple-600"
                >
                  {indianStates.map(st => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                  Gender Restriction
                </label>
                <select
                  value={genderRestriction}
                  onChange={e => setGenderRestriction(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-purple-600"
                >
                  <option value="All">All Genders</option>
                  <option value="Female">Female Only</option>
                  <option value="Male">Male Only</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                  Min Age Limit
                </label>
                <input
                  type="number"
                  value={minAge}
                  onChange={e => setMinAge(e.target.value)}
                  placeholder="e.g. 18"
                  className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-purple-600"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                  Max Age Limit
                </label>
                <input
                  type="number"
                  value={maxAge}
                  onChange={e => setMaxAge(e.target.value)}
                  placeholder="e.g. 60"
                  className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-purple-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                Max Income Ceiling (Annual INR)
              </label>
              <input
                type="number"
                value={incomeCeiling}
                onChange={e => setIncomeCeiling(e.target.value)}
                placeholder="e.g. 200000"
                className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-purple-600"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                Eligible Occupations (Comma-separated)
              </label>
              <input
                type="text"
                value={occupations}
                onChange={e => setOccupations(e.target.value)}
                placeholder="e.g. farmer, student, unemployed"
                className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-purple-600"
              />
              <span className="text-[10px] text-zinc-500 mt-1 block">Leave empty or write &apos;all&apos; for all jobs.</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                  Caste Categories
                </label>
                <input
                  type="text"
                  value={casteCategories}
                  onChange={e => setCasteCategories(e.target.value)}
                  placeholder="SC, ST, OBC, General"
                  className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-purple-600"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Calendar size={12} /> Expiry Date
                </label>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={e => setExpiryDate(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-purple-600 [color-scheme:dark]"
                />
              </div>
            </div>

            {editId && (
              <div className="flex items-center gap-2 pt-2 pb-1">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={isActive}
                  onChange={e => setIsActive(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-800 text-purple-600 bg-zinc-950 focus:ring-0"
                />
                <label htmlFor="isActive" className="text-zinc-300 font-bold">
                  Scheme is Active & Searchable
                </label>
              </div>
            )}

            {/* Ingestion Source Tabs */}
            <div className="pt-3 border-t border-zinc-900">
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">
                {editId ? 'Update Guideline Document (Optional)' : 'Guideline Source Document'}
              </label>
              <div className="grid grid-cols-2 gap-2 bg-zinc-950 p-1 rounded-xl mb-3">
                <button
                  type="button"
                  onClick={() => setIngestionType('pdf')}
                  className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    ingestionType === 'pdf' ? 'bg-zinc-900 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-200'
                  }`}
                >
                  PDF Document
                </button>
                <button
                  type="button"
                  onClick={() => setIngestionType('url')}
                  className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    ingestionType === 'url' ? 'bg-zinc-900 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-200'
                  }`}
                >
                  Web Link (URL)
                </button>
              </div>

              {ingestionType === 'pdf' ? (
                <div className="border border-dashed border-zinc-800 hover:border-zinc-700 bg-zinc-950 p-4 rounded-xl text-center cursor-pointer transition-all">
                  <input
                    type="file"
                    id="pdf-upload"
                    accept="application/pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <label htmlFor="pdf-upload" className="cursor-pointer block">
                    <FileText className="mx-auto text-zinc-650 mb-2" size={26} />
                    <span className="text-[11px] font-medium text-zinc-400 block">
                      {file ? file.name : 'Select PDF circular guidelines'}
                    </span>
                    <span className="text-[9px] text-zinc-500 mt-1 block">Max size 15MB</span>
                  </label>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="bg-zinc-950 border border-zinc-850 rounded-xl p-2.5 text-zinc-550">
                    <LinkIcon size={14} />
                  </div>
                  <input
                    type="url"
                    value={linkUrl}
                    onChange={e => setLinkUrl(e.target.value)}
                    placeholder="https://scheme-guidelines.gov.in"
                    className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-600"
                  />
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 mt-4 px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 text-white font-bold rounded-xl shadow-lg shadow-purple-900/20 transition-all text-xs"
            >
              {submitting ? (
                <>
                  <Loader2 size={12} className="animate-spin" /> {editId ? 'Updating...' : 'Vectorizing...'}
                </>
              ) : (
                <>
                  <Check size={12} /> {editId ? 'Save Scheme Updates' : 'Vectorize & Add Scheme'}
                </>
              )}
            </button>
          </form>
        </div>

        {/* Database catalog list */}
        <div className="lg:col-span-2 glass-panel rounded-2xl p-6 border border-zinc-900">
          <h2 className="text-base font-extrabold text-white mb-6 flex items-center gap-2">
            <FileText size={16} className="text-teal-400" />
            Registered Welfare Schemes Database ({schemes.length})
          </h2>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
              <Loader2 size={32} className="animate-spin text-purple-400 mb-4" />
              <p className="text-xs">Connecting to SQLite catalog database...</p>
            </div>
          ) : schemes.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-zinc-900 rounded-xl bg-zinc-950/20 text-zinc-650">
              <FileText className="mx-auto text-zinc-800 mb-3" size={36} />
              <h3 className="text-xs font-bold text-zinc-500">Database Empty</h3>
              <p className="text-[10px] mt-1">Fill out the ingestion builder to feed guidelines.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-900 text-zinc-500 text-[10px] font-bold uppercase tracking-wider">
                    <th className="pb-3 pr-2">Scheme Name</th>
                    <th className="pb-3 px-2">Scope / Status</th>
                    <th className="pb-3 px-2">Criteria Range</th>
                    <th className="pb-3 px-2">Validity</th>
                    <th className="pb-3 pl-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900/40">
                  {schemes.map(sch => (
                    <tr key={sch.id} className="text-zinc-300 hover:bg-zinc-900/20 transition-colors">
                      <td className="py-4 pr-4 font-semibold text-white max-w-[200px]">
                        <div className="truncate text-xs font-bold" title={sch.title}>{sch.title}</div>
                        <div className="text-[9px] text-zinc-550 truncate mt-0.5" title={sch.documentUrl || ''}>{sch.documentUrl}</div>
                      </td>
                      <td className="py-4 px-2">
                        <span className="inline-block px-1.5 py-0.5 rounded text-[8px] font-extrabold bg-zinc-900 text-zinc-450 border border-zinc-800 mr-1">
                          {sch.state}
                        </span>
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-extrabold border ${
                          sch.isActive 
                            ? 'bg-teal-950/40 border-teal-800/40 text-teal-400' 
                            : 'bg-zinc-900 border-zinc-800 text-zinc-500'
                        }`}>
                          {sch.isActive ? 'Active' : 'Expired'}
                        </span>
                      </td>
                      <td className="py-4 px-2 text-[10px] text-zinc-400">
                        <div>
                          Age:{' '}
                          {sch.minAge !== null || sch.maxAge !== null
                            ? `${sch.minAge || '0'}-${sch.maxAge || '∞'}`
                            : 'All ages'}
                        </div>
                        <div className="text-zinc-550 text-[9px] mt-0.5">
                          Income Ceiling:{' '}
                          {sch.incomeCeiling !== null
                            ? `₹${sch.incomeCeiling.toLocaleString()}`
                            : 'None'}
                        </div>
                      </td>
                      <td className="py-4 px-2 text-[10px] text-zinc-400">
                        {sch.expiryDate ? (
                          <span className={`${
                            new Date(sch.expiryDate) < new Date() ? 'text-red-400 font-bold' : 'text-zinc-500'
                          }`}>
                            {new Date(sch.expiryDate).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-zinc-650">Never</span>
                        )}
                      </td>
                      <td className="py-4 pl-2 text-right">
                        <div className="flex gap-1 justify-end">
                          <button
                            onClick={() => handleEditClick(sch)}
                            className="p-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-all"
                            title="Edit Scheme Details"
                          >
                            <Edit2 size={11} />
                          </button>
                          <button
                            onClick={() => handleDeleteScheme(sch.id)}
                            className="p-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-red-400 hover:border-red-950 transition-all"
                            title="Delete Scheme permanently"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
