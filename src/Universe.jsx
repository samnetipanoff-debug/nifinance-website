import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import './universe.css';

const areas = [
  { id: 'core', label: 'Business Core', short: 'CORE', color: '#d7ff62', metric: 'EBITDA', value: '€248.6k', change: '+12.8%', detail: 'Operating profit is ahead of plan. Margin expansion is being driven by stronger sales mix and lower fulfilment cost.' },
  { id: 'marketing', label: 'Marketing', short: 'MKT', color: '#9dff8c', metric: 'ROAS', value: '4.82×', change: '+8.4%', detail: 'Paid acquisition is efficient. Two campaigns are scaling well; one channel is approaching its cost ceiling.' },
  { id: 'sales', label: 'Sales', short: 'SALES', color: '#71dfff', metric: 'Pipeline', value: '€1.42m', change: '+16.2%', detail: 'Pipeline coverage is healthy. Conversion between qualified opportunity and proposal is the current constraint.' },
  { id: 'operations', label: 'Operations', short: 'OPS', color: '#c1a2ff', metric: 'Capacity', value: '86.4%', change: '+3.1%', detail: 'Capacity is balanced, with a potential bottleneck emerging in fulfilment over the next 12 days.' },
  { id: 'people', label: 'People', short: 'PEOPLE', color: '#ffbf76', metric: 'Delivery score', value: '92.1', change: '+2.6%', detail: 'Delivery reliability is improving. Two teams have a growing workload that may affect next month’s cycle time.' },
  { id: 'finance', label: 'Finance', short: 'FIN', color: '#f5f4eb', metric: 'Cash runway', value: '8.6 mo', change: '+0.7 mo', detail: 'Cash position is stable in this demo. Forecast sensitivity is highest around receivables and inventory timing.' }
];

const money = (n) => '€' + n.toLocaleString('en-US');

