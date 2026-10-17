import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import './universe.css';

const nodes = [
  { id: 'procurement', label: 'Procurement', metric: 'Supplier cost', value: '+3.0%', color: '#ffbf69', pos: [-2.1, 1.8, -4.7], note: 'A supplier price change increases the direct cost of production.', impact: 'Unit cost +3.0% → gross margin pressure → EBITDA ↓', links: ['production', 'finance'] },
  { id: 'production', label: 'Production', metric: 'Cost per unit', value: '+2.4%', color: '#ff8c70', pos: [1.1, 1.35, -5.0], note: 'Higher input prices are flowing through the production plan.', impact: 'Input costs rise → cost per unit rises → margin narrows', links: ['procurement', 'finance'] },
  { id: 'marketing', label: 'Marketing', metric: 'Qualified leads', value: '−18%', color: '#71dfff', pos: [-4.5, -0.3, -2.8], note: 'Fewer qualified leads enter the funnel. Check channel mix, audience and landing-page conversion.', impact: 'Lead volume ↓ → pipeline ↓ → revenue forecast at risk', links: ['sales', 'finance'] },
  { id: 'sales', label: 'Sales funnel', metric: 'Conversion', value: '−12%', color: '#b9a0ff', pos: [-1.6, -2.0, -4.8], note: 'The decline starts between qualified lead and first sales meeting.', impact: 'Conversion ↓ → fewer opportunities → revenue ↓', links: ['marketing', 'finance'] },
  { id: 'operations', label: 'Operations', metric: 'Capacity used', value: '86%', color: '#9dff8c', pos: [3.6, -1.0, -3.8], note: 'Production capacity is elevated. Cost pressure may compound if the plan is not adjusted.', impact: 'Capacity pressure → overtime risk → operating cost ↑', links: ['production', 'finance'] },
  { id: 'finance', label: 'Profit & cash', metric: 'EBITDA forecast', value: '−4.6%', color: '#e8f3df', pos: [3.1, 2.4, -3.4], note: 'Combined effects are reflected in the illustrative profit forecast. Follow the connected paths to see the drivers.', impact: 'Cost ↑ + revenue pressure → EBITDA ↓ → cash conversion slows', links: ['procurement', 'production', 'marketing', 'sales', 'operations'] },
  { id: 'customers', label: 'Customers', metric: 'Retention', value: '91.8%', color: '#f3e66d', pos: [0.1, 3.8, -3.5], note: 'Customer experience influences repeat purchase, retention and the stability of future revenue.', impact: 'Experience → retention → recurring revenue', links: ['sales', 'finance'] }
];

const scenarios = {
  supplier: {
    title: 'Supplier price increase',
    subtitle: 'A new supplier raises input prices by 3%.',
    path: ['procurement', 'production', 'finance'],
    steps: [
      { node: 'procurement', label: 'Supplier price', value: '+3.0%', detail: 'New contract price is higher than the previous baseline.' },
      { node: 'production', label: 'Production cost', value: '+2.4%', detail: 'Direct cost per unit rises as the new price enters the production plan.' },
      { node: 'finance', label: 'EBITDA forecast', value: '−4.6%', detail: 'If pricing and efficiency stay unchanged, margin and profit come under pressure.' }
    ]
  },
  demand: {
    title: 'Sales funnel slows',
    subtitle: 'Qualified leads fall and fewer opportunities reach sales.',
    path: ['marketing', 'sales', 'finance'],
    steps: [
      { node: 'marketing', label: 'Qualified leads', value: '−18%', detail: 'Fewer suitable prospects enter the funnel.' },
      { node: 'sales', label: 'Conversion', value: '−12%', detail: 'Fewer leads become active opportunities and proposals.' },
      { node: 'finance', label: 'Revenue forecast', value: 'At risk', detail: 'Pipeline coverage falls and the revenue plan may need to be revised.' }
    ]
  }
};

