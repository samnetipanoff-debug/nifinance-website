import React from 'react';

const NAV_ITEMS = [
  { href: '/', label: 'HOME', match: p => p === '/' },
  { href: '/universe-4', label: 'UNIVERSE', match: p => /^\/universe-4\/?$/.test(p) },
  { href: '/data-center', label: 'DATA CENTER', match: p => /^\/data-center\/?$/.test(p) },
  { href: '/business-hub', label: 'CRM / HUB', match: p => /^\/business-hub\/?$/.test(p) },
  { href: '/universe-core', label: 'CORE', match: p => /^\/universe-core\/?$/.test(p) }
];

export default function AppNavigation() {
  const path = window.location.pathname;
  return <nav className={"app-navigation" + (path.startsWith("/data-center") ? " app-navigation--data-center" : "")} aria-label="NIFINANCE workspace navigation">
    {NAV_ITEMS.map(item => <a key={item.href} className={item.match(path) ? 'active' : ''} href={item.href}>{item.label}</a>)}
  </nav>;
}
