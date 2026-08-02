import React, { useState } from 'react';
import { Calendar, MapPin, Send, CheckCircle2, Phone, Mail, User, AlertTriangle, Loader2 } from 'lucide-react';
import ScrollReveal from './ScrollReveal';
import confetti from 'canvas-confetti';
import WhatsAppButton from './WhatsAppButton';
import { useInquirySubmission } from '../hooks/useInquirySubmission';
import { useTurnstile } from '../hooks/useTurnstile';
import { isInquiryBackendConfigured, TURNSTILE_SITE_KEY } from '../lib/queries/inquiries';
import { STUDIO_PHONE, STUDIO_EMAIL, STUDIO_ADDRESS } from '../data/contact';
import { validateInquiry, SERVICES } from '@shared/inquiry-validation.js';

// Every one of these ends by offering another way through, because the panel
// they appear in is the last thing standing between a couple and giving up.
// CAPTCHA_UNAVAILABLE is deliberately worded so it does not blame the visitor:
// on that path the check never ran, so telling them they failed it is both
// untrue and the likeliest moment to lose a booking.
const ERROR_COPY = {
  VALIDATION_FAILED: 'Some details need another look — see the notes above.',
  RATE_LIMITED: 'Too many inquiries from this connection just now. Please wait a few minutes, or reach us directly.',
  CAPTCHA_FAILED: 'The verification check did not pass. Please reload the page and try again.',
  CAPTCHA_UNAVAILABLE: 'Our verification service is temporarily unreachable — this is on us, not you. Please reach us directly and we will pick it up straight away.',
  CAPTCHA_NOT_CONFIGURED: 'The form is temporarily unavailable. Please reach us directly.',
  PAYLOAD_TOO_LARGE: 'That message is longer than the form can send. Please shorten it, or reach us directly.',
  BACKEND_UNCONFIGURED: 'The form is not accepting inquiries at the moment. Please reach us directly.',
  NETWORK_ERROR: 'We could not reach the studio just now. Please check your connection, or reach us directly.',
  SERVER_ERROR: 'Something went wrong on our side. Please reach us directly and we will pick it up.',
};

function errorMessage(errorCode, retryAfterSeconds) {
  if (errorCode === 'RATE_LIMITED' && Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    const minutes = Math.ceil(retryAfterSeconds / 60);
    const wait = minutes > 1 ? `about ${minutes} minutes` : 'about a minute';
    return `Too many inquiries from this connection just now. Please wait ${wait}, or reach us directly.`;
  }
  return ERROR_COPY[errorCode] ?? ERROR_COPY.SERVER_ERROR;
}

const EMPTY_FORM = {
  name: '',
  email: '',
  phone: '',
  weddingDate: '',
  venue: '',
  services: ['Cinematic Film', 'Fine Art Photography'],
  message: '',
  website: '',
};

function FieldError({ id, message }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-2 text-xs font-semibold text-charcoal-700">
      {message}
    </p>
  );
}