function BusinessSphere({ selected, onSelect, scenario }) {
  const host = useRef(null);
  const stateRef = useRef({ selected, scenario, onSelect });
  useEffect(() => { stateRef.current = { selected, scenario, onSelect }; }, [selected, scenario, onSelect]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer, scene, camera, frame, shell, network, nodeGroup, raycaster;
    const meshes = [];
    const labels = new Map();
    const labelEls = new Map();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let isDragging = false, dragMoved = false, suppressClick = false;
    let pointerStartX = 0, pointerStartY = 0, previousPointerX = 0, previousPointerY = 0;
    let dragVelocityX = 0, dragVelocityY = 0;
    try {
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(72, el.clientWidth / Math.max(el.clientHeight, 1), 0.1, 100);
      camera.position.set(0, 0, 0);
      camera.lookAt(0, 0, -1);
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
      renderer.setSize(el.clientWidth, el.clientHeight);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      el.prepend(renderer.domElement);

      scene.add(new THREE.AmbientLight(0xc9d9c1, 1.5));
      const key = new THREE.PointLight(0xc9ff78, 18, 24);
      key.position.set(0, 1, 1);
      scene.add(key);
      const cool = new THREE.PointLight(0x438cff, 8, 18);
      cool.position.set(-3, -2, -3);
      scene.add(cool);

      shell = new THREE.Group();
      scene.add(shell);
      // Zoom only the business model layer; the particle shell remains at its original size.
      const businessElements = new THREE.Group();
      shell.add(businessElements);
      let zoomLevel = 1;
      const applyZoom = (value) => {
        zoomLevel = Math.max(0.72, Math.min(1.72, value));
        businessElements.scale.setScalar(zoomLevel);
        // Subtle forward travel makes zoom feel like moving through the model, not resizing the sphere.
        businessElements.position.z = (zoomLevel - 1) * 1.1;
        zoomReadout.textContent = Math.round(zoomLevel * 100) + '%';
      };
      const zoomControls = document.createElement('div');
      zoomControls.className = 'sphere-zoom-controls';
      zoomControls.innerHTML = '<button type="button" aria-label="Zoom out" title="Zoom out">−</button><span>100%</span><button type="button" aria-label="Zoom in" title="Zoom in">+</button><button type="button" class="sphere-zoom-reset" aria-label="Reset zoom" title="Reset zoom">RESET</button>';
      const zoomOut = zoomControls.querySelector('button[aria-label="Zoom out"]');
      const zoomIn = zoomControls.querySelector('button[aria-label="Zoom in"]');
      const zoomReadout = zoomControls.querySelector('span');
      const zoomReset = zoomControls.querySelector('.sphere-zoom-reset');
      zoomOut.addEventListener('click', () => applyZoom(zoomLevel - 0.12));
      zoomIn.addEventListener('click', () => applyZoom(zoomLevel + 0.12));
      zoomReset.addEventListener('click', () => applyZoom(1));
      el.appendChild(zoomControls);
      const onWheelZoom = (e) => {
        e.preventDefault();
        applyZoom(zoomLevel + (e.deltaY < 0 ? 0.07 : -0.07));
      };
      el.addEventListener('wheel', onWheelZoom, { passive: false });
      const shellRadius = 6.0;
      const dotPositions = [];
      const dotColors = [];
      const colorA = new THREE.Color('#c9ff78');
      const colorB = new THREE.Color('#47745b');
      const count = 10500;
      for (let i = 0; i < count; i++) {
        const y = 1 - (i / (count - 1)) * 2;
        const radius = Math.sqrt(1 - y * y);
        const theta = Math.PI * (3 - Math.sqrt(5)) * i;
        const x = Math.cos(theta) * radius;
        const z = Math.sin(theta) * radius;
        dotPositions.push(x * shellRadius, y * shellRadius, z * shellRadius);
        const c = Math.random() > 0.72 ? colorA : colorB;
        dotColors.push(c.r, c.g, c.b);
      }
      const shellGeo = new THREE.BufferGeometry();
      shellGeo.setAttribute('position', new THREE.Float32BufferAttribute(dotPositions, 3));
      shellGeo.setAttribute('color', new THREE.Float32BufferAttribute(dotColors, 3));
      // The particle shell has its own slow, organic motion. Displacement is tangential
      // and very small, so the sphere stays coherent while business nodes and links remain fixed.
      const shellDotMaterial = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uPointSize: { value: 0.023 } },
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        vertexShader: `
          uniform float uTime;
          uniform float uPointSize;
          varying vec3 vColor;
          varying float vFade;
          void main() {
            vec3 p = position;
            vec3 n = normalize(position);
            vec3 drift = vec3(
              sin(position.y * 1.7 + uTime * 0.22) + cos(position.z * 1.1 - uTime * 0.13),
              sin(position.z * 1.5 - uTime * 0.18) + cos(position.x * 1.3 + uTime * 0.16),
              sin(position.x * 1.6 + uTime * 0.15) + cos(position.y * 1.4 - uTime * 0.20)
            );
            drift -= n * dot(drift, n);
            p += normalize(drift + vec3(0.0001)) * (0.035 * sin(uTime * 0.24 + dot(position, vec3(0.31, 0.23, 0.27))));
            vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mvPosition;
            gl_PointSize = uPointSize * (500.0 / max(0.1, -mvPosition.z));
            vColor = color;
            vFade = smoothstep(0.0, 1.0, clamp((-mvPosition.z) / 1.5, 0.0, 1.0));
          }
        `,
        fragmentShader: `
          varying vec3 vColor;
          varying float vFade;
          void main() {
            vec2 uv = gl_PointCoord - vec2(0.5);
            float circle = 1.0 - smoothstep(0.30, 0.50, length(uv));
            if (circle < 0.02) discard;
            gl_FragColor = vec4(vColor, 0.8 * circle * vFade);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }
        `
      });
      const shellDots = new THREE.Points(shellGeo, shellDotMaterial);
      shell.add(shellDots);

      // Sparse latitude arcs create a spatial reference, not a decorative globe.
      const arcGroup = new THREE.Group();
      shell.add(arcGroup);
      [0.38, 0.68, 0.88].forEach((ratio, idx) => {
        const r = shellRadius * ratio;
        const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.004, 4, 180), new THREE.MeshBasicMaterial({ color: idx === 1 ? 0x8bcf76 : 0x42664b, transparent: true, opacity: 0.25 }));
        ring.rotation.x = idx * 0.73 + 0.4;
        ring.rotation.y = idx * 0.9;
        arcGroup.add(ring);
      });

      nodeGroup = new THREE.Group();
      businessElements.add(nodeGroup);
      const nodeById = {};
      nodes.forEach((node, idx) => {
        const p = new THREE.Vector3(...node.pos).normalize().multiplyScalar(shellRadius - 0.12);
        const group = new THREE.Group();
        group.position.copy(p);
        group.lookAt(new THREE.Vector3(0, 0, 0));
        const col = new THREE.Color(node.color);
        const cube = new THREE.Mesh(
          new THREE.BoxGeometry(0.19, 0.19, 0.19),
          new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1.25, metalness: 0.22, roughness: 0.3 })
        );
        const frame = new THREE.LineSegments(
          new THREE.EdgesGeometry(new THREE.BoxGeometry(0.32, 0.32, 0.32)),
          new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.85 })
        );
        const halo = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 14), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.07, depthWrite: false }));
        group.add(halo, frame, cube);
        nodeGroup.add(group);
        const entry = { id: node.id, group, cube, frame, halo, anchor: p.clone() };
        meshes.push(entry);
        nodeById[node.id] = entry;
        const label = document.createElement('button');
        label.className = 'sphere-node-label';
        label.type = 'button';
        label.innerHTML = '<span class="sphere-label-dot"></span><span class="sphere-label-name"></span><b class="sphere-label-value"></b>';
        label.querySelector('.sphere-label-name').textContent = node.label;
        label.querySelector('.sphere-label-value').textContent = node.value;
        label.style.setProperty('--node-color', node.color);
        label.addEventListener('click', () => stateRef.current.onSelect(node.id));
        el.appendChild(label);
        labelEls.set(node.id, label);
      });

      network = new THREE.Group();
      businessElements.add(network);
      const links = [
        ['procurement', 'production'], ['production', 'finance'], ['operations', 'production'],
        ['marketing', 'sales'], ['sales', 'finance'], ['marketing', 'finance'],
        ['customers', 'sales'], ['customers', 'finance'], ['operations', 'finance']
      ];
      const linkMeshes = [];
      links.forEach(([from, to]) => {
        const a = nodeById[from].group.position.clone();
        const b = nodeById[to].group.position.clone();
        const mid = a.clone().add(b).normalize().multiplyScalar(shellRadius * 1.012);
        const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
        const points = curve.getPoints(64);
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color: 0x64896b, transparent: true, opacity: 0.28 });
        const line = new THREE.Line(geometry, material);
        network.add(line);
        linkMeshes.push({ from, to, line, material });
      });

      // A luminous pulse travels through the selected causal chain.
      const pulseGroup = new THREE.Group();
      businessElements.add(pulseGroup);
      const pulses = [];
      for (let i = 0; i < 3; i++) {
        const pulse = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 10), new THREE.MeshBasicMaterial({ color: 0xc9ff78 }));
        pulseGroup.add(pulse);
        pulses.push(pulse);
      }

      raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      const onClick = (e) => {
        if (suppressClick) { suppressClick = false; return; }
        if (e.target.closest('.sphere-node-label')) return;
        const rect = el.getBoundingClientRect();
        pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.intersectObjects(meshes.map(n => n.cube), false)[0];
        if (hit) {
          const found = meshes.find(n => n.cube === hit.object);
          if (found) stateRef.current.onSelect(found.id);
        }
      };
      const onPointerDown = (e) => {
        if (e.target.closest('.sphere-node-label, .sphere-zoom-controls')) return;
        isDragging = true;
        dragMoved = false;
        pointerStartX = previousPointerX = e.clientX;
        pointerStartY = previousPointerY = e.clientY;
        dragVelocityX = dragVelocityY = 0;
        el.classList.add('is-dragging');
        if (el.setPointerCapture) el.setPointerCapture(e.pointerId);
      };
      const onPointerMove = (e) => {
        if (!isDragging) return;
        const dx = e.clientX - previousPointerX;
        const dy = e.clientY - previousPointerY;
        if (Math.abs(e.clientX - pointerStartX) + Math.abs(e.clientY - pointerStartY) > 4) dragMoved = true;
        shell.rotation.y += dx * 0.0065;
        shell.rotation.x += dy * 0.0065;
        shell.rotation.x = Math.max(-Math.PI * 0.46, Math.min(Math.PI * 0.46, shell.rotation.x));
        dragVelocityX = dx * 0.002;
        dragVelocityY = dy * 0.002;
        previousPointerX = e.clientX;
        previousPointerY = e.clientY;
      };
      const onPointerUp = (e) => {
        if (!isDragging) return;
        isDragging = false;
        suppressClick = dragMoved;
        el.classList.remove('is-dragging');
        if (el.hasPointerCapture && el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      };
      const onPointerCancel = (e) => onPointerUp(e);
      const resize = () => {
        if (!renderer || !el.clientWidth || !el.clientHeight) return;
        camera.aspect = el.clientWidth / el.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(el.clientWidth, el.clientHeight);
      };
      el.addEventListener('click', onClick);
      el.addEventListener('pointerdown', onPointerDown);
      el.addEventListener('pointermove', onPointerMove);
      el.addEventListener('pointerup', onPointerUp);
      el.addEventListener('pointercancel', onPointerCancel);
      el.addEventListener('lostpointercapture', onPointerUp);
      window.addEventListener('resize', resize);
      const clock = new THREE.Clock();

      const animate = () => {
        frame = requestAnimationFrame(animate);
        const t = clock.getElapsedTime();
        shellDotMaterial.uniforms.uTime.value = reduced ? t * 0.35 : t;
        // Keep the business nodes fixed relative to the sphere. Only a deliberate drag rotates the model.
        // A short, damped inertial glide follows the user's drag; there is no idle auto-spin.
        if (!isDragging && !reduced) {
          shell.rotation.y += dragVelocityX;
          shell.rotation.x += dragVelocityY;
          dragVelocityX *= 0.92;
          dragVelocityY *= 0.92;
          if (Math.abs(dragVelocityX) < 0.00002) dragVelocityX = 0;
          if (Math.abs(dragVelocityY) < 0.00002) dragVelocityY = 0;
        }
        const activeScenario = scenarios[stateRef.current.scenario];
        const pathSet = new Set(activeScenario ? activeScenario.path : []);
        linkMeshes.forEach(({ from, to, line, material }) => {
          const highlighted = pathSet.has(from) && pathSet.has(to);
          material.opacity = highlighted ? 0.95 : 0.19;
          material.color.set(highlighted ? 0xc9ff78 : 0x64896b);
          line.computeLineDistances?.();
        });
        meshes.forEach((n, i) => {
          const active = n.id === stateRef.current.selected;
          const onPath = pathSet.has(n.id);
          const pulse = 1 + Math.sin(t * 2 + i) * 0.05;
          n.group.scale.setScalar(pulse * (active ? 1.35 : onPath ? 1.13 : 1));
          n.halo.material.opacity = active ? 0.19 : onPath ? 0.12 : 0.055;
          n.frame.material.opacity = active ? 1 : onPath ? 0.95 : 0.52;
          const worldPos = n.group.getWorldPosition(new THREE.Vector3());
          const projected = worldPos.clone().project(camera);
          const visible = projected.z < 1 && projected.z > -1 && worldPos.z < -0.3;
          const label = labelEls.get(n.id);
          if (label) {
            label.style.transform = 'translate(-50%, -50%) translate(' + ((projected.x * 0.5 + 0.5) * el.clientWidth) + 'px, ' + ((-projected.y * 0.5 + 0.5) * el.clientHeight) + 'px)';
            label.style.opacity = visible ? (active ? '1' : onPath ? '0.96' : '0.72') : '0';
            label.style.pointerEvents = visible ? 'auto' : 'none';
            label.classList.toggle('active', active);
            label.classList.toggle('on-path', onPath);
          }
        });
        if (activeScenario) {
          activeScenario.path.slice(0, 3).forEach((id, i) => {
            const node = nodeById[id];
            if (!node || !pulses[i]) return;
            const next = nodeById[activeScenario.path[i + 1]];
            if (next) {
              const alpha = (t * 0.34 + i * 0.37) % 1;
              const p = node.group.position.clone().lerp(next.group.position, alpha);
              pulses[i].position.copy(p);
              pulses[i].visible = true;
            } else pulses[i].visible = false;
          });
        }
        renderer.render(scene, camera);
      };
      animate();

      return () => {
        cancelAnimationFrame(frame);
        window.removeEventListener('resize', resize);
        el.removeEventListener('wheel', onWheelZoom);
        zoomControls.remove();
        el.removeEventListener('click', onClick);
        el.removeEventListener('pointerdown', onPointerDown);
        el.removeEventListener('pointermove', onPointerMove);
        el.removeEventListener('pointerup', onPointerUp);
        el.removeEventListener('pointercancel', onPointerCancel);
        el.removeEventListener('lostpointercapture', onPointerUp);
        labelEls.forEach(label => label.remove());
        scene.traverse(obj => {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach(m => m.dispose());
        });
        renderer.dispose();
        if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
      };
    } catch (error) {
      console.error('Business sphere failed to initialize', error);
      if (renderer) renderer.dispose();
    }
  }, []);
  return <div className="business-sphere" ref={host} aria-label="Business dependency sphere. Select a node to inspect how business metrics affect one another." />;
}