function UniverseScene({ selected, onSelect }) {
  const host = useRef(null);
  const selectedRef = useRef(selected);
  const selectRef = useRef(onSelect);
  useEffect(() => { selectedRef.current = selected; }, [selected]);
  useEffect(() => { selectRef.current = onSelect; }, [onSelect]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer, scene, camera, frame, world, rings, raycaster, pointer;
    const nodeMeshes = [];
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let pointerX = 0, pointerY = 0, targetX = 0, targetY = 0;
    try {
      scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x070a08, 0.035);
      camera = new THREE.PerspectiveCamera(40, el.clientWidth / Math.max(el.clientHeight, 1), 0.1, 100);
      camera.position.set(0, 1.6, 12.8);
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
      renderer.setSize(el.clientWidth, el.clientHeight);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;
      el.appendChild(renderer.domElement);

      scene.add(new THREE.AmbientLight(0xc9d9b7, 1.3));
      const key = new THREE.PointLight(0xc9ff62, 30, 30);
      key.position.set(3, 5, 5);
      scene.add(key);
      const cool = new THREE.PointLight(0x438cff, 20, 25);
      cool.position.set(-5, -2, -4);
      scene.add(cool);

      world = new THREE.Group();
      scene.add(world);
      const globe = new THREE.Group();
      world.add(globe);

      const coreGeometry = new THREE.IcosahedronGeometry(2.0, 5);
      const coreMaterial = new THREE.MeshStandardMaterial({
        color: 0x111b13, metalness: 0.62, roughness: 0.3,
        emissive: 0x1a3211, emissiveIntensity: 0.48, wireframe: true,
        transparent: true, opacity: 0.22
      });
      const core = new THREE.Mesh(coreGeometry, coreMaterial);
      globe.add(core);

      const inner = new THREE.Mesh(
        new THREE.SphereGeometry(1.74, 64, 64),
        new THREE.MeshStandardMaterial({ color: 0x0d1710, metalness: 0.3, roughness: 0.7, emissive: 0x14260e, emissiveIntensity: 0.42 })
      );
      globe.add(inner);

      const points = [];
      for (let i = 0; i < 4800; i++) {
        const y = 1 - (i / 4799) * 2;
        const radius = Math.sqrt(1 - y * y);
        const theta = Math.PI * (3 - Math.sqrt(5)) * i;
        const r = 1.8 + (Math.random() - 0.5) * 0.045;
        points.push(Math.cos(theta) * radius * r, y * r, Math.sin(theta) * radius * r);
      }
      const pointGeo = new THREE.BufferGeometry();
      pointGeo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
      const pointCloud = new THREE.Points(pointGeo, new THREE.PointsMaterial({ color: 0xc9ff62, size: 0.019, transparent: true, opacity: 0.72, depthWrite: false }));
      globe.add(pointCloud);

      rings = new THREE.Group();
      world.add(rings);
      [[3.05, 0.014, 0.2, 0.7], [3.6, 0.008, 1.08, -0.5], [4.2, 0.006, 1.48, 0.25]].forEach((spec, i) => {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(spec[0], spec[1], 8, 220),
          new THREE.MeshBasicMaterial({ color: i === 1 ? 0x6a9cff : 0xc9ff62, transparent: true, opacity: i === 2 ? 0.25 : 0.52 })
        );
        ring.rotation.set(spec[2], spec[3], i * 0.4);
        rings.add(ring);
      });

      const nodeSpecs = [
        { id: 'marketing', p: [-3.05, 1.35, 0.8] },
        { id: 'sales', p: [3.2, 0.95, 0.4] },
        { id: 'operations', p: [2.1, -1.55, 0.9] },
        { id: 'people', p: [-2.45, -1.6, 0.4] },
        { id: 'finance', p: [0.1, 2.85, 0.15] },
        { id: 'core', p: [0, 0, 2.18] }
      ];
      const nodeMap = {};
      nodeSpecs.forEach(spec => {
        const area = areas.find(a => a.id === spec.id);
        const group = new THREE.Group();
        group.position.set(...spec.p);
        const color = new THREE.Color(area.color);
        const sphere = new THREE.Mesh(
          new THREE.SphereGeometry(spec.id === 'core' ? 0.19 : 0.135, 24, 24),
          new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.2, metalness: 0.25, roughness: 0.25 })
        );
        const halo = new THREE.Mesh(
          new THREE.TorusGeometry(spec.id === 'core' ? 0.32 : 0.23, 0.008, 6, 64),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 })
        );
        halo.rotation.x = Math.PI / 2.7;
        const glow = new THREE.Mesh(
          new THREE.SphereGeometry(spec.id === 'core' ? 0.36 : 0.28, 16, 16),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.075, depthWrite: false })
        );
        group.add(glow, halo, sphere);
        world.add(group);
        nodeMeshes.push({ mesh: sphere, group, halo, glow, id: spec.id });
        nodeMap[spec.id] = group;
      });

      // Interconnected data pathways are curved tubes, not decorative straight lines.
      const linkSpecs = [
        ['core', 'marketing'], ['core', 'sales'], ['core', 'operations'],
        ['core', 'people'], ['core', 'finance'], ['marketing', 'sales'],
        ['sales', 'operations'], ['operations', 'finance'], ['people', 'finance']
      ];
      const linkGroup = new THREE.Group();
      world.add(linkGroup);
      linkSpecs.forEach((pair, idx) => {
        const a = nodeMap[pair[0]].position;
        const b = nodeMap[pair[1]].position;
        const mid = a.clone().add(b).multiplyScalar(0.5);
        mid.multiplyScalar(1.14);
        const curve = new THREE.QuadraticBezierCurve3(a.clone(), mid, b.clone());
        const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(50));
        const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: idx % 3 === 0 ? 0xc9ff62 : 0x4e7760, transparent: true, opacity: idx % 3 === 0 ? 0.44 : 0.22 }));
        linkGroup.add(line);
      });

      const dustPositions = [];
      for (let i = 0; i < 650; i++) {
        dustPositions.push((Math.random() - 0.5) * 18, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12);
      }
      const dustGeo = new THREE.BufferGeometry();
      dustGeo.setAttribute('position', new THREE.Float32BufferAttribute(dustPositions, 3));
      const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0x9bb69a, size: 0.012, transparent: true, opacity: 0.45, depthWrite: false }));
      scene.add(dust);

      raycaster = new THREE.Raycaster();
      raycaster.params.Points.threshold = 0.2;
      pointer = new THREE.Vector2();
      const onMove = (e) => {
        const rect = el.getBoundingClientRect();
        targetX = ((e.clientX - rect.left) / rect.width - 0.5) * 0.6;
        targetY = ((e.clientY - rect.top) / rect.height - 0.5) * 0.35;
      };
      const onClick = (e) => {
        const rect = el.getBoundingClientRect();
        pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObjects(nodeMeshes.map(n => n.mesh), false);
        if (hits.length) {
          const found = nodeMeshes.find(n => n.mesh === hits[0].object);
          if (found) selectRef.current(found.id);
        }
      };
      const resize = () => {
        if (!renderer || !el.clientWidth || !el.clientHeight) return;
        camera.aspect = el.clientWidth / el.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(el.clientWidth, el.clientHeight);
      };
      el.addEventListener('pointermove', onMove);
      el.addEventListener('click', onClick);
      window.addEventListener('resize', resize);
      const clock = new THREE.Clock();
      const animate = () => {
        frame = requestAnimationFrame(animate);
        const t = clock.getElapsedTime();
        pointerX += (targetX - pointerX) * 0.025;
        pointerY += (targetY - pointerY) * 0.025;
        if (!reduced) {
          world.rotation.y = t * 0.055 + pointerX * 0.45;
          world.rotation.x = Math.sin(t * 0.13) * 0.045 + pointerY * 0.4;
          rings.rotation.y = -t * 0.035;
          dust.rotation.y = t * 0.004;
          nodeMeshes.forEach(n => {
            const active = n.id === selectedRef.current;
            const pulse = 1 + Math.sin(t * 2.1 + n.group.position.x) * 0.055;
            n.group.scale.setScalar(pulse * (active ? 1.25 : 1));
            n.halo.rotation.z += 0.0025;
            n.glow.material.opacity = active ? 0.14 + Math.sin(t * 2) * 0.025 : 0.065;
          });
        } else {
          world.rotation.y = 0.35;
        }
        renderer.render(scene, camera);
      };
      animate();
      return () => {
        cancelAnimationFrame(frame);
        window.removeEventListener('resize', resize);
        el.removeEventListener('pointermove', onMove);
        el.removeEventListener('click', onClick);
        scene.traverse(obj => {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach(m => m.dispose());
        });
        renderer.dispose();
        if (renderer.domElement.parentNode === el) el.removeChild(renderer.domElement);
      };
    } catch (error) {
      console.error('Universe scene initialization failed', error);
    }
  }, []);
  return <div className="universe-scene" ref={host} aria-label="Interactive three-dimensional business universe"><div className="scene-vignette" /><div className="scene-instruction">DRAG YOUR VIEW · SELECT A NODE</div></div>;
}

