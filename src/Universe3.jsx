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

function BusinessSphere({ selected, expandedIds, onSelect, onToggleExpand, onDrilldown, scenario, liveMetrics, detailTrail }) {
  const host = useRef(null);
  const stateRef = useRef({ selected, expandedIds, scenario, onSelect, onToggleExpand, onDrilldown, liveMetrics, detailTrail });
  useEffect(() => { stateRef.current = { selected, expandedIds, scenario, onSelect, onToggleExpand, onDrilldown, liveMetrics, detailTrail }; }, [selected, expandedIds, scenario, onSelect, onToggleExpand, onDrilldown, liveMetrics, detailTrail]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer, scene, camera, frame, shell, network, nodeGroup, raycaster;
    const meshes = [];
    const labels = new Map();
    const labelEls = new Map();
    const labelOffsets = new Map();
    let labelDrag = null;
    let suppressLabelClick = false;
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
        if (universe) {
          universe.classList.toggle('is-zoomed', targetZoom >= 0.8);
          universe.style.setProperty('--universe-zoom', String(targetZoom));
        }
        // The entire 3D scene and its branch overlay share one zoom value.
        // Zoom remains available while exploring; it never changes the camera target.
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
        nodeGroup.add(group);
        const entry = { id: node.id, group, anchor: p.clone() };
        meshes.push(entry);
        nodeById[node.id] = entry;
        const label = document.createElement('div');
        label.className = 'sphere-node-label';
        label.setAttribute('role', 'group');
        label.tabIndex = 0;
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
            const row = document.createElement('button');
            row.type = 'button';
            row.className = 'sphere-direction-details-row';
            row.tabIndex = 0;
            row.setAttribute('role', 'button');
            row.setAttribute('aria-label', `Inspect ${keyText}`);
            const key = document.createElement('span'); key.textContent = keyText;
            const value = document.createElement('b'); value.textContent = valueText;
            row.append(key, value);
            const openDetail = (event) => {
              event.preventDefault();
              event.stopPropagation();
              event.stopImmediatePropagation?.();
              stateRef.current.onDrilldown({ nodeId: node.id, label: keyText, value: valueText });
            };
            row.addEventListener('click', openDetail);
            row.addEventListener('keydown', (event) => {
              if (event.key === 'Enter' || event.key === ' ') openDetail(event);
            });
            details.appendChild(row);
          });
          label.appendChild(details);
        }
        label.style.setProperty('--node-color', node.color);
        labelOffsets.set(node.id, { x: 0, y: 0 });
        label.addEventListener('pointerdown', (event) => {
          // Do not capture the pointer for nested metric controls: capture retargets
          // pointer/click events to the parent card and triggers its collapse handler.
          if (event.target.closest('.sphere-direction-details-row')) return;
          if (event.button !== 0) return;
          labelDrag = { id: node.id, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false };
          suppressLabelClick = false;
          label.setPointerCapture?.(event.pointerId);
        });
        label.addEventListener('pointermove', (event) => {
          if (!labelDrag || labelDrag.id !== node.id || labelDrag.pointerId !== event.pointerId) return;
          const dx = event.clientX - labelDrag.startX;
          const dy = event.clientY - labelDrag.startY;
          if (Math.abs(dx) + Math.abs(dy) > 4) labelDrag.moved = true;
          if (labelDrag.moved) {
            // Move the actual 3D node, not just its HTML card, so every relationship
            // remains physically attached to the block while it is repositioned.
            const entry = nodeById[node.id];
            if (entry) {
              const worldPos = entry.group.getWorldPosition(new THREE.Vector3());
              const depth = Math.max(0.5, -worldPos.z);
              const unitsPerPixel = (2 * depth * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / Math.max(1, el.clientHeight) / Math.max(zoomLevel, 0.25);
              const screenDelta = new THREE.Vector3(event.movementX * unitsPerPixel, -event.movementY * unitsPerPixel, 0);
              const inverseShellRotation = shell.quaternion.clone().invert();
              screenDelta.applyQuaternion(inverseShellRotation);
              entry.group.position.add(screenDelta);
              entry.anchor.copy(entry.group.position);
            }
            suppressLabelClick = true;
          }
        });
        const finishLabelDrag = (event) => {
          if (!labelDrag || labelDrag.id !== node.id || labelDrag.pointerId !== event.pointerId) return;
          if (labelDrag.moved) suppressLabelClick = true;
          labelDrag = null;
        };
        label.addEventListener('pointerup', finishLabelDrag);
        label.addEventListener('pointercancel', finishLabelDrag);
        label.addEventListener('click', (event) => {
          if (suppressLabelClick) { suppressLabelClick = false; return; }
          // A metric row is a separate drilldown control. Never let its click
          // reach the card-level expand/collapse action.
          if (event.target.closest('.sphere-direction-details-row')) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          stateRef.current.onSelect(node.id);
          stateRef.current.onToggleExpand(node.id);
        });
        label.addEventListener('keydown', (event) => {
          if (event.target.closest('.sphere-direction-details-row')) {
            event.stopPropagation();
            return;
          }
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            stateRef.current.onSelect(node.id);
            stateRef.current.onToggleExpand(node.id);
          }
        });
        el.appendChild(label);
        labelEls.set(node.id, label);
      });

      network = new THREE.Group();
      businessElements.add(network);
      const links = [
        ['procurement', 'marketing'], ['procurement', 'finance'], ['procurement', 'production'],
        ['production', 'sales'], ['production', 'finance'], ['operations', 'production'],
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
        const material = new THREE.LineDashedMaterial({ color: 0x78917a, transparent: true, opacity: 0.38, dashSize: 0.075, gapSize: 0.055 });
        const line = new THREE.Line(geometry, material);
        line.computeLineDistances();
        network.add(line);
        linkMeshes.push({ from, to, line, material });
      });

      // A luminous pulse travels through the selected causal chain.
      const pulseGroup = new THREE.Group();
      businessElements.add(pulseGroup);
      const pulses = [];
      const arrowHeads = [];
      for (let i = 0; i < 3; i++) {
        const pulse = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 10), new THREE.MeshBasicMaterial({ color: 0xc9ff78 }));
        pulseGroup.add(pulse);
        pulses.push(pulse);
        const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.19, 8), new THREE.MeshBasicMaterial({ color: 0xc9ff78, transparent: true, opacity: 0.95 }));
        pulseGroup.add(arrow);
        arrowHeads.push(arrow);
      }

      raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      const onClick = (e) => {
        if (suppressClick) { suppressClick = false; return; }
        // Nodes are selected through their always-visible HTML labels.
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
        // Shared by the branch-focus label styling below. Keep this inside the
        // animation frame so the renderer never throws when the branch is opened.
        const trail = stateRef.current.detailTrail || [];
        // Keep the camera at the sphere centre. Drill-down changes the highlighted
        // relationship layer, not the camera pose, so users never lose the overview.
        // Zoom and drag-to-rotate stay available at every branch depth.
        camera.position.set(0, 0, 0);
        camera.lookAt(0, 0, -1);
        linkMeshes.forEach(({ from, to, line, material }) => {
          const highlighted = pathSet.has(from) && pathSet.has(to);
          const selectedNode = stateRef.current.selected;
          const connectedToSelection = from === selectedNode || to === selectedNode;
          material.opacity = highlighted ? 0.95 : connectedToSelection ? 0.52 : 0.16;
          material.color.set(highlighted ? 0xc9ff78 : connectedToSelection ? 0x9ab88d : 0x526b56);
          // Rebuild each curved connection from the current block positions every frame.
          const a = nodeById[from].group.position;
          const b = nodeById[to].group.position;
          const mid = a.clone().add(b).normalize().multiplyScalar(shellRadius * 1.012);
          const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
          const points = curve.getPoints(64);
          const positions = line.geometry.attributes.position;
          points.forEach((point, index) => positions.setXYZ(index, point.x, point.y, point.z));
          positions.needsUpdate = true;
          line.geometry.computeBoundingSphere();
          line.computeLineDistances();
        });
        meshes.forEach((n, i) => {
          const active = n.id === stateRef.current.selected;
          const expanded = stateRef.current.expandedIds.has(n.id);
          const onPath = pathSet.has(n.id);
          const pulse = 1 + Math.sin(t * 2 + i) * 0.05;
          n.group.scale.setScalar(pulse * (active ? 1.35 : onPath ? 1.13 : 1));
          const worldPos = n.group.getWorldPosition(new THREE.Vector3());
          const projected = worldPos.clone().project(camera);
          const visible = projected.z < 1 && projected.z > -1 && worldPos.z < -0.3;
          const label = labelEls.get(n.id);
          if (label) {
            const live = stateRef.current.liveMetrics?.[n.id];
            if (live) {
              const metricEl = label.querySelector('.sphere-label-metric');
              const valueEl = label.querySelector('.sphere-label-value');
              if (metricEl && metricEl.textContent !== live.metric) metricEl.textContent = live.metric;
              if (valueEl && valueEl.textContent !== live.value) valueEl.textContent = live.value;
              const details = label.querySelector('.sphere-direction-details');
              if (details && live.rows) {
                const signature = JSON.stringify([live.title, live.rows]);
                if (details.dataset.signature !== signature) {
                  details.dataset.signature = signature;
                  details.replaceChildren();
                  const heading = document.createElement('b');
                  heading.className = 'sphere-direction-details-title';
                  heading.textContent = live.title;
                  details.appendChild(heading);
                  live.rows.forEach(([keyText, valueText]) => {
                    // Live data refreshes the rows after the initial DOM is built.
                    // Keep these rows real, wired buttons so drilldown works with Neon data too.
                    const row = document.createElement('button');
                    row.type = 'button';
                    row.className = 'sphere-direction-details-row';
                    row.tabIndex = 0;
                    row.setAttribute('aria-label', `Inspect ${keyText}`);
                    const key = document.createElement('span'); key.textContent = keyText;
                    const value = document.createElement('b'); value.textContent = valueText;
                    row.append(key, value);
                    const openDetail = (event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      event.stopImmediatePropagation?.();
                      stateRef.current.onDrilldown({ nodeId: n.id, label: keyText, value: valueText });
                    };
                    row.addEventListener('click', openDetail);
                    row.addEventListener('keydown', (event) => {
                      if (event.key === 'Enter' || event.key === ' ') openDetail(event);
                    });
                    details.appendChild(row);
                  });
                }
              }
            }
            const labelScale = Math.max(0.82, Math.min(2.8, zoomLevel));
            label.style.setProperty('--label-zoom', labelScale.toFixed(2));
            const offset = labelOffsets.get(n.id) || { x: 0, y: 0 };
            label.style.transform = 'translate(' + (((projected.x * 0.5 + 0.5) * el.clientWidth) + offset.x) + 'px, ' + (((-projected.y * 0.5 + 0.5) * el.clientHeight) + offset.y) + 'px) translate(-50%, -50%) scale(' + labelScale.toFixed(2) + ')';
            // Node names and headline metrics are always visible at every zoom level.
            // Keep each user's chosen breakdown open independently; details are available from 80% zoom.
            const showMetrics = zoomLevel >= 0.8;
            // Preserve a dimmed overview behind the selected branch (focus + context).
            // Context nodes stay visible but inactive until the user returns to UNIVERSE.
            label.style.opacity = trail.length ? (visible ? (active ? '0.72' : '0.24') : '0') : (visible ? (active ? '1' : onPath ? '0.98' : '0.32') : '0');
            label.style.pointerEvents = visible && !trail.length ? 'auto' : 'none';
            label.classList.toggle('details-open', expanded && active && showMetrics);
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
              const a = node.group.position;
              const b = next.group.position;
              const mid = a.clone().add(b).normalize().multiplyScalar(shellRadius * 1.012);
              const causalCurve = new THREE.QuadraticBezierCurve3(a, mid, b);
              pulses[i].position.copy(causalCurve.getPoint(alpha));
              pulses[i].visible = true;
              const arrow = arrowHeads[i];
              arrow.position.copy(causalCurve.getPoint(0.76));
              arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), causalCurve.getTangent(0.76).normalize());
              arrow.visible = true;
            } else {
              pulses[i].visible = false;
              arrowHeads[i].visible = false;
            }
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


function SphereBranchGraph({ selected, trail, rows, relatedNodes, onOpenRecord, onSelectNode, onReset, onBack, onBreadcrumb }) {
  const [anchor, setAnchor] = useState({ x: 0, y: 0, ready: false });
  const host = useRef(null);
  useEffect(() => {
    let frame = 0, live = true;
    const measure = () => {
      if (!live) return;
      const root = host.current?.closest('.bu-stage-wrap');
      const node = root?.querySelector('.sphere-node-label.active');
      if (root && node) {
        const rr = root.getBoundingClientRect(), nr = node.getBoundingClientRect();
        const x = nr.left + nr.width / 2 - rr.left, y = nr.top + nr.height / 2 - rr.top;
        setAnchor(previous => previous.ready && Math.abs(previous.x - x) < 2.75 && Math.abs(previous.y - y) < 2.75 ? previous : { x, y, ready: true });
      }
      frame = requestAnimationFrame(measure);
    };
    measure();
    return () => { live = false; cancelAnimationFrame(frame); };
  }, [selected, trail, rows.length]);
  if (!trail.length) return null;
  const current = trail[trail.length - 1];
  const isRecord = Boolean(current.record);
  const branches = isRecord ? relatedNodes : rows;
  const width = host.current?.closest('.bu-stage-wrap')?.clientWidth || 1000;
  const height = host.current?.closest('.bu-stage-wrap')?.clientHeight || 600;
  const startX = anchor.ready ? anchor.x : width * 0.5;
  const startY = anchor.ready ? anchor.y : height * 0.5;
  const childX = startX;
  // Children form a small orbit around the focused node and recede into the sphere.
  const orbitX = Math.min(300, Math.max(145, width * 0.27));
  const orbitY = Math.min(225, Math.max(105, height * 0.27));
  const visibleBranches = branches.slice(0, 8);
  const maxDepth = 999;
  const canContinue = true;
  const children = visibleBranches.map((item, index) => {
    const angle = -Math.PI / 2 + (index / Math.max(visibleBranches.length, 1)) * Math.PI * 2;
    const radius = visibleBranches.length === 1 ? 0.5 : visibleBranches.length < 4 ? 0.78 : 1;
    const depth = 85 + trail.length * 34 + (index % 3) * 12;
    return { item, x: Math.max(92, Math.min(width - 92, startX + Math.cos(angle) * orbitX * radius)), y: Math.max(82, Math.min(height - 82, startY + Math.sin(angle) * orbitY * radius)), depth, scale: Math.max(0.78, 1.0 - trail.length * 0.035 - (index % 3) * 0.025) };
  });
  return <div className="bu-sphere-branch-graph" ref={host} aria-label="Connected business graph">

    <svg className="bu-graph-links" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      {children.map(({item,x,y,depth},index)=><path key={item.id||item.graphNodeId||item.primary||index} className={'bu-graph-link-depth bu-graph-link-depth-'+(index%3)} d={`M ${startX} ${startY} C ${(startX+x)/2} ${startY}, ${(startX+x)/2} ${y}, ${x} ${y}`} />)}
    </svg>
    <button type="button" className="bu-graph-root" style={{left:width/2+(startX-width/2)*(980-42)/980,top:height/2+(startY-height/2)*(980-42)/980,'--branch-depth':'42px'}} onClick={onReset} title="Click to close details"><span>{isRecord?'RECORD NODE':'SELECTED METRIC'}</span><b>{current.label}</b><strong>{current.value||''}</strong></button>
    {children.map(({item,x,y,depth,scale},index)=>isRecord ? <button key={item.id} type="button" className="bu-graph-node bu-graph-related" style={{left:width/2+(x-width/2)*(980+depth)/980,top:height/2+(y-height/2)*(980+depth)/980,'--graph-node-color':item.color,'--branch-depth':(-depth)+'px','--branch-scale':scale}} onClick={()=>canContinue && onSelectNode(item.id)} disabled={!canContinue}><i/><span>{item.label}</span><b>{item.value}</b><small>{canContinue ? 'FOLLOW CONNECTION' : 'DEPTH LIMIT · RETURN TO OVERVIEW'}</small></button> : <button key={(item.graphNodeId||item.primary)+'-'+index} type="button" className="bu-graph-node" style={{left:width/2+(x-width/2)*(980+depth)/980,top:height/2+(y-height/2)*(980+depth)/980,'--graph-node-color':nodes.find(n=>n.id===current.nodeId)?.color||'#c9ff78','--branch-depth':(-depth)+'px','--branch-scale':scale}} title={item.note||item.secondary} onClick={()=>canContinue && onOpenRecord(item)} disabled={!canContinue}><i/><span>{item.primary}</span><b>{item.value}</b><small>{canContinue ? (item.secondary||'SOURCE RECORD') : 'DEPTH LIMIT · RETURN TO OVERVIEW'}</small></button>)}
    {!branches.length&&<div className="bu-graph-empty" style={{left:childX,top:startY}}>No connected records at this level</div>}
    <div className="bu-graph-hint">CLICK A NODE TO SWITCH · CLICK SELECTED NODE TO CLOSE · SCROLL TO ZOOM · DRAG TO ROTATE</div>
  </div>;
}

export default function Universe2() {
  const [selected, setSelected] = useState('finance');
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const toggleExpanded = id => setExpandedIds(previous => previous.has(id) && selected === id ? new Set() : new Set([id]));
  const [scenarioKey, setScenarioKey] = useState('growth');
  const [showMap, setShowMap] = useState(true);
  const [showCausalPanel, setShowCausalPanel] = useState(true);
  const [scenarioAdjustment, setScenarioAdjustment] = useState(0);
  const [neonData, setNeonData] = useState(null);
  const [neonStatus, setNeonStatus] = useState('loading');
  const [neonError, setNeonError] = useState('');
  const [workspaceGraph, setWorkspaceGraph] = useState(null);
  const [workspaceGraphStatus, setWorkspaceGraphStatus] = useState('idle');
  const [detailTrail, setDetailTrail] = useState([]);
  const openDetailWindow = selection => { setSelected(selection.nodeId); setDetailTrail(previous => [...previous, selection]); };
  const goBackDetail = () => setDetailTrail(previous => previous.slice(0, -1));
  const resetDetailTrail = () => setDetailTrail([]);
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
  useEffect(() => {
    let cancelled = false;
    const loadWorkspaceGraph = async () => {
      try {
        const credentials = JSON.parse(localStorage.getItem('nifinance-data-center-credentials-v1') || 'null');
        if (!credentials?.workspaceId || !credentials?.token) { setWorkspaceGraphStatus('no-workspace'); return; }
        setWorkspaceGraphStatus('loading');
        const response = await fetch('/api/universe-graph', { cache: 'no-store', headers: { 'X-Workspace-Id': credentials.workspaceId, 'X-Workspace-Token': credentials.token } });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'Workspace graph unavailable');
        if (!cancelled) { setWorkspaceGraph(payload); setWorkspaceGraphStatus('connected'); }
      } catch (error) { if (!cancelled) setWorkspaceGraphStatus('error'); }
    };
    loadWorkspaceGraph();
    return () => { cancelled = true; };
  }, []);
  const latestMonth = neonData?.months?.[neonData.months.length - 1];
  const firstMonth = neonData?.months?.[0];
  const eur = value => new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(value || 0));
  const growthPct = (first, last) => Number(first) ? `${((Number(last) - Number(first)) / Number(first) * 100).toFixed(1)}%` : '—';
  const latestChannels = (neonData?.channels || []).filter(row => latestMonth && row.month_start === latestMonth.month_start);
  const workspaceCash = workspaceGraph?.financialSummary?.cash;
  const workspaceAccrual = workspaceGraph?.financialSummary?.accrual;
  const formatBasisMoney = (basis, value) => { if (!basis || !basis.transactionCount) return 'No data'; if (value == null) return 'Multiple currencies'; const currency = basis.categories?.[0]?.currency; if (currency && /^[A-Z]{3}$/.test(currency) && currency !== 'UNSPECIFIED') return new Intl.NumberFormat('en-IE',{style:'currency',currency,maximumFractionDigits:0}).format(Number(value)); return Number(value).toLocaleString('en-GB',{maximumFractionDigits:0}) + (currency ? ' '+currency : ''); };

  const liveMetrics = neonStatus !== 'connected' || !firstMonth || !latestMonth ? null : {
    procurement: { metric: 'Marketing spend change', value: growthPct(firstMonth.marketing_spend, latestMonth.marketing_spend), title: 'CHANNEL SPEND', rows: latestChannels.slice().sort((a,b) => b.spend-a.spend).map(x => [x.channel, eur(x.spend)]) },
    production: { metric: 'Delivery cost by service', value: neonData.service_lines?.length ? Math.min(...neonData.service_lines.map(x=>Number(x.delivery_cost_pct))).toFixed(0) + '–' + Math.max(...neonData.service_lines.map(x=>Number(x.delivery_cost_pct))).toFixed(0) + '%' : '—', title: 'DELIVERY COST', rows: (neonData.service_lines || []).map(x => [x.name, Number(x.delivery_cost_pct).toFixed(0) + '%']) },
    marketing: { metric: 'Qualified leads change', value: growthPct(firstMonth.qualified_leads, latestMonth.qualified_leads), title: 'LEADS BY CHANNEL', rows: latestChannels.slice().sort((a,b) => b.qualified_leads-a.qualified_leads).map(x => [x.channel, String(x.qualified_leads)]) },
    sales: workspaceGraphStatus === 'connected' ? { metric: 'Active CRM deals', value: String((workspaceGraph.nodes||[]).filter(n=>n.type==='deal'&&!['won','lost'].includes(n.meta?.stage)).length), title: 'CRM PIPELINE', rows: [['Contacts', String(workspaceGraph.summary?.contacts||0)], ['All CRM deals', String(workspaceGraph.summary?.deals||0)], ['Transactions linked', String(workspaceGraph.summary?.matchedTransactions||0)]] } : { metric: 'Opportunities change', value: growthPct(firstMonth.opportunities, latestMonth.opportunities), title: 'SALES FUNNEL', rows: [['Qualified leads', String(latestMonth.qualified_leads)], ['Opportunities', String(latestMonth.opportunities)], ['Deals won', String(latestMonth.deals_won)], ['Won-deal revenue', eur(latestMonth.recognized_revenue)]] },
    operations: { metric: 'Monthly payroll', value: eur(neonData.team?.monthly_payroll), title: 'TEAM & OPERATIONS', rows: [['Team members', String(neonData.team?.size || 0)], ['Monthly payroll', eur(neonData.team?.monthly_payroll)]] },
    finance: workspaceGraphStatus === 'connected' ? { metric: workspaceGraph.financialSummary?.managementPnl?.status === 'provisional' ? 'Accrual result · provisional' : 'Cash net movement', value: workspaceGraph.financialSummary?.managementPnl?.status === 'provisional' ? formatBasisMoney(workspaceAccrual, workspaceGraph.financialSummary.managementPnl.netResultBeforeValidatedAdjustments) : formatBasisMoney(workspaceCash, workspaceCash?.netCashMovement), title: 'DATA CENTER FINANCE', rows: [['Cash inflows', formatBasisMoney(workspaceCash, workspaceCash?.inflows)], ['Cash outflows', formatBasisMoney(workspaceCash, workspaceCash?.outflows)], ['Cash net movement', formatBasisMoney(workspaceCash, workspaceCash?.netCashMovement)], ['Accrual income', formatBasisMoney(workspaceAccrual, workspaceAccrual?.inflows)], ['Accrual expenses', formatBasisMoney(workspaceAccrual, workspaceAccrual?.outflows)], ['CRM-linked transactions', String(workspaceGraph.summary?.matchedTransactions || 0)]] } : { metric: 'Revenue change', value: growthPct(firstMonth.recognized_revenue, latestMonth.recognized_revenue), title: 'LATEST MONTH', rows: [['Revenue', eur(latestMonth.recognized_revenue)], ['Operating costs', eur(latestMonth.operating_expenses)], ['Operating profit', eur(latestMonth.operating_profit)], ['Margin', Number(latestMonth.operating_margin_pct || 0).toFixed(1) + '%']] },
    customers: workspaceGraphStatus === 'connected' ? { metric: 'CRM contacts', value: String(workspaceGraph.summary?.contacts||0), title: 'CRM RELATIONSHIPS', rows: [['Contacts', String(workspaceGraph.summary?.contacts||0)], ['Deals', String(workspaceGraph.summary?.deals||0)], ['Matched finance records', String(workspaceGraph.summary?.matchedTransactions||0)]] } : { metric: 'Deals won · latest month', value: String(latestMonth.deals_won), title: 'CUSTOMERS & CASH', rows: [['Deals won', String(latestMonth.deals_won)], ['Cash received', eur(latestMonth.receipts)], ['Attributed revenue', eur(latestMonth.attributed_revenue)]] }
  };
  const active = nodes.find(n => n.id === selected) || nodes[0];
  const graphNodeForId = id => {
    if (!workspaceGraph || !id) return null;
    return (workspaceGraph.nodes || []).find(n => n.id === id) || (workspaceGraph.transactions || []).find(n => n.id === id) || null;
  };
  const graphNeighbors = id => {
    if (!workspaceGraph || !id) return [];
    return (workspaceGraph.edges || []).filter(edge => edge.from === id || edge.to === id).map(edge => {
      const otherId = edge.from === id ? edge.to : edge.from;
      const item = graphNodeForId(otherId);
      if (!item) return null;
      const meta = item.meta || item;
      const amount = meta.amount;
      const value = amount == null ? (meta.stage ? String(meta.stage) : meta.status || '') : Number(amount).toLocaleString('en-GB') + ' ' + (meta.currency || 'UNSPECIFIED');
      return { primary: item.label, secondary: (item.type || 'transaction') + ' · ' + edge.label, value, note: meta.description || meta.category || meta.status || '', graphNodeId: item.id, graphEdgeId: edge.id };
    }).filter(Boolean).slice(0, 14);
  };
  const getDetailRows = detailSelection => {
    if (!detailSelection) return [];
    if (detailSelection.graphNodeId && workspaceGraph) return graphNeighbors(detailSelection.graphNodeId);
    if (!neonData) return [];
    const month = latestMonth?.month_start;
    const money = value => eur(value);
    const monthLabel = value => { const d = new Date(`${value}T00:00:00Z`); return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }); };
    if (detailSelection.nodeId === 'procurement' || detailSelection.nodeId === 'marketing') {
      return (neonData.channels || []).filter(x => x.month_start === month && (detailSelection.nodeId !== 'procurement' || x.spend > 0)).map(x => ({ primary: x.channel, secondary: monthLabel(x.month_start), value: detailSelection.nodeId === 'procurement' ? money(x.spend) : `${x.qualified_leads} qualified leads`, note: `${x.impressions.toLocaleString('en-GB')} impressions · ${x.clicks.toLocaleString('en-GB')} clicks · ${x.leads} leads · ${x.opportunities} opportunities · ${x.deals_won} wins · CPL ${money(x.cost_per_lead)} · CPQL ${money(x.cost_per_qualified_lead)}` }));
    }
    if (detailSelection.nodeId === 'sales' || detailSelection.nodeId === 'customers') {
      if (workspaceGraphStatus === 'connected') return (workspaceGraph.nodes || []).filter(n => n.type === (detailSelection.nodeId === 'customers' ? 'contact' : 'deal')).slice(0, 40).map(n => ({ primary: n.label, secondary: n.type.toUpperCase() + ' · ' + (n.meta?.stage || n.meta?.kind || n.meta?.status || 'workspace record'), value: n.meta?.amount == null ? '' : String(n.meta.amount) + ' ' + (n.meta.currency || ''), note: 'Workspace CRM record · select to inspect linked transactions and tasks', graphNodeId: n.id }));
      return (neonData.deals || []).filter(x => x.month_start === month && (detailSelection.nodeId !== 'customers' || x.stage === 'won')).map(x => ({ primary: x.client, secondary: `${x.deal} · ${x.stage.toUpperCase()}`, value: money(x.value), note: `${x.date} · ${x.service_line} · ${x.channel} · ${x.payment_terms_days}-day payment terms` }));
    }
    if (detailSelection.nodeId === 'finance') {
      if (workspaceGraphStatus === 'connected') return (workspaceGraph.transactions || []).slice(0, 40).map(tx => ({ primary: tx.counterparty || tx.label, secondary: (tx.date || 'Undated') + ' · ' + (tx.basis || 'unknown basis'), value: Number(tx.amount || 0).toLocaleString('en-GB') + ' ' + (tx.currency || 'UNSPECIFIED'), note: (tx.category || 'Needs review') + ' · ' + tx.label, graphNodeId: tx.id }));
      return (neonData.transactions || []).filter(x => x.month_start === month).map(x => ({ primary: x.category, secondary: `${x.direction.toUpperCase()} · ${x.status}`, value: money(x.amount), note: `${x.date} · ${x.counterparty} · ${x.description}${x.related_client ? ` · ${x.related_client}` : ''}` }));
    }
    if (detailSelection.nodeId === 'operations') {
      return (neonData.employees || []).map(x => ({ primary: x.name, secondary: `${x.role} · ${x.department}`, value: money(x.monthly_cost), note: `Employment status: ${x.status}` }));
    }
    if (detailSelection.nodeId === 'production') {
      return (neonData.service_lines || []).map(x => ({ primary: x.name, secondary: 'Delivery cost assumption', value: `${x.delivery_cost_pct}%`, note: 'Illustrative service-line delivery cost percentage used in the Northstar Growth model.' }));
    }
    return [];
  };
  const scenario = scenarios[scenarioKey];
  const modeledImpact = (() => {
    const leads = Number(latestMonth?.qualified_leads || 0);
    const opportunities = Number(latestMonth?.opportunities || 0);
    const wins = Number(latestMonth?.deals_won || 0);
    const revenue = Number(latestMonth?.recognized_revenue || 0);
    const extraLeads = leads * scenarioAdjustment / 100;
    const opportunityRate = leads > 0 ? opportunities / leads : 0;
    const winRate = opportunities > 0 ? wins / opportunities : 0;
    const revenuePerWin = wins > 0 ? revenue / wins : 0;
    return { extraLeads, extraOpportunities: extraLeads * opportunityRate, revenueDelta: extraLeads * opportunityRate * winRate * revenuePerWin };
  })();
  const fmtSigned = value => (value > 0 ? '+' : '') + value.toFixed(1);
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
    document.title = 'Business Universe 3 — NIFINANCE SOLUTION';
    return () => { document.title = 'NIFINANCE SOLUTION — Business Beyond Borders'; };
  }, []);

  return <main className="business-universe3">
    <div className="bu-topbar">
      <a className="bu-brand" href="/"><span className="bu-brand-mark">N</span><span>NIFINANCE <b>BUSINESS UNIVERSE</b></span></a>
      <div className="bu-live-state"><i className={workspaceGraphStatus === 'connected' || neonStatus === 'connected' ? 'is-connected' : neonStatus === 'error' ? 'is-error' : ''} /> {workspaceGraphStatus === 'connected' ? 'DATA CENTER ↔ CRM' : 'NORTHSTAR GROWTH'} <span>·</span> {workspaceGraphStatus === 'connected' ? `${workspaceGraph.summary?.transactions || 0} TRANSACTIONS · ${workspaceGraph.summary?.matchedTransactions || 0} CRM MATCHES` : neonStatus === 'connected' ? 'DEMO DATA · NEON CONNECTED' : neonStatus === 'error' ? 'DATA CONNECTION ERROR' : 'LOADING DEMO DATA'}</div>
      <div className="bu-header-hint">DRAG TO EXPLORE <span>·</span> SELECT A BUSINESS DRIVER</div>
    </div>



    <section className={'bu-stage-wrap' + (detailTrail.length ? ' is-exploring-branch' : '')}>
      <div className="bu-stage-grid" />
      <BusinessSphere selected={selected} expandedIds={expandedIds} onSelect={setSelected} onToggleExpand={toggleExpanded} onDrilldown={openDetailWindow} scenario={scenarioKey} liveMetrics={liveMetrics} detailTrail={detailTrail} />
      <div className="bu-center-user"><div className="bu-user-orbit" /><div className="bu-user-core"><span>YOU</span><b>◎</b><small>DECISION<br />CENTRE</small></div></div>
      <div className="bu-stage-hud bu-hud-top-left"><span>UNIVERSE / 03</span><b>360°</b></div>
      <div className="bu-stage-hud bu-hud-top-right"><i /> INTERACTIVE MODEL</div>
      <div className="bu-scenario-mini"><button className={scenarioKey === 'growth' ? 'active' : ''} onClick={() => setScenarioKey('growth')}>LEAD GROWTH</button><button className={scenarioKey === 'cash' ? 'active' : ''} onClick={() => setScenarioKey('cash')}>REVENUE VS CASH</button><button className={showCausalPanel ? 'active' : ''} onClick={() => setShowCausalPanel(value => !value)}>CAUSE MAP {showCausalPanel ? '−' : '+'}</button></div>
      {showCausalPanel && detailTrail.length === 0 && <aside className="bu-causal-panel" aria-label="Causal relationships and scenario model">
        <div className="bu-causal-panel-head"><div><span>CAUSE → EFFECT / {scenarioKey === 'growth' ? 'ACQUISITION' : 'CASH FLOW'}</span><h2>{scenario.title}</h2><p>{scenario.subtitle}</p></div><button type="button" aria-label="Hide cause map" onClick={() => setShowCausalPanel(false)}>×</button></div>
        <div className="bu-causal-confidence"><span className="bu-confidence-dot observed" /> OBSERVED CHANGE <span className="bu-confidence-dot modeled" /> MODELED EFFECT</div>
        <div className="bu-causal-steps">
          {scenario.steps.map((step, index) => {
            const node = nodes.find(item => item.id === step.node) || nodes[0];
            const observed = step.node === 'procurement' ? (firstMonth && latestMonth ? eur(firstMonth.marketing_spend) + ' → ' + eur(latestMonth.marketing_spend) : step.value)
              : step.node === 'marketing' ? (firstMonth && latestMonth ? firstMonth.qualified_leads + ' → ' + latestMonth.qualified_leads : step.value)
              : step.node === 'sales' ? (firstMonth && latestMonth ? firstMonth.opportunities + ' → ' + latestMonth.opportunities : step.value)
              : step.node === 'finance' ? (firstMonth && latestMonth ? eur(firstMonth.recognized_revenue) + ' → ' + eur(latestMonth.recognized_revenue) : step.value)
              : step.node === 'customers' ? (firstMonth && latestMonth ? eur(firstMonth.receipts) + ' → ' + eur(latestMonth.receipts) : step.value)
              : step.value;
            return <React.Fragment key={step.node}>
              <button type="button" className={'bu-causal-step ' + (selected === step.node ? 'selected' : '')} onClick={() => setSelected(step.node)} style={{'--causal-color':node.color}}>
                <span className="bu-causal-step-top"><i>{String(index + 1).padStart(2, '0')}</i><b>{node.label}</b><em>{index === 0 ? 'DRIVER' : index === scenario.steps.length - 1 ? 'OUTCOME' : 'LINKED METRIC'}</em></span>
                <strong>{observed || step.value}</strong><small>{step.label}</small><p>{step.detail}</p>
              </button>
              {index < scenario.steps.length - 1 && <div className="bu-causal-arrow"><span>↓</span><small>{index === 0 ? 'LEADS / COST' : index === 1 ? 'CONVERSION' : 'REVENUE'}</small></div>}
            </React.Fragment>;
          })}
        </div>
        <div className="bu-causal-evidence"><span>WHY THIS MAY BE CONNECTED</span><p>{scenarioKey === 'growth'
          ? 'The demo shows channel spend, qualified leads, opportunities and revenue moving across the same period. This is a useful operating signal, but timing and correlation alone do not prove that one metric caused another.'
          : 'Recognized revenue and cash receipts are recorded separately. Payment terms and collection timing can explain why a won deal does not immediately become cash.'}</p>
          <div className="bu-evidence-status"><b>CONFIDENCE</b><span>{scenarioKey === 'growth' ? 'Observed correlation · causal link not yet verified' : 'Accounting relationship · timing depends on payment terms'}</span></div>
        </div>
        <div className="bu-scenario-model">
          <div className="bu-scenario-model-title"><span>WHAT-IF MODEL</span><b>Marketing spend {scenarioAdjustment > 0 ? '+' : ''}{scenarioAdjustment}%</b></div>
          <input aria-label="Adjust marketing spend scenario" type="range" min="-20" max="20" step="5" value={scenarioAdjustment} onChange={event => setScenarioAdjustment(Number(event.target.value))} />
          <div className="bu-scenario-model-range"><span>−20%</span><span>BASELINE</span><span>+20%</span></div>
          <div className="bu-model-results"><div><small>MODELED LEADS</small><b>{fmtSigned(modeledImpact.extraLeads)} leads</b></div><div><small>MODELED OPPORTUNITIES</small><b>{fmtSigned(modeledImpact.extraOpportunities)}</b></div><div><small>MODELED REVENUE</small><b>{eur(modeledImpact.revenueDelta)}</b></div></div>
          <p className="bu-model-disclaimer">Illustrative scenario only: assumes current lead, opportunity and win rates stay constant. It is not a causal estimate or forecast.</p>
        </div>
      </aside>}
      <SphereBranchGraph
        selected={selected}
        trail={detailTrail}
        rows={detailTrail.length && !detailTrail[detailTrail.length - 1].record ? getDetailRows(detailTrail[detailTrail.length - 1]) : []}
        relatedNodes={detailTrail[detailTrail.length - 1]?.graphNodeId
          ? graphNeighbors(detailTrail[detailTrail.length - 1].graphNodeId).map(row => { const n=graphNodeForId(row.graphNodeId); return { id: row.graphNodeId, label: row.primary, value: row.value, color: n?.meta?.color || (n?.type==='transaction'?'#ffbf69':n?.type==='deal'?'#b9a0ff':'#71dfff') }; })
          : (nodes.find(n => n.id === (detailTrail[detailTrail.length - 1]?.nodeId || selected))?.links || []).map(id => nodes.find(n => n.id === id)).filter(Boolean)}
        onOpenRecord={row => setDetailTrail(previous => {
          const current = previous[previous.length - 1];
          const existing = row.graphNodeId ? previous.findIndex(item => item.graphNodeId === row.graphNodeId) : previous.findIndex(item => item.nodeId === current?.nodeId && item.record?.primary === row.primary);
          if (existing >= 0) return previous.slice(0, existing + 1);
          return [{ nodeId: current?.nodeId || selected, graphNodeId: row.graphNodeId || null, label: row.primary, value: row.value, record: row }];
        })}
        onSelectNode={id => {
          const existing = detailTrail.findIndex(item => item.graphNodeId === id || (!item.graphNodeId && item.nodeId === id));
          if (existing >= 0) { setDetailTrail(previous => previous.length && previous[previous.length - 1].graphNodeId === id ? [] : [previous[existing]]); return; }
          const graphNode = graphNodeForId(id);
          const type = graphNode?.type || '';
          const mappedId = type === 'contact' ? 'customers' : type === 'deal' ? 'sales' : type === 'transaction' ? 'finance' : (nodes.find(n=>n.id===id)?.id || selected);
          const staticNode = nodes.find(n=>n.id===mappedId);
          setSelected(mappedId);
          setExpandedIds(new Set());
          setDetailTrail(previous => [...previous, { nodeId: mappedId, graphNodeId: id, label: graphNode?.label || staticNode?.label || id, value: graphNode?.meta?.amount == null ? (graphNode?.meta?.stage || '') : String(graphNode.meta.amount) + ' ' + (graphNode.meta.currency || '') }]);
        }}
        onReset={resetDetailTrail}
        onBack={goBackDetail}
        onBreadcrumb={index => setDetailTrail(previous => previous.slice(0, index + 1))}
      />

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