export default function Universe() {
  const [selected, setSelected] = useState('finance');
  const [scenarioKey, setScenarioKey] = useState('supplier');
  const [showMap, setShowMap] = useState(true);
  const active = nodes.find(n => n.id === selected) || nodes[0];
  const scenario = scenarios[scenarioKey];
  useEffect(() => {
    document.title = 'Business Universe — NIFINANCE SOLUTION';
    return () => { document.title = 'NIFINANCE SOLUTION — Business Beyond Borders'; };
  }, []);

  return <main className="business-universe">
    <div className="bu-topbar">
      <a className="bu-brand" href="/"><span className="bu-brand-mark">N</span><span>NIFINANCE <b>BUSINESS UNIVERSE</b></span></a>
      <div className="bu-live-state"><i /> INTERACTIVE BUSINESS MODEL <span>·</span> ILLUSTRATIVE DATA</div>
      <button className="bu-help" onClick={() => setShowMap(v => !v)}>{showMap ? 'Hide causal map −' : 'Show causal map +'}</button>
    </div>

    <section className="bu-hero">
      <div className="bu-intro"><span className="bu-eyebrow">A BUSINESS YOU CAN STEP INSIDE</span><h1>See how one change<br /><em>moves the whole business.</em></h1><p>You're at the centre. Every node is a business driver. Every connection shows where a change travels next.</p></div>
      <div className="bu-scenario-switch"><span>EXPLORE A SCENARIO</span><div><button className={scenarioKey === 'supplier' ? 'active' : ''} onClick={() => setScenarioKey('supplier')}>Supplier cost +3%</button><button className={scenarioKey === 'demand' ? 'active' : ''} onClick={() => setScenarioKey('demand')}>Sales funnel −12%</button></div></div>
    </section>

    <section className="bu-stage-wrap">
      <div className="bu-stage-grid" />
      <BusinessSphere selected={selected} onSelect={setSelected} scenario={scenarioKey} />
      <div className="bu-center-user"><div className="bu-user-orbit" /><div className="bu-user-core"><span>YOU</span><b>◎</b><small>DECISION<br />CENTRE</small></div></div>
      <div className="bu-stage-hud bu-hud-top-left"><span>MODEL SPACE</span><b>360°</b></div>
      <div className="bu-stage-hud bu-hud-top-right"><i /> LIVE SIMULATION</div>
      <div className="bu-stage-hud bu-hud-bottom-left">DRAG TO ORIENT <span>·</span> SELECT A NODE TO INSPECT</div>
      <div className="bu-stage-hud bu-hud-bottom-right">DEMO MODEL / 01</div>
    </section>

    <section className="bu-analysis">
      <div className="bu-analysis-main">
        <div className="bu-section-label"><span>01 / CAUSAL CHAIN</span><span>{scenario.title}</span></div>
        <h2>{scenario.subtitle}</h2>
        <div className="bu-causal-chain">
          {scenario.steps.map((step, i) => {
            const node = nodes.find(n => n.id === step.node);
            return <React.Fragment key={step.node}>
              <button className={'bu-chain-step ' + (selected === step.node ? 'active' : '')} onClick={() => setSelected(step.node)} style={{ '--node-color': node.color }}>
                <span className="bu-chain-index">0{i + 1}</span><span className="bu-chain-node">{node.label}</span><strong>{step.value}</strong><small>{step.label}</small><p>{step.detail}</p>
              </button>
              {i < scenario.steps.length - 1 && <div className="bu-chain-arrow"><span>→</span><small>IMPACT</small></div>}
            </React.Fragment>;
          })}
        </div>
        {showMap && <div className="bu-impact-note"><span className="bu-impact-icon">↳</span><div><b>Why this matters</b><p>{scenarioKey === 'supplier' ? 'The supplier change does not stay in procurement. It propagates into production cost and then the profit forecast. Management can respond through renegotiation, alternative sourcing, price adjustment or efficiency measures.' : 'A weaker funnel does not stay inside marketing. Fewer qualified leads reduce sales opportunities and put the revenue forecast under pressure. Investigate channel quality, landing-page conversion and sales follow-up before increasing spend.'}</p></div></div>}
      </div>
      <aside className="bu-selected-card">
        <span className="bu-section-label">SELECTED BUSINESS NODE</span>
        <div className="bu-selected-heading"><span className="bu-selected-cube" style={{ '--node-color': active.color }} /><div><h3>{active.label}</h3><small>{active.metric}</small></div><strong>{active.value}</strong></div>
        <p>{active.note}</p>
        <div className="bu-impact-path"><span>CONNECTED IMPACT</span><b>{active.impact}</b></div>
        <div className="bu-connected"><span>DIRECT CONNECTIONS</span><div>{active.links.map(id => { const n = nodes.find(x => x.id === id); return <button key={id} onClick={() => setSelected(id)}><i style={{ '--node-color': n.color }} />{n.label}<span>↗</span></button>; })}</div></div>
      </aside>
    </section>
    <footer className="bu-footer"><span>NIFINANCE BUSINESS UNIVERSE</span><span>CONCEPT PROTOTYPE · ALL FIGURES ARE ILLUSTRATIVE</span><a href="/">← Back to NIFINANCE SOLUTION</a></footer>
  </main>;
}
