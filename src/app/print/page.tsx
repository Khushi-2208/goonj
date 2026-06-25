'use client';

import React, { useEffect, useState } from 'react';
import { Building, CheckSquare, Globe } from 'lucide-react';
import Link from 'next/link';

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
}

interface PrintData {
  profile: UserProfile;
  schemes: EligibilityResult[];
  language: string;
}

export default function PrintPage() {
  const [data, setData] = useState<PrintData | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem('goonj_print_data');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        /* eslint-disable-next-line react-hooks/set-state-in-effect */
        setData(parsed);
      } catch (err) {
        console.error('Failed to parse print data:', err);
      }
    }
  }, []);

  useEffect(() => {
    if (data) {
      // Trigger print after rendering completes
      const timer = setTimeout(() => {
        window.print();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [data]);

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-400 font-medium">
        <div className="text-center">
          <p>No print data found. Please run a benefits check first.</p>
          <Link href="/" className="mt-4 inline-block px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }


  const { profile, schemes, language } = data;

  return (
    <div className="min-h-screen bg-white text-black p-8 md:p-16 max-w-4xl mx-auto print:p-0 print:text-black">
      {/* Action header (hidden on print) */}
      <div className="flex justify-between items-center mb-8 pb-4 border-b border-zinc-200 print:hidden">
        <div>
          <h1 className="text-xl font-bold">Print Preview</h1>
          <p className="text-sm text-zinc-500">Preparing report in your language...</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors"
          >
            Print Report
          </button>
          <button
            onClick={() => window.close()}
            className="px-4 py-2 border border-zinc-300 hover:bg-zinc-50 rounded-lg transition-colors"
          >
            Close Tab
          </button>
        </div>
      </div>

      {/* Official Document Border Header */}
      <div className="border-4 border-double border-zinc-900 p-6 mb-8 text-center">
        <div className="flex justify-center items-center gap-2 mb-2">
          <span className="font-extrabold text-2xl tracking-wide uppercase">GOONJ (गूंज)</span>
        </div>
        <h2 className="text-lg font-bold uppercase tracking-wider mb-1">
          Official Government Entitlements Assessment Report
        </h2>
        <p className="text-xs text-zinc-500 uppercase tracking-widest">
          AI-Powered Scheme Discovery Engine • {new Date().toLocaleDateString()}
        </p>
      </div>

      {/* Demographic Profile Block */}
      <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-6 mb-8">
        <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-700 mb-4 border-b border-zinc-300 pb-1">
          I. Citizen Demographic Profile Summary
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="block text-zinc-500 uppercase font-semibold">State of Residence</span>
            <span className="font-bold text-sm">{profile.state}</span>
          </div>
          <div>
            <span className="block text-zinc-500 uppercase font-semibold">Age Group</span>
            <span className="font-bold text-sm">{profile.age} Years</span>
          </div>
          <div>
            <span className="block text-zinc-500 uppercase font-semibold">Gender Identity</span>
            <span className="font-bold text-sm">{profile.gender}</span>
          </div>
          <div>
            <span className="block text-zinc-500 uppercase font-semibold">Social Category (Caste)</span>
            <span className="font-bold text-sm">{profile.casteCategory}</span>
          </div>
          <div>
            <span className="block text-zinc-500 uppercase font-semibold">Annual Household Income</span>
            <span className="font-bold text-sm">₹{profile.annualIncome.toLocaleString()}</span>
          </div>
          <div>
            <span className="block text-zinc-500 uppercase font-semibold">Primary Occupation</span>
            <span className="font-bold text-sm capitalize">{profile.occupation || 'N/A'}</span>
          </div>
          <div>
            <span className="block text-zinc-500 uppercase font-semibold">Disability Status</span>
            <span className="font-bold text-sm">{profile.disabilityStatus}</span>
          </div>
          <div>
            <span className="block text-zinc-500 uppercase font-semibold">Assessment Language</span>
            <span className="font-bold text-sm uppercase">{language}</span>
          </div>
        </div>
      </div>

      {/* Summary statement */}
      <div className="mb-8">
        <p className="text-sm leading-relaxed">
          Based on the demographics listed above, Goonj has scanned central and state welfare directories and identified that you qualify for the following <strong>{schemes.length} schemes</strong>.
        </p>
      </div>

      {/* Schemes breakdown list */}
      <div className="space-y-10">
        <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-700 border-b border-zinc-300 pb-1">
          II. Matching Welfare Schemes & Qualification Details
        </h3>

        {schemes.map((scheme, index) => (
          <div key={scheme.schemeId} className="border border-zinc-300 rounded-xl p-6 print:border-zinc-300 print:shadow-none print:break-inside-avoid">
            {/* Title */}
            <div className="flex justify-between items-start border-b border-zinc-200 pb-3 mb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1 mb-1">
                  <Building size={10} /> {scheme.ministry || 'Government Department'}
                </span>
                <h4 className="text-base font-bold">
                  {index + 1}. {scheme.title}
                </h4>
                <p className="text-xs text-zinc-600 mt-2 leading-relaxed italic border-l-2 border-zinc-300 pl-3">
                  {scheme.description}
                </p>
              </div>
            </div>

            {/* Why qualify */}
            <div className="mb-4 bg-zinc-50 border border-zinc-200/60 rounded-lg p-3 text-xs">
              <span className="block font-bold text-zinc-700 uppercase text-[9px] tracking-wider mb-1">Why You Qualify</span>
              <p className="leading-relaxed">{scheme.whyEligible}</p>
            </div>

            {/* Benefits */}
            <div className="mb-4 text-xs">
              <span className="block font-bold text-zinc-700 uppercase text-[9px] tracking-wider mb-1">Benefits Offered</span>
              <p className="leading-relaxed">{scheme.benefits}</p>
            </div>

            {/* Application steps */}
            <div className="text-xs">
              <span className="block font-bold text-zinc-700 uppercase text-[9px] tracking-wider mb-2">Step-by-Step Application Process</span>
              <ul className="space-y-1.5 list-none pl-0">
                {scheme.stepsToApply.map((step, sIdx) => (
                  <li key={sIdx} className="flex items-start gap-2">
                    <CheckSquare size={12} className="shrink-0 mt-0.5 text-zinc-700" />
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </div>

            {(scheme.applyUrl || scheme.documentUrl) && (
              <div className="mt-4 pt-3 border-t border-zinc-200 text-xs">
                <span className="block font-bold text-zinc-700 uppercase text-[9px] tracking-wider mb-1">
                  {scheme.applyUrl ? 'Official Application Portal' : 'Application / Circular Source'}
                </span>
                <span className="font-semibold text-zinc-800">{scheme.applyUrl || scheme.documentUrl}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Official Footnote / Disclaimer */}
      <div className="mt-16 pt-6 border-t border-zinc-300 text-center text-[10px] text-zinc-500 uppercase tracking-widest leading-relaxed">
        <p>This document is generated by Goonj - AI Welfare Platform.</p>
        <p className="mt-1 font-semibold">Verify instructions on official state or central portals before submitting documentation.</p>
      </div>
    </div>
  );
}
