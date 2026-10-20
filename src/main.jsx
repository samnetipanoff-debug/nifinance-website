import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import './style.css';
import Universe from './Universe.jsx';
import Universe2 from './Universe2.jsx';
import Universe3 from './Universe3.jsx';

function WorldEngine() {
  const host = useRef(null);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer, scene, camera, frame, core, ringA, ringB, particles;
    let pointerX = 0, pointerY = 0, targetX = 0, targetY = 0;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    try {
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(36, el.clientWidth / Math.max(el.clientHeight, 1), 0.1, 100);
      camera.position.set(0, 0, 8.8);
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
      renderer.setSize(el.clientWidth, el.clientHeight);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      el.appendChild(renderer.domElement);

      const ambient = new THREE.AmbientLight(0xffffff, 1.5);
      scene.add(ambient);
      const key = new THREE.PointLight(0xc9ff45, 18, 20);
      key.position.set(3, 2, 5);
      scene.add(key);
      const rim = new THREE.PointLight(0x4c7aff, 13, 18);
      rim.position.set(-4, -2, -1);
      scene.add(rim);

      core = new THREE.Group();
      scene.add(core);
      // Pointillist Earth: thousands of independent points form recognizable continents.
      // No surface mesh, no connecting network lines, and no atmospheric glow.
      const landShapes = [
        [[-168,72],[-140,70],[-125,55],[-130,48],[-117,32],[-105,20],[-82,8],[-60,15],[-50,48],[-65,60],[-95,72],[-130,75]],
        [[-82,12],[-70,8],[-50,-5],[-35,-20],[-48,-55],[-68,-42],[-78,-15]],
        [[-52,82],[-20,78],[-24,60],[-45,58],[-58,68]],
        [[-10,72],[30,72],[60,58],[90,72],[130,58],[160,60],[178,48],[145,35],[120,20],[105,5],[80,8],[65,25],[45,12],[35,-5],[15,-35],[-5,-35],[-18,-5],[-10,25],[-25,38],[-15,55]],
        [[-18,35],[10,37],[35,20],[50,5],[40,-35],[18,-35],[0,-25],[-15,0],[-20,20]],
        [[112,-11],[155,-10],[153,-40],[130,-45],[113,-30]],
        [[45,-13],[51,-13],[50,-25],[44,-24]],
        [[130,32],[145,45],[146,35],[137,30]],
        [[-8,58],[2,59],[0,50],[-7,50]],
        [[-180,-70],[-120,-72],[-60,-75],[0,-72],[60,-74],[120,-72],[180,-70],[180,-88],[-180,-88]]
      ];
      const insidePolygon = (lon, lat, polygon) => {
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
          const [xi, yi] = polygon[i];
          const [xj, yj] = polygon[j];
          const crosses = ((yi > lat) !== (yj > lat)) &&
            (lon < (xj - xi) * (lat - yi) / ((yj - yi) || 1e-6) + xi);
          if (crosses) inside = !inside;
        }
        return inside;
      };
      const globeDots = [];
      const oceanDots = [];
      const dotCount = 6800;
      for (let i = 0; i < dotCount; i++) {
        const lat = Math.asin(2 * Math.random() - 1) * 180 / Math.PI;
        const lon = Math.random() * 360 - 180;
        const latRad = lat * Math.PI / 180;
        const lonRad = lon * Math.PI / 180;
        const radius = 1.73;
        const point = [
          radius * Math.cos(latRad) * Math.sin(lonRad),
          radius * Math.sin(latRad),
          radius * Math.cos(latRad) * Math.cos(lonRad)
        ];
        const onLand = landShapes.some(shape => insidePolygon(lon, lat, shape));
        if (onLand) globeDots.push(...point);
        else if (Math.random() < 0.075) oceanDots.push(...point);
      }
      const landGeometry = new THREE.BufferGeometry();
      landGeometry.setAttribute('position', new THREE.Float32BufferAttribute(globeDots, 3));
      const land = new THREE.Points(landGeometry, new THREE.PointsMaterial({
        color: 0xc9ff45, size: 0.027, transparent: true, opacity: 0.92,
        sizeAttenuation: true, depthWrite: false
      }));
      core.add(land);
      const oceanGeometry = new THREE.BufferGeometry();
      oceanGeometry.setAttribute('position', new THREE.Float32BufferAttribute(oceanDots, 3));
      particles = new THREE.Points(oceanGeometry, new THREE.PointsMaterial({
        color: 0x8a9b82, size: 0.012, transparent: true, opacity: 0.26,
        sizeAttenuation: true, depthWrite: false
      }));
      core.add(particles);

      ringA = new THREE.Mesh(new THREE.TorusGeometry(2.22, 0.012, 8, 180), new THREE.MeshBasicMaterial({ color: 0xc9ff45, transparent: true, opacity: 0.75 }));
      ringA.rotation.set(0.82, 0.18, -0.42);
      core.add(ringA);
      ringB = new THREE.Mesh(new THREE.TorusGeometry(2.55, 0.006, 6, 180), new THREE.MeshBasicMaterial({ color: 0x7391ff, transparent: true, opacity: 0.58 }));
      ringB.rotation.set(1.25, -0.7, 0.2);
      core.add(ringB);

      const orbitDot = new THREE.Mesh(new THREE.SphereGeometry(0.075, 18, 18), new THREE.MeshBasicMaterial({ color: 0xc9ff45 }));
      orbitDot.position.set(2.22, 0, 0);
      ringA.add(orbitDot);

      const resize = () => {
        if (!renderer || !el.clientWidth || !el.clientHeight) return;
        camera.aspect = el.clientWidth / el.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(el.clientWidth, el.clientHeight);
      };
      const move = (e) => {
        const r = el.getBoundingClientRect();
        targetX = ((e.clientX - r.left) / r.width - 0.5) * 0.6;
        targetY = ((e.clientY - r.top) / r.height - 0.5) * 0.45;
      };
      el.addEventListener('pointermove', move);
      window.addEventListener('resize', resize);
      const clock = new THREE.Clock();
      const animate = () => {
        frame = requestAnimationFrame(animate);
        const t = clock.getElapsedTime();
        pointerX += (targetX - pointerX) * 0.035;
        pointerY += (targetY - pointerY) * 0.035;
        if (!reduced) {
          core.rotation.y = t * 0.085 + pointerX;
          core.rotation.x = Math.sin(t * 0.17) * 0.08 + pointerY;
          ringA.rotation.z += 0.0018;
          ringB.rotation.x += 0.0007;
          particles.rotation.y = -t * 0.025;
        } else {
          core.rotation.y = 0.3;
        }
        renderer.render(scene, camera);
      };
      animate();
      return () => {
        cancelAnimationFrame(frame);
        window.removeEventListener('resize', resize);
        el.removeEventListener('pointermove', move);
        scene.traverse(o => {
          if (o.geometry) o.geometry.dispose();
          if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
        });
        renderer.dispose();
        if (renderer.domElement.parentNode === el) el.removeChild(renderer.domElement);
      };
    } catch (e) {
      console.warn('3D scene could not initialize', e);
      if (renderer) renderer.dispose();
    }
  }, []);
  return <div className="world-engine" ref={host} aria-label="Animated three-dimensional global network" role="img">
    <div className="engine-fallback"><div className="fallback-orb"><span /></div></div>
    <div className="engine-caption"><span className="live-dot" /> GLOBAL SYSTEM / 01</div>
  </div>;
}

