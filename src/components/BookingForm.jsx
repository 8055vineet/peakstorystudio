import React, { useState } from 'react';
import { Calendar, MapPin, Send, CheckCircle2, Phone, Mail, User } from 'lucide-react';
import ScrollReveal from './ScrollReveal';
import confetti from 'canvas-confetti';

export default function BookingForm() {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    date: '',
    location: '',
    guests: '100-300',
    services: ['Cinematic Film', 'Fine Art Photography'],
    message: ''
  });

  const handleServiceToggle = (service) => {
    setFormData(prev => {
      const exists = prev.services.includes(service);
      return {
        ...prev,
        services: exists
          ? prev.services.filter(s => s !== service)
          : [...prev.services, service]
      };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);

    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.6 },
      colors: ['#0a0a0a', '#262626', '#d5cfc2', '#ffffff']
    });
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
              LET'S CREATE YOUR <br />
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
                  <div className="text-base font-bold text-pitch-900">+91 98200 37027</div>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-full bg-offwhite-50 border border-pitch-900/15 flex items-center justify-center text-pitch-900 shadow-sm">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-charcoal-500 font-bold">Email Studio</div>
                  <div className="text-base font-bold text-pitch-900">inquiries@peakstorystudio.com</div>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-full bg-offwhite-50 border border-pitch-900/15 flex items-center justify-center text-pitch-900 shadow-sm">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-charcoal-500 font-bold">Studio Location</div>
                  <div className="text-sm font-semibold text-pitch-900">241 Laxmi Plaza, Andheri (W), Mumbai, India</div>
                </div>
              </div>
            </div>
          </ScrollReveal>

          {/* Right Column: Inquiry Form */}
          <div className="lg:col-span-7">
            <ScrollReveal delay={200}>
              <div className="bg-white p-8 sm:p-10 rounded-3xl border border-pitch-900/15 shadow-xl">
                
                {submitted ? (
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
                      onClick={() => setSubmitted(false)}
                      className="mt-6 px-8 py-3 rounded-full bg-pitch-900 text-offwhite-50 text-xs uppercase tracking-widest font-semibold hover:bg-pitch-800 transition-all shadow-md"
                    >
                      Submit Another Inquiry
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-xs uppercase tracking-widest text-pitch-900 mb-2 font-bold">
                          Couple / Contact Name *
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            required
                            placeholder="e.g. Ananya & Rohan"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-4 py-3.5 pl-11 rounded-xl bg-offwhite-100 border border-pitch-900/15 text-pitch-900 text-sm focus:outline-none focus:border-pitch-900"
                          />
                          <User className="w-4 h-4 text-charcoal-500 absolute left-4 top-1/2 -translate-y-1/2" />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs uppercase tracking-widest text-pitch-900 mb-2 font-bold">
                          Email Address *
                        </label>
                        <div className="relative">
                          <input
                            type="email"
                            required
                            placeholder="e.g. couple@example.com"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="w-full px-4 py-3.5 pl-11 rounded-xl bg-offwhite-100 border border-pitch-900/15 text-pitch-900 text-sm focus:outline-none focus:border-pitch-900"
                          />
                          <Mail className="w-4 h-4 text-charcoal-500 absolute left-4 top-1/2 -translate-y-1/2" />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-xs uppercase tracking-widest text-pitch-900 mb-2 font-bold">
                          Phone Number *
                        </label>
                        <div className="relative">
                          <input
                            type="tel"
                            required
                            placeholder="+91 98200 00000"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            className="w-full px-4 py-3.5 pl-11 rounded-xl bg-offwhite-100 border border-pitch-900/15 text-pitch-900 text-sm focus:outline-none focus:border-pitch-900"
                          />
                          <Phone className="w-4 h-4 text-charcoal-500 absolute left-4 top-1/2 -translate-y-1/2" />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs uppercase tracking-widest text-pitch-900 mb-2 font-bold">
                          Wedding Date *
                        </label>
                        <div className="relative">
                          <input
                            type="date"
                            required
                            value={formData.date}
                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                            className="w-full px-4 py-3.5 pl-11 rounded-xl bg-offwhite-100 border border-pitch-900/15 text-pitch-900 text-sm focus:outline-none focus:border-pitch-900"
                          />
                          <Calendar className="w-4 h-4 text-charcoal-500 absolute left-4 top-1/2 -translate-y-1/2" />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs uppercase tracking-widest text-pitch-900 mb-2 font-bold">
                        Event Location / Venue *
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          placeholder="e.g. Umaid Bhawan Palace, Jodhpur / Lake Como, Italy"
                          value={formData.location}
                          onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                          className="w-full px-4 py-3.5 pl-11 rounded-xl bg-offwhite-100 border border-pitch-900/15 text-pitch-900 text-sm focus:outline-none focus:border-pitch-900"
                        />
                        <MapPin className="w-4 h-4 text-charcoal-500 absolute left-4 top-1/2 -translate-y-1/2" />
                      </div>
                    </div>

                    {/* Services Needed */}
                    <div>
                      <label className="block text-xs uppercase tracking-widest text-pitch-900 mb-3 font-bold">
                        Services Requested
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        {['Cinematic Film', 'Fine Art Photography', 'Drone Aerials', 'Pre-Wedding Shoot'].map((service) => {
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
                    </div>

                    <div>
                      <label className="block text-xs uppercase tracking-widest text-pitch-900 mb-2 font-bold">
                        Share Your Story & Vision
                      </label>
                      <textarea
                        rows="4"
                        placeholder="Tell us about your wedding events, themes, or custom preferences..."
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        className="w-full px-4 py-3.5 rounded-xl bg-offwhite-100 border border-pitch-900/15 text-pitch-900 text-sm focus:outline-none focus:border-pitch-900"
                      ></textarea>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-4 rounded-xl bg-pitch-900 text-offwhite-50 font-extrabold uppercase tracking-[0.25em] text-xs hover:bg-pitch-800 hover:shadow-xl hover:scale-[1.01] transition-all flex items-center justify-center space-x-2"
                    >
                      <Send className="w-4 h-4" />
                      <span>Send Booking Inquiry</span>
                    </button>

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
