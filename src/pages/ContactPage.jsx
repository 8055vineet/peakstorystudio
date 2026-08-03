import React from 'react';
import PageHeader from '../components/PageHeader';
import BookingForm from '../components/BookingForm';

// BookingForm's own left column already carries the studio's phone, email,
// address, and WhatsApp button, so this page adds no second contact block —
// just the title over the verified, untouched inquiry pipeline.
export default function ContactPage() {
  return (
    <div data-testid="contact-page">
      <PageHeader title="Contact" />
      <BookingForm />
    </div>
  );
}
