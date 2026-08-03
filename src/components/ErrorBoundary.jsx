import React from 'react';
import { STUDIO_EMAIL } from '../data/contact';

/**
 * Catches render-time errors anywhere below it and shows a recovery screen
 * instead of unmounting the tree to a blank page (PS-010).
 *
 * Must be a class: getDerivedStateFromError and componentDidCatch have no
 * hook equivalent.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Phase 7 replaces this with real error monitoring.
    console.error('Unhandled render error:', error, errorInfo);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-offwhite-100 text-pitch-900 flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-5">
          <h1 className="font-garamond text-2xl font-bold tracking-tight">
            Something went wrong
          </h1>
          <p className="font-garamond text-lg text-charcoal-700 italic">
            Something on this page failed to display. Reloading may fix it.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 rounded-full bg-pitch-900 text-offwhite-50 text-xs uppercase tracking-[0.2em] font-semibold hover:bg-pitch-800 transition-colors"
          >
            Reload the page
          </button>
          <p className="text-xs text-charcoal-500">
            If it keeps happening, email {STUDIO_EMAIL} and tell us what you were viewing.
          </p>
        </div>
      </div>
    );
  }
}
