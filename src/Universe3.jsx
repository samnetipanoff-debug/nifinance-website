import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import './universe3.css';

const nodes = [
  { id: 'procurement', label: 'Acquisition', metric: 'Marketing spend', value: '+19.5%', color: '#ffbf69', pos: [-2.1, 1.8, -4.7], note: 'Total acquisition and channel-related spend rises from €6,320 in January to €7,550 in March.', impact: 'Spend ↑ → qualified leads ↑ → check cost per qualified lead', links: ['marketing', 'finance'] },
  { id: 'production', label: 'Delivery', metric: 'Service delivery cost', value: '25–48%', color: '#ff8c70', pos: [1.1, 1.35, -5.0], note: 'Delivery cost assumptions vary by service line: strategy 25%, performance marketing 32%, SEO 38%, and websites 48%.', impact: 'Service mix → delivery cost → operating margin', links: ['sales', 'finance'] },
  { id: 'marketing', label: 'Marketing', metric: 'Qualified leads', value: '+53.1%', color: '#71dfff', pos: [-4.5, -0.3, -2.8], note: 'Qualified leads increase from 113 in January to 173 in March. Channel-level figures help explain where demand comes from.', impact: 'Channel spend → qualified leads → opportunities → won deals', links: ['sales', 'procurement', 'finance'] },
  { id: 'sales', label: 'Sales funnel', metric: 'Opportunities', value: '+59.6%', color: '#b9a0ff', pos: [-1.6, -2.0, -4.8], note: 'Opportunities rise from 52 in January to 83 in March, while six deals are marked won in each month.', impact: 'More opportunities + deal value → recognized revenue', links: ['marketing', 'customers', 'finance'] },
  { id: 'operations', label: 'Team & operations', metric: 'Monthly payroll', value: '€22.6k', color: '#9dff8c', pos: [3.6, -1.0, -3.8], note: 'The operating model includes eight team members and €22,600 in monthly payroll costs.', impact: 'Team capacity + payroll → delivery capacity and fixed cost base', links: ['production', 'finance'] },
  { id: 'finance', label: 'Profit & cash', metric: 'Recognized revenue', value: '+28.9%', color: '#e8f3df', pos: [3.1, 2.4, -3.4], note: 'Won-deal revenue increases from €45,000 in January to €58,000 in March. Profit is calculated separately from operating expenses.', impact: 'Won deals → recognized revenue − operating expenses → operating profit', links: ['procurement', 'production', 'marketing', 'sales', 'operations', 'customers'] },
  { id: 'customers', label: 'Customers', metric: 'Won deals / month', value: '6', color: '#f3e66d', pos: [0.1, 3.8, -3.5], note: 'The demo tracks six won deals per month across client accounts including Adria Home, GreenBasket, Nova Dental, BluePeak SaaS, UrbanFit and Finwise.', impact: 'Client mix + service mix → contract value and delivery margin', links: ['sales', 'finance'] }
];

const directionBreakdowns = {
  procurement: { title: 'CHANNEL SPEND', rows: [['Paid search', '€3.2k'], ['Social ads', '€1.9k'], ['SEO & content', '€1.4k']] },
  production: { title: 'DELIVERY COST', rows: [['Strategy', '25%'], ['Performance marketing', '32%'], ['SEO', '38%'], ['Websites', '48%']] },
  marketing: { title: 'LEADS BY CHANNEL', rows: [['Paid search', '42'], ['Social campaigns', '36'], ['SEO & content', '31'], ['Partners / email', '47']] },
  sales: { title: 'SALES FUNNEL', rows: [['Qualified leads', '173'], ['Opportunities', '83'], ['Proposals', '31'], ['Deals won', '6']] },
  operations: { title: 'TEAM CAPACITY', rows: [['Consulting', '2'], ['Marketing & SEO', '3'], ['Development', '2'], ['Account management', '1']] },
  finance: { title: 'LATEST MONTH', rows: [['Revenue', '€58.0k'], ['Operating costs', '€41.6k'], ['Operating profit', '€16.4k'], ['Margin', '28.3%']] },
  customers: { title: 'CUSTOMERS & CASH', rows: [['Active clients', '6'], ['Deals won', '6'], ['Cash received', '€23.2k']] }
};