export default function BookingForm() {
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [clientErrors, setClientErrors] = useState({});
  const {
    status, errorCode, fieldErrors, retryAfterSeconds, submit, reset,
  } = useInquirySubmission();
  // Destructured (rather than kept as one `turnstile` object) so the
  // eslint-plugin-react-hooks `refs` rule can tell which of these are the
  // ref and which are plain values — reading a non-ref field via dot
  // notation on an object that also carries a ref (e.g. `turnstile.error`)
  // is flagged as a ref access, same as `ScrollReveal` already destructures
  // `useScrollReveal()`'s `{ ref, isVisible }`.
  const {
    containerRef: turnstileContainerRef,
    token: turnstileToken,
    error: turnstileError,
    reset: resetTurnstile,
  } = useTurnstile(TURNSTILE_SITE_KEY);

  const errors = { ...clientErrors, ...fieldErrors };
  const isSending = status === 'pending';

  const handleServiceToggle = (service) => {
    setFormData((prev) => ({
      ...prev,
      services: prev.services.includes(service)
        ? prev.services.filter((s) => s !== service)
        : [...prev.services, service],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Same rules the Edge Function applies, from the same module, so an inline
    // message can never contradict what the server accepts.
    const { valid, fields } = validateInquiry(formData, {
      today: new Date().toISOString().slice(0, 10),
    });
    setClientErrors(fields);
    if (!valid) return;

    const stored = await submit({ ...formData, turnstileToken });

    // The token is single-use; Cloudflare rejects a replay either way.
    resetTurnstile();

    if (stored) {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#0a0a0a', '#262626', '#d5cfc2', '#ffffff'],
      });
    }
  };

  const startOver = () => {
    setFormData(EMPTY_FORM);
    setClientErrors({});
    reset();
  };

  return (
    <section id="contact" className="py-24 relative bg-offwhite-100 text-pitch-900 border-t border-pitch-900/10 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">

          {/* Left Column: Direct Info */}
          <ScrollReveal className="lg:col-span-5 space-y-8">
            <div className="inline-flex items-center space-x-2 text-pitch-900 text-xs uppercase tracking-[0.3em] font-semibold">
              <Calendar className="w-4 h-4" />
              <span>Reserve Your Wedding Date</span>
            </div>

            <h2 className="font-cinzel text-3xl sm:text-5xl font-bold tracking-tight leading-tight text-pitch-900">
              LET&apos;S CREATE YOUR <br />
              <span className="font-garamond italic font-normal">MASTERPIECE</span>
            </h2>

            <p className="font-garamond text-xl text-charcoal-700 italic font-light leading-relaxed">
              We take on a limited number of handpicked weddings each year to ensure uncompromising artistic quality. Tell us about your story.
            </p>

            <div className="space-y-6 pt-6 border-t border-pitch-900/10">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-full bg-offwhite-50 border border-pitch-900/15 flex items-center justify-center text-pitch-900 shadow-sm">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-charcoal-500 font-bold">Direct Concierge</div>
                  <div className="text-base font-bold text-pitch-900">{STUDIO_PHONE}</div>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-full bg-offwhite-50 border border-pitch-900/15 flex items-center justify-center text-pitch-900 shadow-sm">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-charcoal-500 font-bold">Email Studio</div>
                  <div className="text-base font-bold text-pitch-900">{STUDIO_EMAIL}</div>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-full bg-offwhite-50 border border-pitch-900/15 flex items-center justify-center text-pitch-900 shadow-sm">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-charcoal-500 font-bold">Studio Location</div>
                  <div className="text-sm font-semibold text-pitch-900">{STUDIO_ADDRESS}</div>
                </div>
              </div>

              <WhatsAppButton className="mt-2" />
            </div>
          </ScrollReveal>

          {/* Right Column: Inquiry Form */}
          <div className="lg:col-span-7">
            <ScrollReveal delay={200}>
              <div className="bg-white p-8 sm:p-10 rounded-3xl border border-pitch-900/15 shadow-xl">

                {status === 'success' ? (
                  <div className="text-center py-12 space-y-6 animate-fade-in">
                    <div className="w-20 h-20 rounded-full bg-offwhite-200 border-2 border-pitch-900 flex items-center justify-center mx-auto text-pitch-900">
                      <CheckCircle2 className="w-10 h-10" />
                    </div>
                    <h3 className="font-cinzel text-3xl font-bold text-pitch-900">
                      Inquiry Received!
                    </h3>
                    <p className="font-garamond text-xl text-charcoal-700 italic max-w-md mx-auto">
                      Thank you, <span className="text-pitch-900 font-bold">{formData.name}</span>. Our lead creative director will review your wedding details and reach out within 24 hours.
                    </p>
                    <button
                      onClick={startOver}
                      className="mt-6 px-8 py-3 rounded-full bg-pitch-900 text-offwhite-50 text-xs uppercase tracking-widest font-semibold hover:bg-pitch-800 transition-all shadow-md"
                    >
                      Submit Another Inquiry
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6 relative">

                    {/* Not visible to people. Anything typed here came from a bot. */}
                    <div className="absolute w-px h-px -m-px overflow-hidden" aria-hidden="true">
                      <input
                        type="text"
                        name="website"
                        tabIndex={-1}
                        autoComplete="off"
                        value={formData.website}
                        onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div>
                        <label htmlFor="inquiry-name" className="block text-xs uppercase tracking-widest text-pitch-900 mb-2 font-bold">
                          Couple / Contact Name *
                        </label>
                        <div className="relative">
                          <input
                            id="inquiry-name"
                            type="text"
                            placeholder="e.g. Ananya & Rohan"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            aria-invalid={Boolean(errors.name)}
                            aria-describedby={errors.name ? 'inquiry-name-error' : undefined}
                            className="w-full px-4 py-3.5 pl-11 rounded-xl bg-offwhite-100 border border-pitch-900/15 text-pitch-900 text-sm focus:outline-none focus:border-pitch-900"
                          />
                          <User className="w-4 h-4 text-charcoal-500 absolute left-4 top-1/2 -translate-y-1/2" />
                        </div>
                        <FieldError id="inquiry-name-error" message={errors.name} />
                      </div>

                      <div>
                        <label htmlFor="inquiry-email" className="block text-xs uppercase tracking-widest text-pitch-900 mb-2 font-bold">
                          Email Address *
                        </label>
                        <div className="relative">
                          <input
                            id="inquiry-email"
                            type="email"
                            placeholder="e.g. couple@example.com"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            aria-invalid={Boolean(errors.email)}
                            aria-describedby={errors.email ? 'inquiry-email-error' : undefined}
                            className="w-full px-4 py-3.5 pl-11 rounded-xl bg-offwhite-100 border border-pitch-900/15 text-pitch-900 text-sm focus:outline-none focus:border-pitch-900"
                          />
                          <Mail className="w-4 h-4 text-charcoal-500 absolute left-4 top-1/2 -translate-y-1/2" />
                        </div>
                        <FieldError id="inquiry-email-error" message={errors.email} />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div>
                        <label htmlFor="inquiry-phone" className="block text-xs uppercase tracking-widest text-pitch-900 mb-2 font-bold">
                          Phone Number *
                        </label>
                        <div className="relative">
                          <input
                            id="inquiry-phone"
                            type="tel"
                            placeholder="+91 98200 00000"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            aria-invalid={Boolean(errors.phone)}
                            aria-describedby={errors.phone ? 'inquiry-phone-error' : undefined}
                            className="w-full px-4 py-3.5 pl-11 rounded-xl bg-offwhite-100 border border-pitch-900/15 text-pitch-900 text-sm focus:outline-none focus:border-pitch-900"
                          />
                          <Phone className="w-4 h-4 text-charcoal-500 absolute left-4 top-1/2 -translate-y-1/2" />
                        </div>
                        <FieldError id="inquiry-phone-error" message={errors.phone} />
                      </div>

                      <div>
                        <label htmlFor="inquiry-date" className="block text-xs uppercase tracking-widest text-pitch-900 mb-2 font-bold">
                          Wedding Date *
                        </label>
                        <div className="relative">
                          <input
                            id="inquiry-date"
                            type="date"
                            value={formData.weddingDate}
                            onChange={(e) => setFormData({ ...formData, weddingDate: e.target.value })}
                            aria-invalid={Boolean(errors.weddingDate)}
                            aria-describedby={errors.weddingDate ? 'inquiry-date-error' : undefined}
                            className="w-full px-4 py-3.5 pl-11 rounded-xl bg-offwhite-100 border border-pitch-900/15 text-pitch-900 text-sm focus:outline-none focus:border-pitch-900"
                          />
                          <Calendar className="w-4 h-4 text-charcoal-500 absolute left-4 top-1/2 -translate-y-1/2" />
                        </div>
                        <FieldError id="inquiry-date-error" message={errors.weddingDate} />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="inquiry-venue" className="block text-xs uppercase tracking-widest text-pitch-900 mb-2 font-bold">
                        Event Location / Venue *
                      </label>
                      <div className="relative">
                        <input
                          id="inquiry-venue"
                          type="text"
                          placeholder="e.g. Umaid Bhawan Palace, Jodhpur / Lake Como, Italy"
                          value={formData.venue}
                          onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                          aria-invalid={Boolean(errors.venue)}
                          aria-describedby={errors.venue ? 'inquiry-venue-error' : undefined}
                          className="w-full px-4 py-3.5 pl-11 rounded-xl bg-offwhite-100 border border-pitch-900/15 text-pitch-900 text-sm focus:outline-none focus:border-pitch-900"
                        />
                        <MapPin className="w-4 h-4 text-charcoal-500 absolute left-4 top-1/2 -translate-y-1/2" />
                      </div>
                      <FieldError id="inquiry-venue-error" message={errors.venue} />
                    </div>

                    {/* Services Needed */}
                    <div>
                      <label className="block text-xs uppercase tracking-widest text-pitch-900 mb-3 font-bold">
                        Services Requested
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        {SERVICES.map((service) => {
                          const isSelected = formData.services.includes(service);
                          return (
                            <button
                              type="button"
                              key={service}
                              onClick={() => handleServiceToggle(service)}
                              className={`p-3 rounded-xl border text-xs font-bold uppercase tracking-wider text-left transition-all ${
                                isSelected
                                  ? 'bg-pitch-900 border-pitch-900 text-offwhite-50'
                                  : 'bg-offwhite-100 border-pitch-900/10 text-pitch-900 hover:border-pitch-900/30'
                              }`}
                            >
                              {isSelected ? '✓ ' : '+ '} {service}
                            </button>
                          );
                        })}
                      </div>
                      <FieldError id="inquiry-services-error" message={errors.services} />
                    </div>

                    <div>
                      <label htmlFor="inquiry-message" className="block text-xs uppercase tracking-widest text-pitch-900 mb-2 font-bold">
                        Share Your Story & Vision
                      </label>
                      <textarea
                        id="inquiry-message"
                        rows="4"
                        placeholder="Tell us about your wedding events, themes, or custom preferences..."
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        aria-invalid={Boolean(errors.message)}
                        aria-describedby={errors.message ? 'inquiry-message-error' : undefined}
                        className="w-full px-4 py-3.5 rounded-xl bg-offwhite-100 border border-pitch-900/15 text-pitch-900 text-sm focus:outline-none focus:border-pitch-900"
                      ></textarea>
                      <FieldError id="inquiry-message-error" message={errors.message} />
                    </div>

                    {isInquiryBackendConfigured && (
                      <div>
                        <div ref={turnstileContainerRef} />
                        {turnstileError && (
                          <p role="alert" className="mt-2 text-xs font-semibold text-charcoal-700">
                            {turnstileError}
                          </p>
                        )}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isSending}
                      className="w-full py-4 rounded-xl bg-pitch-900 text-offwhite-50 font-extrabold uppercase tracking-[0.25em] text-xs hover:bg-pitch-800 hover:shadow-xl hover:scale-[1.01] transition-all flex items-center justify-center space-x-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
                    >
                      {isSending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Sending…</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          <span>Send Booking Inquiry</span>
                        </>
                      )}
                    </button>

                    {status === 'error' && (
                      <div role="alert" className="rounded-xl border border-pitch-900/20 bg-offwhite-100 p-5 space-y-4">
                        <div className="flex items-start space-x-3">
                          <AlertTriangle className="w-5 h-5 text-pitch-900 shrink-0 mt-0.5" />
                          <p className="text-sm text-pitch-900">
                            {errorMessage(errorCode, retryAfterSeconds)}
                          </p>
                        </div>
                        <p className="text-sm text-charcoal-700">
                          Email us at{' '}
                          <a href={`mailto:${STUDIO_EMAIL}`} className="font-bold text-pitch-900 underline">
                            {STUDIO_EMAIL}
                          </a>{' '}
                          and we will reply to your inquiry directly.
                        </p>
                        <WhatsAppButton />
                      </div>
                    )}

                  </form>
                )}

              </div>
            </ScrollReveal>
          </div>

        </div>

      </div>
    </section>
  );
}
