import React from 'react';
import { X, FolderOpen, ArrowUpRight, Sparkles } from 'lucide-react';
import { useClientAccess } from '../hooks/useClientAccess';

// The signed-in couple's delivery list (client-portal rework — see
// docs/superpowers/specs/2026-08-12-client-portal-and-team-design.md): each
// published entry for their access code as a title, a description, and a
// button opening the studio's Google Drive folder in a new tab. This is how
// the studio actually delivers photographs — the old proofing grid over the
// PUBLIC photo set (plus its fake favourites and fake ZIP download) showed
// couples everything except their own photographs, and is deleted.
//
// Fetches on every open via the stored access code, so a delivery the admin
// added five minutes ago is there on the next open without signing in again.
export default function ClientGalleryModal({ isOpen, onClose, user }) {
  const code = isOpen && user?.code ? user.code : null;
  const { status, galleries, lookup } = useClientAccess(code);

  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 bg-pitch-950/85 backdrop-blur-xl animate-fade-in text-pitch-900">
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-offwhite-100 rounded-3xl border border-pitch-900/15 shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="p-6 sm:px-8 bg-offwhite-50 border-b border-pitch-900/10 flex items-start justify-between gap-4 shrink-0">
          <div>
            <div className="flex items-center space-x-2 text-pitch-900 text-xs uppercase tracking-[0.25em] font-semibold mb-1">
              <Sparkles className="w-4 h-4" aria-hidden="true" />
              <span>Your Photograph Deliveries</span>
            </div>
            <h2 className="font-garamond text-xl sm:text-3xl font-bold text-pitch-900">
              {user.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-2 bg-offwhite-100 text-charcoal-500 hover:bg-pitch-900 hover:text-offwhite-50 rounded-full transition-colors border border-pitch-900/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Delivery list */}
        <div className="p-6 sm:p-8 overflow-y-auto">
          {status === 'loading' && (
            <p className="py-10 text-center text-sm text-charcoal-700">Loading your galleries…</p>
          )}

          {status === 'error' && (
            <div role="alert" className="py-10 text-center">
              <p className="text-sm font-semibold text-pitch-900 mb-4">
                We could not load your galleries just now.
              </p>
              <button
                type="button"
                onClick={() => lookup(user.code)}
                className="px-6 py-2.5 rounded-lg bg-pitch-900 text-offwhite-50 text-xs uppercase tracking-widest font-semibold hover:bg-pitch-800 transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {status === 'ready' && galleries.length === 0 && (
            <p className="py-10 text-center text-sm text-charcoal-700">
              Your galleries are being prepared — the studio will let you know the moment they are ready.
            </p>
          )}

          {status === 'ready' && galleries.length > 0 && (
            <ul className="space-y-4">
              {galleries.map((gallery) => (
                <li
                  key={gallery.id}
                  className="border border-pitch-900/10 rounded-2xl bg-offwhite-50 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4"
                >
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <span className="mt-0.5 w-10 h-10 shrink-0 rounded-full bg-offwhite-200 border border-pitch-900/10 flex items-center justify-center">
                      <FolderOpen className="w-5 h-5 text-pitch-900" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-garamond text-lg sm:text-xl font-bold text-pitch-900">
                        {gallery.title}
                      </h3>
                      {gallery.description && (
                        <p className="text-sm text-charcoal-700 mt-0.5">{gallery.description}</p>
                      )}
                    </div>
                  </div>
                  <a
                    href={gallery.driveUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-pitch-900 text-offwhite-50 text-xs uppercase tracking-widest font-semibold hover:bg-pitch-800 transition-colors"
                  >
                    <span>Open in Google Drive</span>
                    <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="px-6 sm:px-8 py-4 bg-offwhite-50 border-t border-pitch-900/10 shrink-0">
          <p className="text-[11px] text-charcoal-500 text-center">
            Links open your private Google Drive folder in a new tab. Questions? Write to the studio any time.
          </p>
        </div>
      </div>
    </div>
  );
}
