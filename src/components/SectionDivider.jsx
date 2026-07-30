import React from 'react';

export default function SectionDivider({ flip = false, color = '#faf9f6', bgColor = '#ffffff' }) {
  return (
    <div
      className="section-wave relative overflow-hidden"
      style={{
        backgroundColor: bgColor,
        transform: flip ? 'scaleY(-1)' : 'none',
      }}
    >
      <svg
        viewBox="0 0 1440 60"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        className="w-full h-auto"
        style={{ display: 'block' }}
      >
        <path
          d="M0 30C240 50 480 10 720 30C960 50 1200 10 1440 30V60H0V30Z"
          fill={color}
        />
      </svg>
    </div>
  );
}
