'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useUser, SignInButton, useClerk } from '@clerk/nextjs';
import { 
  Upload, Link as LinkIcon, Calendar, Check, Trash2, RefreshCw, 
  FileText, ArrowLeft, Loader2, Edit2, Users, Search, Heart, 
  Building, Globe, MapPin, X, AlertCircle, ShieldCheck, Landmark
} from 'lucide-react';

interface Scheme { id: string; title: string; ministry: string | null; state: string; minAge: number | null; maxAge: number | null; genderRestriction: string; incomeCeiling: number | null; occupations: string; casteCategories: string; expiryDate: string | null; documentUrl: string | null; applyUrl: string | null; isActive: boolean; createdAt: string; }
interface AnalyticsStats { totalUsers: number; totalSearches: number; languages: { name: string; count: number }[]; states: { name: string; count: number }[]; mostSavedSchemes: { id: string; title: string; savedCount: number; feedbackCount: number }[]; feedback: { total: number; helpful: number; percent: number; }; }

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

  const [editId, setEditId] = useState<string | null>(null);
  const [title, setTitle] = useState(''); const [ministry, setMinistry] = useState(''); const [state, setState] = useState('Central');
  const [minAge, setMinAge] = useState(''); const [maxAge, setMaxAge] = useState('');
  const [genderRestriction, setGenderRestriction] = useState('All'); const [incomeCeiling, setIncomeCeiling] = useState('');
  const [occupations, setOccupations] = useState(''); const [casteCategories, setCasteCategories] = useState('General, OBC, SC, ST');
  const [expiryDate, setExpiryDate] = useState(''); const [isActive, setIsActive] = useState(true);
  const [ingestionType, setIngestionType] = useState<'pdf' | 'url'>('pdf');
  const [linkUrl, setLinkUrl] = useState(''); const [applyUrl, setApplyUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  const totalPages = Math.ceil(schemes.length / itemsPerPage);
  const activePage = Math.min(currentPage, Math.max(totalPages, 1));
  const startIndex = (activePage - 1) * itemsPerPage;
  const paginatedSchemes = schemes.slice(startIndex, startIndex + itemsPerPage);

  const fetchSchemes = async () => {
    try { setLoading(true); const res = await fetch(`/api/admin/schemes?t=${Date.now()}`, { cache: 'no-store' }); const data = await res.json(); if (data.success) { setSchemes(data.schemes); } else { showNotification(data.error || 'Failed.', true); } } catch (err) { showNotification(`Network Error`, true); } finally { setLoading(false); }
  };

  const fetchAnalytics = async () => {
    try { setAnalyticsLoading(true); const res = await fetch(`/api/admin/analytics?t=${Date.now()}`, { cache: 'no-store' }); const data = await res.json(); if (data.success) { setAnalytics(data.stats); } else { showNotification(data.error || 'Failed.', true); } } catch (err) { showNotification(`Network Error`, true); } finally { setAnalyticsLoading(false); }
  };

  const isAdmin = user?.publicMetadata?.role === 'admin';

  useEffect(() => { if (isLoaded && isSignedIn && isAdmin) { fetchSchemes(); fetchAnalytics(); } }, [isLoaded, isSignedIn, isAdmin]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files && e.target.files.length > 0) setFile(e.target.files[0]); };
  const showNotification = (text: string, isError = false) => { setMessage({ text, isError }); setTimeout(() => setMessage(null), 6000); };

  const handleEditClick = (scheme: Scheme) => { setEditId(scheme.id); setTitle(scheme.title); setMinistry(scheme.ministry || ''); setState(scheme.state); setMinAge(scheme.minAge !== null ? scheme.minAge.toString() : ''); setMaxAge(scheme.maxAge !== null ? scheme.maxAge.toString() : ''); setGenderRestriction(scheme.genderRestriction); setIncomeCeiling(scheme.incomeCeiling !== null ? scheme.incomeCeiling.toString() : ''); setOccupations(scheme.occupations); setCasteCategories(scheme.casteCategories); setIsActive(scheme.isActive); setExpiryDate(scheme.expiryDate ? new Date(scheme.expiryDate).toISOString().split('T')[0] : ''); setApplyUrl(scheme.applyUrl || ''); setFile(null); setLinkUrl(''); };
  const handleCancelEdit = () => { setEditId(null); setTitle(''); setMinistry(''); setState('Central'); setMinAge(''); setMaxAge(''); setGenderRestriction('All'); setIncomeCeiling(''); setOccupations(''); setCasteCategories('General, OBC, SC, ST'); setIsActive(true); setExpiryDate(''); setFile(null); setLinkUrl(''); setApplyUrl(''); };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !state.trim()) { showNotification('Title and State are required.', true); return; }
    setSubmitting(true);
    const formData = new FormData();
    formData.append('title', title); formData.append('ministry', ministry); formData.append('state', state);
    if (minAge) formData.append('minAge', minAge); else formData.append('minAge', '');
    if (maxAge) formData.append('maxAge', maxAge); else formData.append('maxAge', '');
    formData.append('genderRestriction', genderRestriction);
    if (incomeCeiling) formData.append('incomeCeiling', incomeCeiling); else formData.append('incomeCeiling', '');
    formData.append('occupations', occupations); formData.append('casteCategories', casteCategories);
    if (expiryDate) formData.append('expiryDate', expiryDate); else formData.append('expiryDate', '');
    formData.append('isActive', isActive ? 'true' : 'false'); formData.append('applyUrl', applyUrl.trim());
    if (editId) formData.append('id', editId);

    if (ingestionType === 'pdf' && file) formData.append('file', file);
    else if (ingestionType === 'url' && linkUrl.trim()) formData.append('linkUrl', linkUrl.trim());
    else if (!editId) { showNotification('Please supply PDF or URL.', true); setSubmitting(false); return; }

    try {
      const res = await fetch('/api/admin/schemes', { method: editId ? 'PUT' : 'POST', body: formData });
      const data = await res.json();
      if (data.success) { showNotification(editId ? 'Updated!' : `Ingested! Chunks: ${data.chunksProcessed}`); handleCancelEdit(); fetchSchemes(); fetchAnalytics(); } else { showNotification(data.error, true); }
    } catch (err) { showNotification('Error during save.', true); } finally { setSubmitting(false); }
  };

  const handleDeleteScheme = async (id: string) => {
    if (!confirm('Delete this scheme permanently?')) return;
    try { const res = await fetch(`/api/admin/schemes?id=${id}`, { method: 'DELETE' }); const data = await res.json(); if (data.success) { showNotification('Deleted.'); fetchSchemes(); fetchAnalytics(); } else { showNotification(data.error, true); } } catch (err) { showNotification('Error.', true); }
  };

  const handlePurgeExpired = async () => {
    setPurging(true);
    try { const res = await fetch('/api/admin/purge', { method: 'POST' }); const data = await res.json(); if (data.success) { showNotification(data.message); fetchSchemes(); fetchAnalytics(); } else { showNotification(data.error, true); } } catch (err) { showNotification('Error.', true); } finally { setPurging(false); }
  };

  const indianStates = ['Central', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'];

  if (!isLoaded) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 className="animate-spin text-slate-900" size={40} /></div>;

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white max-w-md w-full rounded-3xl p-10 border border-slate-200 shadow-2xl text-center border-t-4 border-t-slate-900">
          <ShieldCheck size={48} className="text-slate-900 mx-auto mb-6" />
          <h2 className="text-3xl font-black text-slate-900 mb-3">Admin Portal</h2>
          <p className="text-slate-500 text-sm font-medium mb-8">Access to this environment is highly restricted.</p>
          <SignInButton mode="modal">
            <button className="w-full py-4 bg-slate-900 hover:bg-black text-white font-black rounded-xl shadow-lg transition-all text-sm">Authenticate Identity</button>
          </SignInButton>
          <Link href="/" className="mt-8 inline-flex items-center gap-2 text-slate-400 hover:text-slate-900 font-bold text-sm">
            <ArrowLeft size={16} /> Back to Goonj Portal
          </Link>
        </div>
      </div>
    );
  }

  if (isSignedIn && !isAdmin) {
    const handleVerifySecret = async (e: React.FormEvent) => {
      e.preventDefault(); if (!secretKey.trim()) return; setVerifyingSecret(true); setSecretError(null);
      try {
        const res = await fetch('/api/admin/verify-secret', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ secretKey }) });
        const data = await res.json();
        if (data.success) { if (user) await user.reload(); } else { setSecretError(data.error); }
      } catch (err) { setSecretError('Network error.'); } finally { setVerifyingSecret(false); }
    };

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white max-w-md w-full rounded-3xl p-10 border border-slate-200 shadow-2xl border-t-4 border-t-orange-500">
          <AlertCircle size={48} className="text-orange-500 mx-auto mb-6" />
          <h2 className="text-2xl font-black text-slate-900 text-center mb-3">Authorization Required</h2>
          <p className="text-slate-500 text-sm text-center font-medium mb-8">Enter the secure environment passcode to grant administrative privileges.</p>
          {secretError && <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm font-bold mb-6">{secretError}</div>}
          <form onSubmit={handleVerifySecret} className="space-y-6">
            <input type="password" value={secretKey} onChange={e => setSecretKey(e.target.value)} placeholder="Passcode" className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-4 text-center font-mono font-bold text-slate-900 focus:ring-2 focus:ring-slate-900 focus:outline-none" required />
            <button type="submit" disabled={verifyingSecret} className="w-full py-4 bg-slate-900 hover:bg-black text-white font-black rounded-xl shadow-lg transition-all text-sm flex justify-center items-center gap-2">
              {verifyingSecret ? <Loader2 size={16} className="animate-spin" /> : 'Authorize Key'}
            </button>
          </form>
          <div className="mt-8 pt-6 border-t border-slate-100 flex justify-between font-bold text-sm text-slate-400">
            <Link href="/" className="hover:text-slate-900 flex items-center gap-2"><ArrowLeft size={16}/> Back</Link>
            <button onClick={() => signOut()} className="hover:text-red-500">Switch Account</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-20">
      
      {/* Enterprise Header */}
      <div className="bg-slate-950 text-white pt-8 pb-24 px-6 md:px-12 border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <Link href="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-5 text-xs font-black uppercase tracking-widest bg-white/10 px-4 py-2 rounded-lg backdrop-blur-md border border-white/10">
              <ArrowLeft size={14} /> Back to Goonj Portal
            </Link>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight flex items-center gap-4">
              <Landmark className="text-orange-500" /> GOONJ Administration Dashboard
            </h1>
            <p className="text-slate-400 text-sm mt-2 font-medium">
              Feed schemes, modify guidelines databases, monitor auto-expiry, and audit voice-search analytics.
            </p>
          </div>
          <button onClick={handlePurgeExpired} disabled={purging} className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white transition-all text-xs font-black uppercase tracking-widest disabled:opacity-50 shadow-lg shadow-orange-500/20">
            {purging ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Deactivate & Purge Expired Schemes
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-12 -mt-12 space-y-8 relative z-10">
        
        {/* Analytics Dashboard Grid */}
        <section>
          <h2 className="text-sm font-black text-slate-600 uppercase tracking-widest border-l-4 border-slate-900 pl-3 mb-6 hidden">
            Discovery Analytics Monitor
          </h2>

          {analyticsLoading ? (
            <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-slate-400" size={32} /></div>
          ) : analytics ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Top Stat cards */}
              {[
                { label: 'Registered Citizens', value: analytics.totalUsers, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
                { label: 'Voice Searches Processed', value: analytics.totalSearches, icon: Search, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { label: 'Citizen Helpfulness Ratio', value: `${analytics.feedback.percent}%`, sub: `(${analytics.feedback.helpful}/${analytics.feedback.total})`, icon: Heart, color: 'text-orange-600', bg: 'bg-orange-50' },
              ].map((stat, i) => (
                <div key={i} className="bg-white rounded-2xl p-8 border border-slate-200 shadow-xl shadow-slate-200/40 flex items-center gap-5">
                  <div className={`${stat.bg} ${stat.color} p-4 rounded-xl`}>
                    <stat.icon size={28} />
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1.5">{stat.label}</span>
                    <span className="text-3xl font-black text-slate-900">{stat.value} {stat.sub && <span className="text-sm text-slate-400 font-bold ml-1">{stat.sub}</span>}</span>
                  </div>
                </div>
              ))}

              {/* Restored Lists */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-md space-y-4">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 border-b border-slate-100 pb-3">
                  <Globe size={16} className="text-blue-500" /> Active Regional Languages
                </h3>
                {analytics.languages.length === 0 ? (
                  <p className="text-sm text-slate-400 font-medium">No searches recorded yet.</p>
                ) : (
                  <ul className="space-y-3 text-sm font-medium">
                    {analytics.languages.map((l, i) => (
                      <li key={i} className="flex justify-between items-center text-slate-600">
                        <span className="capitalize">{l.name}</span>
                        <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">{l.count} checks</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-md space-y-4">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 border-b border-slate-100 pb-3">
                  <MapPin size={16} className="text-emerald-500" /> Top Active States
                </h3>
                {analytics.states.length === 0 ? (
                  <p className="text-sm text-slate-400 font-medium">No states recorded yet.</p>
                ) : (
                  <ul className="space-y-3 text-sm font-medium">
                    {analytics.states.map((s, i) => (
                      <li key={i} className="flex justify-between items-center text-slate-600">
                        <span>{s.name}</span>
                        <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">{s.count} checks</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-md space-y-4">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 border-b border-slate-100 pb-3">
                  <Building size={16} className="text-orange-500" /> Top Saved Schemes
                </h3>
                {analytics.mostSavedSchemes.length === 0 ? (
                  <p className="text-sm text-slate-400 font-medium">No schemes bookmarked yet.</p>
                ) : (
                  <ul className="space-y-3 text-sm font-medium">
                    {analytics.mostSavedSchemes.map((s, i) => (
                      <li key={i} className="flex justify-between items-center text-slate-600">
                        <span className="truncate max-w-[160px] text-slate-700 font-bold" title={s.title}>{s.title}</span>
                        <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded shrink-0">{s.savedCount} saves</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : null}
        </section>

        {message && (
          <div className={`p-5 rounded-2xl flex items-start gap-3 border shadow-md font-bold text-sm ${message.isError ? 'bg-red-50 border-red-200 text-red-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
            {message.isError ? <AlertCircle size={20} /> : <Check size={20} />} {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Data Ingestion Form */}
          <div className="lg:col-span-1 bg-white rounded-3xl p-8 h-fit border border-slate-200 shadow-xl shadow-slate-200/40 border-t-[6px] border-t-slate-900">
            <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-5">
              <h2 className="text-xl font-black text-slate-900 flex items-center gap-3">
                <Upload size={20} className="text-slate-400" />
                {editId ? 'Modify Scheme' : 'Ingest New Scheme'}
              </h2>
              {editId && <button onClick={handleCancelEdit} className="p-2 bg-slate-100 rounded-lg text-slate-500 hover:text-slate-900"><X size={16} /></button>}
            </div>
            
            <form onSubmit={handleFormSubmit} className="space-y-6 text-sm font-bold">
              <div>
                <label className="block text-[10px] text-slate-500 uppercase tracking-widest mb-2.5">Title</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. PM Kisan Samman Nidhi" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all shadow-inner placeholder-slate-400" required />
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 uppercase tracking-widest mb-2.5">Ministry</label>
                <input type="text" value={ministry} onChange={e => setMinistry(e.target.value)} placeholder="e.g. Ministry of Agriculture" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all shadow-inner placeholder-slate-400" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase tracking-widest mb-2.5">State</label>
                  <select value={state} onChange={e => setState(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all shadow-inner">
                    {indianStates.map(st => <option key={st} value={st}>{st}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase tracking-widest mb-2.5">Gender</label>
                  <select value={genderRestriction} onChange={e => setGenderRestriction(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all shadow-inner">
                    <option value="All">All</option><option value="Female">Female Only</option><option value="Male">Male Only</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-[10px] text-slate-500 uppercase tracking-widest mb-2.5">Min Age</label><input type="number" value={minAge} onChange={e => setMinAge(e.target.value)} placeholder="e.g. 18" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all shadow-inner placeholder-slate-400" /></div>
                <div><label className="block text-[10px] text-slate-500 uppercase tracking-widest mb-2.5">Max Age</label><input type="number" value={maxAge} onChange={e => setMaxAge(e.target.value)} placeholder="e.g. 60" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all shadow-inner placeholder-slate-400" /></div>
              </div>

              <div><label className="block text-[10px] text-slate-500 uppercase tracking-widest mb-2.5">Income Ceiling (INR)</label><input type="number" value={incomeCeiling} onChange={e => setIncomeCeiling(e.target.value)} placeholder="e.g. 200000" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all shadow-inner placeholder-slate-400" /></div>
              
              <div><label className="block text-[10px] text-slate-500 uppercase tracking-widest mb-2.5">Occupations</label><input type="text" value={occupations} onChange={e => setOccupations(e.target.value)} placeholder="e.g. farmer, student, unemployed" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all shadow-inner placeholder-slate-400" /></div>
              
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-[10px] text-slate-500 uppercase tracking-widest mb-2.5">Categories</label><input type="text" value={casteCategories} onChange={e => setCasteCategories(e.target.value)} placeholder="SC, ST, OBC, General" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all shadow-inner placeholder-slate-400" /></div>
                <div><label className="block text-[10px] text-slate-500 uppercase tracking-widest mb-2.5">Expiry</label><input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all shadow-inner" /></div>
              </div>

              {editId && (
                <div className="flex items-center gap-3 pt-2">
                  <input type="checkbox" id="isActive" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-slate-900" />
                  <label htmlFor="isActive" className="text-slate-800 cursor-pointer">Active in Search</label>
                </div>
              )}

              <div><label className="block text-[10px] text-slate-500 uppercase tracking-widest mb-2.5">Application URL</label><input type="url" value={applyUrl} onChange={e => setApplyUrl(e.target.value)} placeholder="e.g. https://pmsvanidhi.mohua.gov.in" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all shadow-inner placeholder-slate-400" /></div>

              <div className="pt-6 mt-4 border-t border-slate-100">
                <label className="block text-[10px] text-slate-500 uppercase tracking-widest mb-3">{editId ? 'Update Context (Optional)' : 'Guideline Source Document'}</label>
                <div className="grid grid-cols-2 gap-2 bg-slate-100 p-2 rounded-xl mb-4">
                  <button type="button" onClick={() => setIngestionType('pdf')} className={`py-2 text-xs uppercase tracking-widest rounded-lg transition-all ${ingestionType === 'pdf' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500'}`}>PDF</button>
                  <button type="button" onClick={() => setIngestionType('url')} className={`py-2 text-xs uppercase tracking-widest rounded-lg transition-all ${ingestionType === 'url' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500'}`}>URL Link</button>
                </div>
                {ingestionType === 'pdf' ? (
                  <div className="border-2 border-dashed border-slate-300 bg-slate-50 p-6 rounded-xl text-center cursor-pointer hover:border-slate-500 transition-all">
                    <input type="file" id="pdf-upload" accept="application/pdf" onChange={handleFileChange} className="hidden" />
                    <label htmlFor="pdf-upload" className="cursor-pointer block">
                      <FileText className="mx-auto text-slate-400 mb-3" size={28} />
                      <span className="text-sm font-bold text-slate-700 block">{file ? file.name : 'Select guidelines file'}</span>
                    </label>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-300">
                    <LinkIcon size={18} className="text-slate-400" />
                    <input type="url" value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://..." className="w-full bg-transparent text-sm font-bold text-slate-900 focus:outline-none" />
                  </div>
                )}
              </div>

              <button type="submit" disabled={submitting} className="w-full py-4 bg-slate-900 hover:bg-black disabled:bg-slate-300 text-white font-black rounded-xl shadow-xl transition-all text-sm uppercase tracking-widest flex items-center justify-center gap-3 mt-8">
                {submitting ? <><Loader2 size={18} className="animate-spin" /> Processing...</> : <><Upload size={18} /> {editId ? 'Update Record' : 'Vectorize & Add Scheme'}</>}
              </button>
            </form>
          </div>

          {/* Database Catalog */}
          <div className="lg:col-span-2 bg-white rounded-3xl p-6 lg:p-8 border border-slate-200 shadow-xl shadow-slate-200/40">
            <h2 className="text-xl font-black text-slate-900 mb-8 flex items-center gap-3 border-b border-slate-100 pb-5">
              <FileText size={22} className="text-slate-400" /> Database Catalog ({schemes.length})
            </h2>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-32"><Loader2 size={40} className="animate-spin text-slate-900" /></div>
            ) : schemes.length === 0 ? (
              <div className="text-center py-24 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 text-slate-400">
                <FileText className="mx-auto mb-4" size={48} />
                <h3 className="text-base font-bold text-slate-600">Database Empty</h3>
              </div>
            ) : (
              <div>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-sm bg-white">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr className="text-slate-400 text-[10px] font-black uppercase tracking-widest">
                        <th className="py-4 pl-6 pr-4">Entity</th>
                        <th className="py-4 px-4">Status</th>
                        <th className="py-4 px-4">Limits</th>
                        <th className="py-4 pr-6 text-right">Edit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedSchemes.map(sch => (
                        <tr key={sch.id} className="text-slate-700 hover:bg-slate-50">
                          <td className="py-5 pl-6 pr-4 max-w-[200px]">
                            <div className="truncate text-sm font-black text-slate-900" title={sch.title}>{sch.title}</div>
                            <div className="text-xs text-slate-400 font-bold mt-1.5 truncate">{sch.documentUrl}</div>
                          </td>
                          <td className="py-5 px-4">
                            <div className="flex flex-col gap-2 items-start">
                              <span className="px-2.5 py-1 rounded-md text-[9px] font-black bg-slate-200 text-slate-600 uppercase tracking-widest">{sch.state}</span>
                              <span className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest ${sch.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{sch.isActive ? 'Live' : 'Off'}</span>
                            </div>
                          </td>
                          <td className="py-5 px-4 text-xs font-bold text-slate-500">
                            <div>Age: <span className="text-slate-900">{sch.minAge || '0'}-{sch.maxAge || '∞'}</span></div>
                            <div className="mt-1">Inc: <span className="text-slate-900">{sch.incomeCeiling ? `₹${sch.incomeCeiling}` : 'None'}</span></div>
                          </td>
                          <td className="py-5 pr-6 text-right">
                            <div className="flex gap-2 justify-end">
                              <button onClick={() => handleEditClick(sch)} className="p-2.5 rounded-lg bg-slate-100 text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition-colors"><Edit2 size={16} /></button>
                              <button onClick={() => handleDeleteScheme(sch.id)} className="p-2.5 rounded-lg bg-slate-100 text-slate-500 hover:text-red-600 hover:bg-red-100 transition-colors"><Trash2 size={16} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {totalPages > 1 && (
                  <div className="mt-8 pt-5 border-t border-slate-100 flex items-center justify-between text-sm font-bold text-slate-500">
                    <div>{startIndex + 1}-{Math.min(startIndex + itemsPerPage, schemes.length)} of {schemes.length}</div>
                    <div className="flex gap-2">
                      <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={activePage === 1} className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-50">Prev</button>
                      <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={activePage === totalPages} className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-50">Next</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}