const scenarios = {
  growth: {
    title: 'Acquisition efficiency improves',
    subtitle: 'Qualified leads rise while cost per qualified lead falls.',
    path: ['procurement', 'marketing', 'sales', 'finance'],
    steps: [
      { node: 'procurement', label: 'Channel spend', value: '€6.32k → €7.55k', detail: 'Monthly channel-related spend increases by 19.5% from January to March.' },
      { node: 'marketing', label: 'Qualified leads', value: '113 → 173', detail: 'Qualified leads grow by 53.1%, faster than channel-related spend.' },
      { node: 'sales', label: 'Opportunities', value: '52 → 83', detail: 'Recorded opportunities increase by 59.6% over the same period.' },
      { node: 'finance', label: 'Won-deal revenue', value: '€45k → €58k', detail: 'Revenue from won deals rises by 28.9%. These are demo figures, not a forecast.' }
    ]
  },
  cash: {
    title: 'Revenue is not the same as cash',
    subtitle: 'Compare won-deal revenue with recorded customer receipts.',
    path: ['sales', 'customers', 'finance'],
    steps: [
      { node: 'sales', label: 'Won-deal revenue', value: '€45k → €58k', detail: 'Revenue is recognized from deals marked won in each month.' },
      { node: 'customers', label: 'Recorded receipts', value: '€17.5k → €23.2k', detail: 'The seed records customer receipts separately from recognized revenue.' },
      { node: 'finance', label: 'Management insight', value: 'Track the gap', detail: 'Receipts in this demo are only selected cash movements; do not treat them as a complete receivables ledger or cash forecast.' }
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
      let targetZoom = 1;
      const applyZoom = (value) => {
        targetZoom = Math.max(0.25, Math.min(3.0, value));
        const universe = el.closest('.business-universe3');
        if (universe) universe.classList.toggle('is-zoomed', targetZoom >= 1.35);
        zoomReadout.textContent = Math.round(targetZoom * 100) + '%';
      };
      const zoomControls = document.createElement('div');
      zoomControls.className = 'sphere-zoom-controls';
      zoomControls.innerHTML = '<button type="button" aria-label="Zoom out" title="Zoom out">−</button><span>100%</span><button type="button" aria-label="Zoom in" title="Zoom in">+</button><button type="button" class="sphere-zoom-reset" aria-label="Reset zoom" title="Reset zoom">RESET</button>';
      const zoomOut = zoomControls.querySelector('button[aria-label="Zoom out"]');
      const zoomIn = zoomControls.querySelector('button[aria-label="Zoom in"]');
      const zoomReadout = zoomControls.querySelector('span');
      const zoomReset = zoomControls.querySelector('.sphere-zoom-reset');
      zoomOut.addEventListener('click', () => applyZoom(targetZoom - 0.12));
      zoomIn.addEventListener('click', () => applyZoom(targetZoom + 0.12));
      zoomReset.addEventListener('click', () => applyZoom(1));
      el.appendChild(zoomControls);

      const onWheelZoom = (e) => {
        e.preventDefault();
        applyZoom(targetZoom + (e.deltaY < 0 ? 0.07 : -0.07));
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
              sin(position.y * 1.7 + uTime * 0.48) + cos(position.z * 1.1 - uTime * 0.31),
              sin(position.z * 1.5 - uTime * 0.39) + cos(position.x * 1.3 + uTime * 0.42),
              sin(position.x * 1.6 + uTime * 0.36) + cos(position.y * 1.4 - uTime * 0.44)
            );
            drift -= n * dot(drift, n);
            p += normalize(drift + vec3(0.0001)) * (0.11 * sin(uTime * 0.42 + dot(position, vec3(0.31, 0.23, 0.27))));
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

        // A subtly curved glass panel follows the sphere instead of reading as a flat card.
        // It sits behind the node; the HTML label remains crisp and readable above it.
        const panelWidth = 1.62;
        const panelHeight = 0.94;
        const panelSegmentsX = 24;
        const panelSegmentsY = 12;
        const panelPositions = [];
        const panelIndices = [];
        for (let iy = 0; iy <= panelSegmentsY; iy++) {
          const v = iy / panelSegmentsY;
          const y = (v - 0.5) * panelHeight;
          for (let ix = 0; ix <= panelSegmentsX; ix++) {
            const u = ix / panelSegmentsX;
            const x = (u - 0.5) * panelWidth;
            // The edges recede gently, giving the panel a wrap-around spherical profile.
            const z = -0.22 * Math.pow(x / (panelWidth * 0.5), 2) - 0.08 * Math.pow(y / (panelHeight * 0.5), 2);
            panelPositions.push(x, y, z - 0.24);
          }
        }
        for (let iy = 0; iy < panelSegmentsY; iy++) {
          for (let ix = 0; ix < panelSegmentsX; ix++) {
            const a = iy * (panelSegmentsX + 1) + ix;
            const b = a + 1;
            const c = a + panelSegmentsX + 1;
            const d = c + 1;
            panelIndices.push(a, c, b, b, c, d);
          }
        }
        const panelGeometry = new THREE.BufferGeometry();
        panelGeometry.setAttribute('position', new THREE.Float32BufferAttribute(panelPositions, 3));
        panelGeometry.setIndex(panelIndices);
        panelGeometry.computeVertexNormals();
        const panel = new THREE.Mesh(
          panelGeometry,
          new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.055, side: THREE.DoubleSide, depthWrite: false })
        );
        const panelEdges = new THREE.LineSegments(
          new THREE.EdgesGeometry(panelGeometry, 0.18),
          new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.22 })
        );
        group.add(panel, panelEdges);

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
        const entry = { id: node.id, group, cube, frame, halo, panel, panelEdges, anchor: p.clone() };
        meshes.push(entry);
        nodeById[node.id] = entry;
        const label = document.createElement('button');
        label.className = 'sphere-node-label';
        label.type = 'button';
        label.innerHTML = '<span class="sphere-label-heading"><i class="sphere-label-dot"></i><span class="sphere-label-name"></span></span><span class="sphere-label-metric"></span><b class="sphere-label-value"></b>';
        label.querySelector('.sphere-label-name').textContent = node.label;
        label.querySelector('.sphere-label-metric').textContent = node.metric;
        label.querySelector('.sphere-label-value').textContent = node.value;
        const breakdown = directionBreakdowns[node.id];
        if (breakdown) {
          const details = document.createElement('span');
          details.className = 'sphere-direction-details';
          const heading = document.createElement('b');
          heading.className = 'sphere-direction-details-title';
          heading.textContent = breakdown.title;
          details.appendChild(heading);
          breakdown.rows.forEach(([keyText, valueText]) => {
            const row = document.createElement('span');
            row.className = 'sphere-direction-details-row';
            const key = document.createElement('span'); key.textContent = keyText;
            const value = document.createElement('b'); value.textContent = valueText;
            row.append(key, value); details.appendChild(row);
          });
          label.appendChild(details);
        }
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
        if (e.target.closest('button, .sphere-node-label, .sphere-zoom-controls')) return;
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
        // Smoothly fly the business layer toward/away from the viewer on every zoom action.
        // The particle shell is intentionally not transformed by this movement.
        const zoomEase = reduced ? 0.22 : 0.075;
        zoomLevel += (targetZoom - zoomLevel) * zoomEase;
        if (Math.abs(targetZoom - zoomLevel) < 0.001) zoomLevel = targetZoom;
        businessElements.scale.setScalar(zoomLevel);
        businessElements.position.z = (zoomLevel - 1) * 6.0;
        businessElements.position.x = (zoomLevel - 1) * -0.22;
        businessElements.position.y = (zoomLevel - 1) * 0.16;
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
            const labelScale = Math.max(0.82, Math.min(2.8, zoomLevel));
            label.style.setProperty('--label-zoom', labelScale.toFixed(2));
            label.style.transform = 'translate(' + ((projected.x * 0.5 + 0.5) * el.clientWidth) + 'px, ' + ((-projected.y * 0.5 + 0.5) * el.clientHeight) + 'px) translate(-50%, -50%) scale(' + labelScale.toFixed(2) + ')';
            // Node names and headline metrics are always visible at every zoom level.
            // Detailed breakdowns open only on the selected node when zoomed in.
            const showMetrics = zoomLevel >= 1.22;
            label.style.opacity = visible ? (active ? '1' : onPath ? '0.96' : '0.82') : '0';
            label.style.pointerEvents = visible ? 'auto' : 'none';
            label.classList.toggle('details-open', active && showMetrics);
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

