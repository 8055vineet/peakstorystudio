import React from 'react';
import { Film, Camera, Globe, Instagram, Youtube, MessageCircle } from 'lucide-react';
import { SITE_SETTINGS_FALLBACK } from '../data/siteSettingsFallback';

// A social icon renders as a link only when its URL is known. An empty URL
// gives a plain, non-interactive span — never a dead href="#" anchor.
function SocialIcon({ href, label, children }) {
  const base =
    'w-9 h-9 rounded-full border border-pitch-900/15 text-pitch-900 flex items-center justify-center transition-colors';
  if (!href) {
    return <span className={base} aria-hidden="true">{children}</span>;
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className={`${base} hover:bg-pitch-900 hover:text-offwhite-50`}
    >
      {children}
    </a>
  );
}

const SERVICE_MARKS = [
  { icon: Film, label: 'Wedding Films' },
  { icon: Camera, label: 'Professional Photography' },
  { icon: Globe, label: 'Online Delivery' },
];

export default function Footer({ contact = SITE_SETTINGS_FALLBACK.contact }) {
  return (
    <footer className="bg-offwhite-50 border-t border-pitch-900/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 items-center">
          {/* Left: wordmark */}
          <div className="text-center md:text-left font-garamond text-xl tracking-[0.2em] text-pitch-900">
            Peak Story Studio
          </div>

          {/* Center: the studio's real contact details, from src/data/contact.js */}
          <div className="text-center text-xs leading-6 text-charcoal-700">
            <p>{contact.address}</p>
            <p>
              Email:{' '}
              <a href={`mailto:${contact.email}`} className="hover:text-pitch-900 transition-colors">
                {contact.email}
              </a>
            </p>
            <p>
              Phone:{' '}
              <a href={`tel:${contact.phone.replace(/\s/g, '')}`} className="hover:text-pitch-900 transition-colors">
                {contact.phone}
              </a>
            </p>
          </div>

          {/* Right: service marks */}
          <div className="flex items-start justify-center md:justify-end gap-8">
            {SERVICE_MARKS.map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-2 text-charcoal-700 w-20">
                <Icon className="w-5 h-5" aria-hidden="true" />
                <span className="text-[9px] uppercase tracking-[0.15em] text-center leading-tight">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Social row */}
        <div className="mt-10 flex items-center justify-center gap-4">
          <SocialIcon href={contact.instagramUrl} label="Instagram">
            <Instagram className="w-4 h-4" />
          </SocialIcon>
          <SocialIcon href={contact.youtubeUrl} label="YouTube">
            <Youtube className="w-4 h-4" />
          </SocialIcon>
          <SocialIcon
            href={`https://wa.me/${contact.whatsappNumber}`}
            label="WhatsApp"
          >
            <MessageCircle className="w-4 h-4" />
          </SocialIcon>
        </div>

        <p className="mt-8 text-center text-[11px] text-charcoal-500">
          © {new Date().getFullYear()} Peak Story Studio. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
