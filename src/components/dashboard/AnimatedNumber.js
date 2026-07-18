'use client';

import { useEffect, useState, useRef } from 'react';

export default function AnimatedNumber({ value, prefix = '', suffix = '', decimals = 0, duration = 2500 }) {
  // If value is a string with formatting (like "Ksh 50,000" or "50%"), 
  // extract the raw number for animation. We handle formatting mostly via prefix/suffix or toLocaleString.
  
  const [displayValue, setDisplayValue] = useState(0);
  const elementRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  // Strip non-numeric chars except decimals to get target number
  const targetValue = typeof value === 'number' ? value : Number(String(value).replace(/[^0-9.-]+/g, ""));

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsVisible(true);
          observer.disconnect(); // Only animate once when scrolled into view
        }
      },
      { threshold: 0.1 }
    );

    if (elementRef.current) {
      observer.observe(elementRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    if (isNaN(targetValue) || targetValue === 0) {
      setDisplayValue(targetValue);
      return;
    }

    let startTimestamp = null;
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      
      // Easing function: easeOutQuart (starts fast, slows down at the end)
      const easeProgress = 1 - Math.pow(1 - progress, 4);
      
      setDisplayValue(targetValue * easeProgress);

      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        setDisplayValue(targetValue); // Ensure it ends exactly on the target
      }
    };

    window.requestAnimationFrame(step);
  }, [targetValue, duration, isVisible]);

  // Format the display value
  const formattedValue = displayValue.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });

  return (
    <span ref={elementRef} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {prefix}{formattedValue}{suffix}
    </span>
  );
}