export default function Universe2() {
  const [selected, setSelected] = useState('finance');
  const [scenarioKey, setScenarioKey] = useState('growth');
  const [showMap, setShowMap] = useState(true);
  const [neonData, setNeonData] = useState(null);
  const [neonStatus, setNeonStatus] = useState('loading');
  const [neonError, setNeonError] = useState('');
  const [showAllMetrics, setShowAllMetrics] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/universe2-data', { cache: 'no-store' })
      .then(async response => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
        return payload;
      })
      .then(payload => {
        if (cancelled) return;
        setNeonData(payload);
        setNeonStatus('connected');
        setNeonError('');
      })
      .catch(error => {
        if (cancelled) return;
        setNeonStatus('error');
        setNeonError(error.message || 'Unable to load Neon data');
      });
    return () => { cancelled = true; };
  }, []);
  const latestMonth = neonData?.months?.[neonData.months.length - 1];
  const firstMonth = neonData?.months?.[0];
  const eur = value => new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(value || 0));
  const growthPct = (first, last) => Number(first) ? `${((Number(last) - Number(first)) / Number(first) * 100).toFixed(1)}%` : '—';
  const active = nodes.find(n => n.id === selected) || nodes[0];
  const scenario = scenarios[scenarioKey];
  const directionData = (() => {
    if (neonStatus !== 'connected' || !latestMonth) return { value: active.value, metric: active.metric, note: active.note };
    const growth = (first, last) => Number(first) ? `${((Number(last) - Number(first)) / Number(first) * 100).toFixed(1)}%` : '—';
    const range = neonData.service_lines?.length ? `${Math.min(...neonData.service_lines.map(x => Number(x.delivery_cost_pct))).toFixed(0)}–${Math.max(...neonData.service_lines.map(x => Number(x.delivery_cost_pct))).toFixed(0)}%` : '—';
    const fmt = value => eur(value);
    const map = {
      procurement: { value: growth(firstMonth?.marketing_spend, latestMonth.marketing_spend), metric: 'Channel spend change', note: `Channel spend: ${fmt(firstMonth?.marketing_spend)} → ${fmt(latestMonth.marketing_spend)}. Compare spend growth with qualified leads and opportunities to assess acquisition efficiency.` },
      production: { value: range, metric: 'Delivery cost by service line', note: `Delivery costs vary by service line (${neonData.service_lines?.map(x => `${x.name}: ${Number(x.delivery_cost_pct).toFixed(0)}%`).join(', ') || 'data unavailable'}). Service mix changes the cost of delivery and operating margin.` },
      marketing: { value: growth(firstMonth?.qualified_leads, latestMonth.qualified_leads), metric: 'Qualified leads change', note: `Qualified leads: ${Number(firstMonth?.qualified_leads || 0)} → ${Number(latestMonth.qualified_leads || 0)}. Channel spend and channel-level conversion rates help explain lead quality and acquisition cost.` },
      sales: { value: growth(firstMonth?.opportunities, latestMonth.opportunities), metric: 'Opportunities change', note: `Opportunities: ${Number(firstMonth?.opportunities || 0)} → ${Number(latestMonth.opportunities || 0)}; won deals: ${Number(firstMonth?.deals_won || 0)} → ${Number(latestMonth.deals_won || 0)}. Lead quality and sales conversion affect recognized revenue.` },
      operations: { value: fmt(neonData.team?.monthly_payroll), metric: 'Monthly payroll', note: `Team capacity: ${Number(neonData.team?.size || 0)} people; monthly payroll: ${fmt(neonData.team?.monthly_payroll)}. Capacity and payroll affect delivery capacity and the fixed cost base.` },
      finance: { value: fmt(latestMonth.recognized_revenue), metric: 'Recognized revenue', note: `Recognized revenue: ${fmt(firstMonth?.recognized_revenue)} → ${fmt(latestMonth.recognized_revenue)}; operating profit in the latest month: ${fmt(latestMonth.operating_profit)} (${Number(latestMonth.operating_margin_pct || 0).toFixed(1)}% margin). Won deals and delivery costs flow into the result.` },
      customers: { value: `${Number(latestMonth.deals_won || 0)} won`, metric: 'Won deals · latest month', note: `Customer receipts: ${fmt(latestMonth.receipts)} in the latest month, alongside ${Number(latestMonth.deals_won || 0)} won deals. Recognized revenue and cash receipts are related but are not the same measure.` }
    };
    return map[active.id] || { value: active.value, metric: active.metric, note: active.note };
  })();
  useEffect(() => {
    document.title = 'Business Universe 2 — NIFINANCE SOLUTION';
    return () => { document.title = 'NIFINANCE SOLUTION — Business Beyond Borders'; };
  }, []);

  return <main className="business-universe3">
    <div className="bu-topbar">
      <a className="bu-brand" href="/"><span className="bu-brand-mark">N</span><span>NIFINANCE <b>BUSINESS UNIVERSE</b></span></a>
      <div className="bu-live-state"><i /> NORTHSTAR GROWTH <span>·</span> DEMO BUSINESS DATA</div>
      <div className="bu-header-hint">DRAG TO EXPLORE <span>·</span> SELECT A BUSINESS DRIVER</div>
    </div>



    <section className="bu-stage-wrap">
      <div className="bu-stage-grid" />
      <BusinessSphere selected={selected} onSelect={setSelected} scenario={scenarioKey} />
      <div className="bu-center-user"><div className="bu-user-orbit" /><div className="bu-user-core"><span>YOU</span><b>◎</b><small>DECISION<br />CENTRE</small></div></div>
      <div className="bu-stage-hud bu-hud-top-left"><span>UNIVERSE / 02</span><b>360°</b></div>
      <div className="bu-stage-hud bu-hud-top-right"><i /> INTERACTIVE MODEL</div>
      <div className="bu-scenario-mini"><button className={scenarioKey === 'growth' ? 'active' : ''} onClick={() => setScenarioKey('growth')}>LEAD GROWTH</button><button className={scenarioKey === 'cash' ? 'active' : ''} onClick={() => setScenarioKey('cash')}>REVENUE VS CASH</button></div>
    </section>

    <section className="bu-analysis" aria-label="Business direction and relationships">
      <div className="bu-analysis-main">
        <div className="bu-section-label"><span>SELECTED DIRECTION / {active.label.toUpperCase()}</span><span>{neonStatus === "connected" ? "LIVE DATA · NEON" : neonStatus === "error" ? "LIVE DATA UNAVAILABLE" : "LOADING DIRECTION DATA"}</span></div>
        <h2>{active.label}: drivers, outcomes and dependencies</h2>
        <div className="bu-direction-summary">
          <div className="bu-direction-kpi"><span>{directionData.metric}</span><strong>{directionData.value}</strong><small>Direction indicator · Jan–Mar</small></div>
          <div className="bu-direction-description"><p>{directionData.note}</p><div className="bu-impact-note"><span className="bu-impact-icon">↗</span><div><b>BUSINESS RELATIONSHIP</b><p>{active.impact}</p></div></div></div>
        </div>
        <div className="bu-section-label bu-relations-heading"><span>CONNECTED DIRECTIONS</span><span>SELECT A DIRECTION TO TRACE THE LINK</span></div>
        <div className="bu-related-directions">
          {active.links.map(id => { const related = nodes.find(n => n.id === id); return related ? <button key={related.id} type="button" className="bu-related-direction" onClick={() => setSelected(related.id)}><i style={{background: related.color}} /><span>{related.label}</span><b>↗</b></button> : null; })}
        </div>
        {neonStatus === "error" && <p className="bu-data-message" role="status">Neon data is temporarily unavailable: {neonError}. Direction relationships remain available.</p>}
      </div>
      <aside className="bu-selected-card">
        <div className="bu-section-label">CAUSE → EFFECT</div>
        <div className="bu-selected-heading"><span className="bu-selected-cube" style={{borderColor: active.color, background: active.color + "22"}} /><div><h3>{active.label}</h3><small>BUSINESS DRIVER</small></div><strong style={{color: active.color}}>{directionData.value}</strong></div>
        <p>{directionData.note}</p>
        <div className="bu-impact-path"><span>HOW IT CONNECTS</span><b>{active.impact}</b></div>
        <div className="bu-connected"><span>RELATED NODES</span><div>{active.links.map(id => { const related = nodes.find(n => n.id === id); return related ? <button key={related.id} type="button" onClick={() => setSelected(related.id)}><i style={{background: related.color}} />{related.label}</button> : null; })}</div></div>
      </aside>
    </section>

  </main>;
}