function Sparkline({ values }) {
  const points = values.map((v, i) => (i * 100 / (values.length - 1)) + ',' + (34 - v * 0.28)).join(' ');
  return <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="sparkline"><polyline points={points} /></svg>;
}

export default function Universe() {
  const [selected, setSelected] = useState('core');
  const [timeframe, setTimeframe] = useState('30D');
  const [aiOpen, setAiOpen] = useState(true);
  const [executed, setExecuted] = useState(false);
  const [scenario, setScenario] = useState('baseline');
  const [notice, setNotice] = useState('');
  const active = areas.find(a => a.id === selected) || areas[0];
  useEffect(() => {
    document.title = 'Business Universe — NIFINANCE SOLUTION';
    return () => { document.title = 'NIFINANCE SOLUTION — Business Beyond Borders'; };
  }, []);
  const runAction = () => {
    setExecuted(true);
    setNotice('Demo action queued · no external systems connected');
    window.setTimeout(() => setNotice(''), 4200);
  };
  return <main className="universe-app">
    <div className="universe-noise" />
    <header className="u-topbar">
      <a href="/" className="u-brand"><span className="u-mark"><i /><i /><i /></span><span>NIFINANCE <b>UNIVERSE</b></span></a>
      <div className="u-environment"><span className="u-live" /> DIGITAL TWIN <span className="u-separator">/</span> DEMO ENVIRONMENT</div>
      <div className="u-top-actions"><button onClick={() => setAiOpen(!aiOpen)} className={aiOpen ? 'u-icon-button active' : 'u-icon-button'} aria-label="Toggle AI copilot">✳</button><button className="u-avatar" aria-label="Demo profile">N</button></div>
    </header>
    <div className="u-layout">
      <aside className="u-sidebar">
        <div className="u-side-label">YOUR BUSINESS</div>
        <div className="u-company"><div className="u-company-symbol">N.</div><div><strong>Northstar Group</strong><span>Global operations · Demo</span></div><span className="u-chevron">⌄</span></div>
        <div className="u-side-label u-space">NAVIGATION</div>
        <button className="u-nav-item selected"><span>◈</span> Universe <kbd>01</kbd></button>
        <button className="u-nav-item" onClick={() => setSelected('finance')}><span>◉</span> Performance</button>
        <button className="u-nav-item" onClick={() => setSelected('operations')}><span>⌘</span> Operations</button>
        <button className="u-nav-item" onClick={() => setSelected('people')}><span>◎</span> Team & capacity</button>
        <div className="u-side-label u-space">BUSINESS NODES</div>
        {areas.filter(a => a.id !== 'core').map(a => <button key={a.id} onClick={() => { setSelected(a.id); setExecuted(false); }} className={'u-node-link ' + (selected === a.id ? 'active' : '')}><span className="u-node-dot" style={{ '--node-color': a.color }} /><span>{a.label}</span><span className="u-node-value">{a.value}</span></button>)}
        <div className="u-sidebar-bottom"><div className="u-status-line"><span className="u-live" /> ALL SYSTEMS NOMINAL</div><span>DEMO DATA · UPDATED JUST NOW</span></div>
      </aside>

      <section className="u-main">
        <div className="u-page-heading"><div><div className="u-eyebrow">SYSTEM OVERVIEW <span>/</span> LIVE MODEL</div><h1>Business <em>Universe</em></h1><p>Your company, connected. Explore the signals shaping performance.</p></div><div className="u-heading-right"><span className="u-demo-tag">● SIMULATED DATA</span><button className="u-outline-button" onClick={() => { setScenario(s => s === 'baseline' ? 'growth' : 'baseline'); setExecuted(false); }}>↗ {scenario === 'baseline' ? 'Growth scenario' : 'Base scenario'}</button></div></div>

        <div className="u-kpis">
          <div className="u-kpi"><span>REVENUE · MTD</span><strong>{scenario === 'baseline' ? '€1.84m' : '€2.03m'}</strong><small className="positive">↗ 14.6% <i>vs last month</i></small><Sparkline values={[14,17,15,20,18,23,21,26,25,31,29,35]} /></div>
          <div className="u-kpi"><span>EBITDA MARGIN</span><strong>{scenario === 'baseline' ? '18.7%' : '20.4%'}</strong><small className="positive">↗ 2.1 pp <i>vs plan</i></small><Sparkline values={[19,17,20,22,18,24,23,27,25,29,28,34]} /></div>
          <div className="u-kpi"><span>CASH POSITION</span><strong>{scenario === 'baseline' ? '€624k' : '€701k'}</strong><small className="positive">↗ 6.3% <i>forecast</i></small><Sparkline values={[25,26,23,27,24,29,27,31,29,33,31,35]} /></div>
          <div className="u-kpi"><span>BUSINESS HEALTH</span><strong className="u-health">87<span>/100</span></strong><small className="positive">↗ 4 pts <i>this period</i></small><div className="u-health-bar"><i style={{ width: scenario === 'baseline' ? '87%' : '93%' }} /></div></div>
        </div>

        <div className="u-workspace">
          <div className="u-world-panel">
            <div className="u-panel-heading"><div><span className="u-panel-overline">INTERACTIVE MODEL</span><h2>Company systems</h2></div><div className="u-timeframes">{['7D','30D','90D'].map(t => <button key={t} className={timeframe === t ? 'active' : ''} onClick={() => setTimeframe(t)}>{t}</button>)}</div></div>
            <div className="u-world-stage"><UniverseScene selected={selected} onSelect={id => { setSelected(id); setExecuted(false); }} /><div className="u-world-label u-label-top"><span>●</span> SYSTEM INTEGRITY <b>98.2%</b></div><div className="u-world-label u-label-left"><span className="u-mini-orbit">◉</span><div>CONNECTED NODES<strong>06</strong></div></div><div className="u-world-label u-label-right"><span className="u-live" /> SYNC ACTIVE</div><div className="u-world-label u-label-bottom">GRAVITY MODEL <span>v0.1 / DEMO</span></div></div>
            <div className="u-node-tabs">{areas.map(a => <button key={a.id} className={selected === a.id ? 'active' : ''} onClick={() => { setSelected(a.id); setExecuted(false); }}><span style={{ '--node-color': a.color }} />{a.short}</button>)}</div>
          </div>

          <aside className="u-insight-panel">
            <div className="u-panel-heading"><div><span className="u-panel-overline">SELECTED SYSTEM</span><h2>{active.label}</h2></div><span className="u-health-dot" /></div>
            <div className="u-selected-metric"><span>{active.metric}</span><div><strong>{active.value}</strong><small>↗ {active.change}</small></div></div>
            <p className="u-insight-copy">{active.detail}</p>
            <div className="u-mini-chart"><div className="u-chart-top"><span>PERFORMANCE SIGNAL</span><span>{timeframe}</span></div><div className="u-chart-bars">{[32,45,37,56,44,61,48,67,55,72,62,83,71,92,77,100,86,96,81,100].map((h,i)=><i key={i} style={{ height: (h * (timeframe === '7D' ? .74 : timeframe === '90D' ? 1 : .88)) + '%' }} />)}</div><div className="u-chart-axis"><span>{timeframe === '7D' ? 'MON' : timeframe === '30D' ? 'WEEK 01' : 'PERIOD 01'}</span><span>{timeframe === '7D' ? 'SUN' : timeframe === '30D' ? 'WEEK 04' : 'PERIOD 12'}</span></div></div>
            <div className="u-divider" />
            <div className="u-ai-label"><span className="u-ai-symbol">✳</span><div><strong>AI intelligence</strong><span>Cross-system interpretation</span></div><span className="u-confidence">94% CONF.</span></div>
            <div className="u-ai-message"><span className="u-ai-line" /><p>{selected === 'core' ? 'Revenue is growing faster than operating cost. Protect contribution margin while scaling acquisition.' : active.detail}</p></div>
            <div className="u-recommendation"><span>RECOMMENDED ACTION</span><strong>{selected === 'marketing' ? 'Reallocate 8% of spend to top-performing campaigns' : selected === 'sales' ? 'Prioritise 12 high-probability opportunities' : selected === 'operations' ? 'Smooth fulfilment load over the next 2 weeks' : selected === 'people' ? 'Rebalance workload across two delivery teams' : selected === 'finance' ? 'Stress-test receivables timing against cash runway' : 'Run a margin-protection scenario before scaling'}</strong><button onClick={runAction}>{executed ? '✓ Action queued (demo)' : 'Review & execute'} <span>↗</span></button></div>
            {notice && <div className="u-notice">{notice}</div>}
          </aside>
        </div>

        <div className="u-bottom-grid">
          <section className="u-feed-panel"><div className="u-panel-heading"><div><span className="u-panel-overline">SYSTEM ACTIVITY</span><h2>Signals & events</h2></div><button className="u-text-button" onClick={() => setSelected('core')}>View all ↗</button></div><div className="u-feed-item"><span className="u-feed-icon green">↗</span><div><strong>Margin forecast updated</strong><p>Finance model · contribution margin +1.8 pp</p></div><time>2m</time></div><div className="u-feed-item"><span className="u-feed-icon blue">◎</span><div><strong>Sales pipeline accelerated</strong><p>Sales system · 4 new qualified opportunities</p></div><time>11m</time></div><div className="u-feed-item"><span className="u-feed-icon amber">⌁</span><div><strong>Capacity threshold approaching</strong><p>Operations · fulfilment utilisation at 86.4%</p></div><time>24m</time></div></section>
          {aiOpen && <section className="u-copilot-panel"><div className="u-panel-heading"><div><span className="u-panel-overline">NIFINANCE INTELLIGENCE</span><h2>Executive copilot</h2></div><span className="u-ai-symbol">✳</span></div><div className="u-copilot-greeting"><span className="u-ai-avatar">✳</span><p><strong>Good evening, Nikolai.</strong><br />The business model is stable. I found one opportunity to improve margin without slowing growth.</p></div><div className="u-copilot-suggestion"><span>PRIORITY INSIGHT</span><p>Shifting spend toward high-intent campaigns could lift contribution margin by <b>1.2–1.8 pp</b> in this illustrative scenario.</p><button onClick={() => { setSelected('marketing'); setExecuted(false); }}>Explore in Marketing <span>↗</span></button></div><div className="u-copilot-input"><span>Ask about your business…</span><button onClick={() => setNotice('Demo only · connect an AI model to enable conversation')} aria-label="Send prompt">↑</button></div></section>}
        </div>
        <footer className="u-footer"><span>NIFINANCE UNIVERSE <b>·</b> INTERACTIVE CONCEPT</span><span>ALL METRICS ARE ILLUSTRATIVE <b>·</b> NO LIVE INTEGRATIONS</span><a href="/">← Back to NIFINANCE</a></footer>
      </section>
    </div>
  </main>;
}
