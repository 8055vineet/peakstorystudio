import React from 'react';
import { MessageCircle } from 'lucide-react';
import { WHATSAPP_NUMBER } from '../data/contact';

const DEFAULT_MESSAGE = "Hello Peak Story Studio, I'd like to ask about wedding coverage.";

// wa.me needs no API, no approval, and no fee — the WhatsApp Business API is
// deliberately out of scope. Renders nothing when unconfigured, so the site
// never ships a number the studio has not confirmed.
export default function WhatsAppButton({ message = DEFAULT_MESSAGE, className = '' }) {
  if (!WHATSAPP_NUMBER) return null;

  const href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center justify-center space-x-2 px-6 py-3 rounded-full border border-pitch-900/20 bg-offwhite-50 text-pitch-900 text-xs uppercase tracking-widest font-semibold hover:bg-offwhite-100 transition-all ${className}`}
    >
      <MessageCircle className="w-4 h-4" />
      <span>Chat on WhatsApp</span>
    </a>
  );
}
