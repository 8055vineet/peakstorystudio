import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div data-testid="not-found-page" className="min-h-[50vh] flex flex-col items-center justify-center gap-6 px-6 text-center">
      <p className="font-garamond text-3xl text-pitch-900">This page does not exist.</p>
      <Link to="/" className="text-xs uppercase tracking-[0.2em] underline underline-offset-4 text-pitch-700 hover:text-pitch-900">
        Return home
      </Link>
    </div>
  );
}