const services = [
  { n: '01', title: 'Market intelligence', desc: 'Find where your offer has a real reason to win. We map demand, competitors, price architecture and the path to your first customers.', tags: 'RESEARCH · POSITIONING' },
  { n: '02', title: 'Go-to-market strategy', desc: 'Turn an international ambition into a sequence of decisions, experiments and measurable commercial milestones.', tags: 'STRATEGY · EXECUTION' },
  { n: '03', title: 'Commercial launch', desc: 'Build the practical route from first conversation to first revenue: partners, channels, sales process and local adaptation.', tags: 'PARTNERS · REVENUE' },
  { n: '04', title: 'Operating model', desc: 'Create the financial and operational logic behind expansion, from unit economics and pricing to management reporting.', tags: 'FINANCE · OPERATIONS' }
];

function useOrbitalScroll() {
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll('[data-fly]:not([data-fly="hero"])'));
    if (!nodes.length) return;
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    nodes.forEach((el, i) => {
      const seed = (i * 37 + 13) % 100;
      const direction = i % 2 === 0 ? 1 : -1;
      const serviceRow = el.classList.contains('service-row');
      const x = serviceRow ? direction * (18 + seed % 18) : (seed % 2 ? 1 : -1) * (42 + seed * 0.65);
      const y = serviceRow ? direction * (8 + seed % 10) : direction * (28 + (seed % 43) * 0.65);
      const rot = serviceRow ? direction * (0.5 + (seed % 8) / 10) : direction * (1.5 + seed % 4);
      const scale = serviceRow ? 0.99 : 0.965 + (seed % 4) / 100;
      el.style.setProperty('--fly-x', x.toFixed(1) + 'px');
      el.style.setProperty('--fly-y', y.toFixed(1) + 'px');
      el.style.setProperty('--fly-rot', rot.toFixed(2) + 'deg');
      el.style.setProperty('--fly-scale', scale.toFixed(3));
    });

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      nodes.forEach(el => el.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.04 });

    nodes.forEach(el => observer.observe(el));
    return () => {
      observer.disconnect();
      nodes.forEach(el => {
        el.classList.remove('is-visible');
        ['--fly-x', '--fly-y', '--fly-rot', '--fly-scale'].forEach(prop => el.style.removeProperty(prop));
      });
    };
  }, []);
}

