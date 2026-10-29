import React from 'react';

/**
 * Universe 4 intentionally hosts the approved standalone Business Universe experience.
 * Its canvas renderer, node model, relationship graph, navigation and responsive UI
 * live together in public/universe-4-experience.html so the reference implementation
 * is preserved as-is; only its color palette was harmonized with the NIFINANCE site.
 */
export default function Universe4() {
  return (
    <iframe
      title="NIFINANCE Business Universe"
      src="/universe-4-experience.html"
      aria-label="Interactive Business Universe"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        minHeight: '100dvh',
        border: 0,
        display: 'block',
        background: '#050805',
        zIndex: 9999,
      }}
    />
  );
}
