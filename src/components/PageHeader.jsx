import React from 'react';

// The quiet page-title block every inner page opens with — the same
// treatment as Home's "Images" heading, so the pages read as one family.
export default function PageHeader({ title }) {
  return (
    <div className="pt-14 pb-2 text-center">
      <h1 className="font-garamond text-3xl tracking-[0.2em] text-pitch-900 uppercase">
        {title}
      </h1>
      <div className="w-40 mx-auto mt-3 border-b border-pitch-900/20" aria-hidden="true" />
    </div>
  );
}