function App() {
  useOrbitalScroll();
  const [menuOpen, setMenuOpen] = useState(false);
  const [formState, setFormState] = useState({ name: '', email: '', company: '', market: '', challenge: '' });
  const [sent, setSent] = useState(false);
  const update = (e) => setFormState(s => ({ ...s, [e.target.name]: e.target.value }));
  const submit = (e) => {
    e.preventDefault();
    const message =
      'NIFINANCE SOLUTION — international expansion\n\n' +
      'Name: ' + formState.name + '\nEmail: ' + formState.email + '\nCompany: ' + formState.company +
      '\nTarget market: ' + formState.market + '\nChallenge: ' + formState.challenge;
    window.location.href = 'https://t.me/nifinance_solution?text=' + encodeURIComponent(message);
    setSent(true);
  };
  return <main>
    <div className="grain" aria-hidden="true" />
    <header className="nav">
      <a className="brand" href="#top" aria-label="NIFINANCE SOLUTION home"><span className="brand-mark"><i /><i /><i /></span><span>NIFINANCE<span className="brand-light"> SOLUTION</span></span></a>
      <nav className={menuOpen ? 'nav-links open' : 'nav-links'}>
        <a href="#approach" onClick={() => setMenuOpen(false)}>Approach</a>
        <a href="#capabilities" onClick={() => setMenuOpen(false)}>Capabilities</a>
        <a href="#perspective" onClick={() => setMenuOpen(false)}>Perspective</a>
      </nav>
      <a className="nav-cta" href="#contact">Start a conversation <span>↗︎</span></a>
      <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation"><span /><span /></button>
    </header>

    <section className="hero" id="top">
      <div className="hero-grid" aria-hidden="true" />
      <div className="hero-copy">
        <div className="eyebrow" data-fly="hero"><span className="live-dot" /> STRATEGY FOR A BORDERLESS ECONOMY</div>
        <h1 data-fly="hero">GROW<br /><span>BEYOND</span><br />BORDERS<span className="period">.</span></h1>
        <div className="hero-bottom">
          <p className="hero-intro" data-fly="hero">We help ambitious businesses turn international expansion into a clear, commercially grounded move.</p>
          <a className="round-link" data-fly="hero" href="#approach" aria-label="Discover our approach"><span>↓︎</span></a>
        </div>
      </div>
      <WorldEngine />
      <div className="hero-index"><span>01 / 04</span><span>INDEPENDENT STRATEGY & EXECUTION</span></div>
      <div className="hero-side-note">NEW MARKETS.<br />NEW ADVANTAGE.</div>
    </section>

    <div className="ticker" aria-label="Our principles"><div className="ticker-track">{Array.from({ length: 4 }).map((_, i) => <span key={i}>CLARITY BEFORE SCALE <b>✳︎</b> LOCAL KNOWLEDGE, GLOBAL THINKING <b>✳︎</b> STRATEGY THAT MOVES <b>✳︎</b></span>)}</div></div>

    <section className="manifesto section-pad" id="approach">
      <div className="section-kicker"><span>01 — THE POINT OF VIEW</span><span>THINK WIDER. MOVE SMARTER.</span></div>
      <div className="manifesto-layout">
        <h2 data-fly>Expansion is not<br />a destination.<br /><em>It's a new system.</em></h2>
        <div className="manifesto-aside" data-fly>
          <div className="asterisk">✳︎</div>
          <p>Going international is more than entering a new country. It's rethinking how you find demand, create trust, build partnerships and make the numbers work.</p>
          <p className="muted">We connect the big picture with the details that decide whether a market move becomes a business result.</p>
          <a className="text-link" href="#capabilities">Explore our capabilities <span>↗︎</span></a>
        </div>
      </div>
      <div className="manifesto-rule"><span>FROM AMBITION</span><div /><span>TO COMMERCIAL MOMENTUM</span></div>
    </section>

    <section className="capabilities section-pad" id="capabilities">
      <div className="section-kicker"><span>02 — WHAT WE DO</span><span>BUILT AROUND YOUR NEXT MOVE</span></div>
      <div className="cap-head"><h2 data-fly>Make the next<br /><em>move count.</em></h2><p data-fly>Focused expertise for businesses ready to grow across markets, not just across borders.</p></div>
      <div className="service-list">{services.map(s => <article className="service-row" data-fly key={s.n}>
        <span className="service-num">{s.n}</span><h3>{s.title}</h3><p>{s.desc}</p><div className="service-tags">{s.tags}</div><span className="service-arrow">↗︎</span>
      </article>)}</div>
    </section>

    <section className="perspective" id="perspective">
      <div className="perspective-visual" data-fly><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit orbit-three" /><div className="crosshair cross-a" /><div className="crosshair cross-b" /><div className="perspective-center"><span>MARKET</span><strong>≠</strong><span>MAP</span></div><div className="coordinate coord-one">44°49' N<br />20°27' E</div><div className="coordinate coord-two">51°30' N<br />00°07' W</div><div className="coordinate coord-three">25°12' N<br />55°16' E</div></div>
      <div className="perspective-copy" data-fly><div className="section-kicker"><span>03 — OUR LENS</span></div><h2>Local context.<br /><em>Global intent.</em></h2><p>Every market has its own rules, rhythms and unwritten codes. We help you see beyond the obvious, test what matters and adapt your model without losing what makes your business valuable.</p><div className="perspective-stat"><span className="stat-mark">↗︎</span><div><strong>Think in systems.</strong><small>Not isolated tactics. Build an expansion model that can learn, adapt and scale.</small></div></div></div>
    </section>

    <section className="method section-pad">
      <div className="section-kicker"><span>04 — HOW WE WORK</span><span>NO THEATRE. REAL PROGRESS.</span></div>
      <h2 data-fly>From first question<br />to <em>next chapter.</em></h2>
      <div className="method-steps">
        <div className="method-step" data-fly><span>01 / DISCOVER</span><div className="step-line"><i /></div><h3>Understand</h3><p>Clarify the ambition, constraints and economics behind the move.</p></div>
        <div className="method-step" data-fly><span>02 / DECIDE</span><div className="step-line"><i /></div><h3>Focus</h3><p>Identify the right market, the strongest entry path and the assumptions to test.</p></div>
        <div className="method-step" data-fly><span>03 / BUILD</span><div className="step-line"><i /></div><h3>Activate</h3><p>Translate strategy into action, owners, milestones and measurable outcomes.</p></div>
      </div>
    </section>

    <section className="contact section-pad" id="contact">
      <div className="contact-top" data-fly><div className="section-kicker"><span>05 — THE NEXT MOVE</span><span>LET'S MAKE IT REAL</span></div><h2>Your next market<br />is a <em>conversation</em><span className="period">.</span></h2></div>
      <div className="contact-layout"><div className="contact-aside" data-fly><p>Tell us what you're building, where you want to go and what's standing in the way. We'll start with the right questions.</p><div className="contact-email"><span>DIRECT CONTACT ON TELEGRAM</span><a href="https://t.me/nifinance_solution" target="_blank" rel="noreferrer">@nifinance_solution ↗︎</a></div><div className="contact-note"><span className="live-dot" /> SELECTIVE BY DESIGN. FOCUSED ON IMPACT.</div></div>
        <form className="contact-form" data-fly onSubmit={submit}>
          <div className="form-grid"><label>Your name<input name="name" value={formState.name} onChange={update} placeholder="How should we address you?" required /></label><label>Work email<input type="email" name="email" value={formState.email} onChange={update} placeholder="you@company.com" required /></label></div>
          <label>Company<input name="company" value={formState.company} onChange={update} placeholder="Company name" /></label>
          <label>Target market<input name="market" value={formState.market} onChange={update} placeholder="Where are you looking to grow?" /></label>
          <label>What's the opportunity or challenge?<textarea name="challenge" value={formState.challenge} onChange={update} placeholder="A few lines are enough to start..." rows="3" /></label>
          <div className="form-submit"><p>By submitting, you agree to be contacted about your enquiry.</p><button type="submit">{sent ? 'Open Telegram again' : 'Continue in Telegram'} <span>↗︎</span></button></div>
        </form>
      </div>
    </section>

    <footer className="footer"><a className="brand" href="#top"><span className="brand-mark"><i /><i /><i /></span><span>NIFINANCE<span className="brand-light"> SOLUTION</span></span></a><span className="footer-line">BUSINESS BEYOND BORDERS.</span><a href="#top" className="back-top">BACK TO TOP ↑︎</a><span className="copyright">© {new Date().getFullYear()} NIFINANCE SOLUTION</span></footer>
  </main>;
}

const isUniverse3Route = /^\/universe-3\/?$/.test(window.location.pathname);
const isUniverse2Route = /^\/universe-2\/?$/.test(window.location.pathname);
const isUniverseRoute = /^\/universe\/?$/.test(window.location.pathname);
const RootView = isUniverse3Route ? Universe3 : isUniverse2Route ? Universe2 : isUniverseRoute ? Universe : App;
createRoot(document.getElementById('root')).render(<RootView />);
