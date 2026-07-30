import React from 'react';
import { useScrollReveal } from '../hooks/useScrollReveal';

export default function ScrollReveal({ children, delay = 0, direction = 'up', className = '' }) {
  const { ref, isVisible } = useScrollReveal();

  let transformClass = 'translate-y-6';
  if (direction === 'left') transformClass = '-translate-x-6';
  if (direction === 'right') transformClass = 'translate-x-6';

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-1000 ease-out ${
        isVisible ? 'opacity-100 translate-y-0 translate-x-0' : `opacity-0 ${transformClass}`
      } ${className}`}
    >
      {children}
    </div>
  );
}
