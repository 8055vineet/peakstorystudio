import React, { useState } from 'react';
import { X, Lock, Camera, Heart } from 'lucide-react';

export default function AuthModal({ isOpen, onClose, onLoginSuccess }) {
  const [activeTab, setActiveTab] = useState('client'); // 'client' or 'admin'
  
  // Form States
  const [coupleName, setCoupleName] = useState('');
  const [clientPin, setClientPin] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleAdminLogin = (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!adminEmail || !adminPassword) {
      setErrorMsg('Please enter both email and password.');
      return;
    }
    // Demo validation
    if (adminPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    setSuccessMsg('Welcome back, Director. Accessing Studio Portal...');
    setTimeout(() => {
      onLoginSuccess({
        role: 'admin',
        name: 'Studio Director',
        email: adminEmail,
      });
      setSuccessMsg('');
      onClose();
    }, 1000);
  };

  const handleClientLogin = (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!clientPin) {
      setErrorMsg('Please enter your 4-digit Wedding Access PIN.');
      return;
    }

    setSuccessMsg(`Welcome ${coupleName}! Unlocking your private wedding gallery...`);
    setTimeout(() => {
      onLoginSuccess({
        role: 'client',
        name: coupleName,
        pin: clientPin,
        weddingDate: 'December 18, 2025',
        location: 'Udaipur Palace'
      });
      setSuccessMsg('');
      onClose();
    }, 1000);
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
            className="p-2 bg-offwhite-50 text-charcoal-500 hover:bg-pitch-900 hover:text-offwhite-50 rounded-full transition-colors border border-pitch-900/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-pitch-900/10 px-6 pt-4 space-x-6 bg-offwhite-100">
          <button
            onClick={() => { setActiveTab('client'); setErrorMsg(''); setSuccessMsg(''); }}
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
            onClick={() => { setActiveTab('admin'); setErrorMsg(''); setSuccessMsg(''); }}
            className={`pb-3 text-xs uppercase tracking-wider font-bold border-b-2 transition-all flex items-center space-x-2 ${
              activeTab === 'admin'
                ? 'border-pitch-900 text-pitch-900'
                : 'border-transparent text-charcoal-500 hover:text-pitch-900'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>Studio Login</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 sm:p-8">
          
          {errorMsg && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl flex items-center">
              <span className="font-bold mr-2">Error:</span> {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 text-xs rounded-xl flex items-center">
              <span className="font-bold mr-2">Success:</span> {successMsg}
            </div>
          )}

          {/* Client Tab */}
          {activeTab === 'client' && (
            <form onSubmit={handleClientLogin} className="space-y-5 animate-fade-in">
              <p className="text-sm text-charcoal-500 mb-6 font-garamond italic">
                Enter your details to access your private proofing gallery and final wedding deliverables.
              </p>
              
              <div>
                <label className="block text-xs uppercase tracking-widest text-pitch-900 mb-2 font-bold">
                  Couple Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul & Priya"
                  value={coupleName}
                  onChange={(e) => setCoupleName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-offwhite-100 border border-pitch-900/20 text-pitch-900 text-sm focus:outline-none focus:border-pitch-900"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-widest text-pitch-900 mb-2 font-bold">
                  4-Digit Access PIN
                </label>
                <input
                  type="password"
                  required
                  maxLength={4}
                  placeholder="****"
                  value={clientPin}
                  onChange={(e) => setClientPin(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-offwhite-100 border border-pitch-900/20 text-pitch-900 text-center tracking-[1em] text-lg focus:outline-none focus:border-pitch-900"
                />
                <p className="text-[10px] text-charcoal-400 mt-2 text-center">
                  Your PIN was provided in your booking confirmation email.
                </p>
              </div>

              <button
                type="submit"
                className="w-full mt-4 py-4 rounded-xl bg-pitch-900 text-offwhite-50 font-bold uppercase tracking-[0.2em] text-xs hover:bg-pitch-800 transition-all shadow-md flex items-center justify-center space-x-2"
              >
                <Lock className="w-4 h-4" />
                <span>Unlock Gallery</span>
              </button>
            </form>
          )}

          {/* Admin Tab */}
          {activeTab === 'admin' && (
            <form onSubmit={handleAdminLogin} className="space-y-5 animate-fade-in">
              <p className="text-sm text-charcoal-500 mb-6 font-garamond italic">
                Authorized Peak Story Studio personnel only. Access CMS and Lead Management.
              </p>

              <div>
                <label className="block text-xs uppercase tracking-widest text-pitch-900 mb-2 font-bold">
                  Studio Email
                </label>
                <input
                  type="email"
                  required
                  placeholder="admin@peakstory.com"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-offwhite-100 border border-pitch-900/20 text-pitch-900 text-sm focus:outline-none focus:border-pitch-900"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-widest text-pitch-900 mb-2 font-bold">
                  Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-offwhite-100 border border-pitch-900/20 text-pitch-900 text-sm focus:outline-none focus:border-pitch-900"
                />
              </div>

              <button
                type="submit"
                className="w-full mt-4 py-4 rounded-xl bg-pitch-900 text-offwhite-50 font-bold uppercase tracking-[0.2em] text-xs hover:bg-pitch-800 transition-all shadow-md flex items-center justify-center space-x-2"
              >
                <Camera className="w-4 h-4" />
                <span>Access Studio</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
