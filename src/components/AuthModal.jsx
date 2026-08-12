import React, { useState } from 'react';
import { X, Lock, Camera, Heart, ArrowUpRight } from 'lucide-react';
import { useClientAccess } from '../hooks/useClientAccess';

// The public site's sign-in. Two tabs, both honest since the client-portal
// rework (see docs/superpowers/specs/2026-08-12-client-portal-and-team-design.md):
//
// - Client Gallery: a real check. The couple enters the access code the
//   studio gave them; the code is looked up through the client_galleries
//   RPC and only a code that unlocks at least one published delivery signs
//   in. On success the code is handed up via onLoginSuccess and persisted
//   with the session, so ClientGalleryModal can re-fetch the current list
//   any time it opens.
// - Studio: a plain link to the real admin app (/admin.html, Supabase
//   Auth). The former fake email/password form checked nothing and went
//   nowhere; personnel sign in where the actual dashboard lives.
export default function AuthModal({ isOpen, onClose, onLoginSuccess }) {
  const [activeTab, setActiveTab] = useState('client');
  const [accessCode, setAccessCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const { status, lookup } = useClientAccess();
  const pending = status === 'loading';

  if (!isOpen) return null;

  const handleClientLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    const code = accessCode.trim();
    if (code.length < 6) {
      setErrorMsg('Access codes are at least 6 characters — please check yours.');
      return;
    }

    let galleries;
    try {
      galleries = await lookup(code);
    } catch {
      setErrorMsg('We could not check that code right now. Please try again in a moment.');
      return;
    }

    if (galleries.length === 0) {
      setErrorMsg('That access code was not recognised. Please check it, or contact the studio.');
      return;
    }

    onLoginSuccess({
      role: 'client',
      name: galleries[0].coupleLabel || galleries[0].title,
      code,
    });
    setAccessCode('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-pitch-950/80 backdrop-blur-2xl animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-md bg-offwhite-50 border border-pitch-900/15 rounded-3xl overflow-hidden shadow-2xl my-auto text-pitch-900">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-pitch-900/10 bg-offwhite-100">
          <div className="flex items-center space-x-3">
            <Lock className="w-5 h-5 text-pitch-900" />
            <h2 className="text-sm font-garamond font-bold tracking-widest text-pitch-900">
              Access Portal
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-2 bg-offwhite-50 text-charcoal-500 hover:bg-pitch-900 hover:text-offwhite-50 rounded-full transition-colors border border-pitch-900/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-pitch-900/10 px-6 pt-4 space-x-6 bg-offwhite-100">
          <button
            onClick={() => { setActiveTab('client'); setErrorMsg(''); }}
            className={`pb-3 text-xs uppercase tracking-wider font-bold border-b-2 transition-all flex items-center space-x-2 ${
              activeTab === 'client'
                ? 'border-pitch-900 text-pitch-900'
                : 'border-transparent text-charcoal-500 hover:text-pitch-900'
            }`}
          >
            <Heart className="w-4 h-4" />
            <span>Client Gallery</span>
          </button>

          <button
            onClick={() => { setActiveTab('admin'); setErrorMsg(''); }}
            className={`pb-3 text-xs uppercase tracking-wider font-bold border-b-2 transition-all flex items-center space-x-2 ${
              activeTab === 'admin'
                ? 'border-pitch-900 text-pitch-900'
                : 'border-transparent text-charcoal-500 hover:text-pitch-900'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>Studio</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 sm:p-8">

          {errorMsg && (
            <div role="alert" className="mb-6 p-4 bg-offwhite-100 border border-pitch-900/20 text-pitch-900 text-xs rounded-xl">
              {errorMsg}
            </div>
          )}

          {/* Client Tab */}
          {activeTab === 'client' && (
            <form onSubmit={handleClientLogin} className="space-y-5 animate-fade-in">
              <p className="text-sm text-charcoal-500 mb-6 font-garamond italic">
                Enter the access code the studio gave you to open your photograph deliveries.
              </p>

              <div>
                <label htmlFor="client-access-code" className="block text-xs uppercase tracking-widest text-pitch-900 mb-2 font-bold">
                  Access code
                </label>
                <input
                  id="client-access-code"
                  type="text"
                  required
                  autoComplete="off"
                  autoCapitalize="characters"
                  placeholder="e.g. PSS-4K7Q2M"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-offwhite-100 border border-pitch-900/20 text-pitch-900 text-center tracking-[0.3em] text-base focus:outline-none focus:border-pitch-900"
                />
                <p className="text-[10px] text-charcoal-400 mt-2 text-center">
                  Your code came with your delivery message from the studio.
                </p>
              </div>

              <button
                type="submit"
                disabled={pending}
                className="w-full mt-4 py-4 rounded-xl bg-pitch-900 text-offwhite-50 font-bold uppercase tracking-[0.2em] text-xs hover:bg-pitch-800 transition-all shadow-md flex items-center justify-center space-x-2 disabled:opacity-60"
              >
                <Lock className="w-4 h-4" />
                <span>{pending ? 'Checking…' : 'Open My Galleries'}</span>
              </button>
            </form>
          )}

          {/* Studio Tab — a pointer to the real admin, not a form */}
          {activeTab === 'admin' && (
            <div className="space-y-5 animate-fade-in">
              <p className="text-sm text-charcoal-500 font-garamond italic">
                Studio personnel sign in on the dashboard itself.
              </p>
              <a
                href="/admin.html"
                className="w-full py-4 rounded-xl bg-pitch-900 text-offwhite-50 font-bold uppercase tracking-[0.2em] text-xs hover:bg-pitch-800 transition-all shadow-md flex items-center justify-center space-x-2"
              >
                <Camera className="w-4 h-4" />
                <span>Open the Studio Dashboard</span>
                <ArrowUpRight className="w-4 h-4" />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
