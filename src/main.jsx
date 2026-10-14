import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import './style.css';

function OrbScene() {
  const mountRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let renderer, scene, camera, carousel, stars, frame, envTarget, targetRotation = 0;
    let disposed = false;
    const pointer = { x: 0, y: 0, tx: 0, ty: 0, down: false, lastX: 0, velocity: 0 };
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const objects = [];
    const disposables = [];

    try {
      scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2('#08090d', 0.035);
      camera = new THREE.PerspectiveCamera(34, mount.clientWidth / mount.clientHeight, 0.1, 100);
      camera.position.set(0, 0, 9.2);
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.12;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      mount.appendChild(renderer.domElement);

      // A procedural studio environment gives the polished materials real reflections
      // without relying on external image assets.
      const pmrem = new THREE.PMREMGenerator(renderer);
      const room = new RoomEnvironment();
      envTarget = pmrem.fromScene(room, 0.04);
      scene.environment = envTarget.texture;
      room.dispose();
      pmrem.dispose();

      scene.add(new THREE.HemisphereLight('#dfe6ff', '#14101f', 1.35));
      const key = new THREE.PointLight('#ffffff', 80, 30);
      key.position.set(2.8, 3.4, 5); scene.add(key);
      const coolRim = new THREE.PointLight('#6d8cff', 75, 18);
      coolRim.position.set(-4, 1.4, -2); scene.add(coolRim);
      const cyanRim = new THREE.PointLight('#7bf3e7', 55, 16);
      cyanRim.position.set(3, -2.8, -1); scene.add(cyanRim);
      const warmRim = new THREE.PointLight('#ff9dce', 36, 14);
      warmRim.position.set(-1, 4, 2); scene.add(warmRim);

      carousel = new THREE.Group();
      scene.add(carousel);

      // Three distinct objects orbit on a true carousel path. The front object
      // starts closest to camera; arrow controls rotate the entire collection.

      const chrome = new THREE.MeshPhysicalMaterial({
        color: '#dbe4f7', metalness: 1, roughness: 0.12,
        clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 2.1
      });
      const glass = new THREE.MeshPhysicalMaterial({
        color: '#8c9fff', metalness: 0.28, roughness: 0.08,
        transmission: 0.48, thickness: 1.4, ior: 1.38,
        clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.7,
        transparent: true, opacity: 0.95
      });
      const pearl = new THREE.MeshPhysicalMaterial({
        color: '#e8dfff', metalness: 0.72, roughness: 0.19,
        clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 1.8
      });
      disposables.push(chrome, glass, pearl);

      // Center sculpture: a dense, smooth liquid-metal form with organic displacement.
      const liquidGeo = new THREE.IcosahedronGeometry(1.42, 7);
      const pos = liquidGeo.attributes.position;
      const v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).normalize();
        const wave = 1 + 0.12 * Math.sin(v.x * 4.4 + v.z * 2.2) * Math.cos(v.y * 4.1)
          + 0.055 * Math.sin(v.z * 7.0 + v.y * 2.4);
        pos.setXYZ(i, v.x * wave * 1.42, v.y * wave * 1.42, v.z * wave * 1.42);
      }
      liquidGeo.computeVertexNormals();
      const frontSculpture = new THREE.Group();
      frontSculpture.position.set(0, 0, 2.85);
      const liquid = new THREE.Mesh(liquidGeo, chrome);
      liquid.castShadow = true;
      liquid.position.set(0, 0, 0.15);
      liquid.userData.baseScale = 1;
      frontSculpture.add(liquid); objects.push(liquid); disposables.push(liquidGeo);

      // Sculptural polished loop passing through the liquid form.
      const loopGeo = new THREE.TorusKnotGeometry(1.72, 0.055, 320, 20, 2, 5);
      const loop = new THREE.Mesh(loopGeo, glass);
      loop.scale.set(1, 0.82, 0.78);
      loop.rotation.set(0.72, 0.22, -0.48);
      loop.position.set(0, 0, -0.08);
      frontSculpture.add(loop); objects.push(loop); disposables.push(loopGeo);
      carousel.add(frontSculpture); objects.push(frontSculpture);

      // Two companion objects are positioned around the carousel, with depth and scale
      // changes creating a real three-dimensional gallery rather than a flat row of cards.
      const sideA = new THREE.Group();
      sideA.position.set(-2.47, 0.1, -1.425);
      sideA.scale.setScalar(0.72);
      const crystalGeo = new THREE.OctahedronGeometry(1.24, 4);
      const crystalPos = crystalGeo.attributes.position;
      for (let i = 0; i < crystalPos.count; i++) {
        const x = crystalPos.getX(i), y = crystalPos.getY(i), z = crystalPos.getZ(i);
        const n = 1 + 0.045 * Math.sin(x * 5 + z * 3) * Math.cos(y * 4);
        crystalPos.setXYZ(i, x * n, y * n, z * n);
      }
      crystalGeo.computeVertexNormals();
      const crystal = new THREE.Mesh(crystalGeo, pearl);
      crystal.rotation.set(0.2, 0.5, 0.2);
      sideA.add(crystal); carousel.add(sideA); objects.push(sideA); disposables.push(crystalGeo);

      const sideB = new THREE.Group();
      sideB.position.set(2.47, -0.15, -1.425);
      sideB.scale.setScalar(0.72);
      const torusGeo = new THREE.TorusGeometry(1.02, 0.26, 48, 180);
      const torus = new THREE.Mesh(torusGeo, chrome);
      torus.rotation.set(1.02, 0.3, 0.45);
      sideB.add(torus);
      const innerGeo = new THREE.SphereGeometry(0.45, 64, 48);
      const inner = new THREE.Mesh(innerGeo, glass);
      inner.position.set(0.15, 0.05, 0.18);
      sideB.add(inner); carousel.add(sideB); objects.push(sideB); disposables.push(torusGeo, innerGeo);

      // Thin orbital arcs and precision markers add scale without turning the scene into a wireframe toy.
      const arcMaterial = new THREE.MeshBasicMaterial({ color: '#a8b5ff', transparent: true, opacity: 0.4 });
      const arc = new THREE.Mesh(new THREE.TorusGeometry(2.28, 0.006, 8, 240), arcMaterial);
      arc.rotation.set(1.13, 0.18, -0.28);
      carousel.add(arc); disposables.push(arc.geometry, arcMaterial);
      const arc2Material = new THREE.MeshBasicMaterial({ color: '#78eee7', transparent: true, opacity: 0.24 });
      const arc2 = new THREE.Mesh(new THREE.TorusGeometry(2.48, 0.004, 8, 240), arc2Material);
      arc2.rotation.set(0.24, 1.0, 0.62);
      carousel.add(arc2); disposables.push(arc2.geometry, arc2Material);

      // Dust-like particles are tiny, varied, and softly lit; no pixel-like oversized dots.
      const count = 1200;
      const points = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const radius = 3.0 + Math.random() * 6.2;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        points[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
        points[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
        points[i * 3 + 2] = radius * Math.cos(phi) - 1.0;
      }
      const starGeo = new THREE.BufferGeometry();
      starGeo.setAttribute('position', new THREE.BufferAttribute(points, 3));
      stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
        color: '#c8d0ff', size: 0.012, transparent: true, opacity: 0.5,
        sizeAttenuation: true, depthWrite: false
      }));
      scene.add(stars); disposables.push(starGeo, stars.material);

      const onSlide = (e) => {
        const index = Number(e.detail?.index || 0);
        targetRotation = -index * Math.PI * 2 / 3;
      };
      mount.addEventListener('afterglow-slide', onSlide);

      const onPointer = (e) => {
        const rect = mount.getBoundingClientRect();
        pointer.tx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
        pointer.ty = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
        if (pointer.down) {
          const dx = e.clientX - pointer.lastX;
          pointer.velocity = dx * 0.004;
          targetRotation += dx * 0.004;
          carousel.rotation.y += dx * 0.004;
          pointer.lastX = e.clientX;
        }
      };
      const onDown = (e) => { pointer.down = true; pointer.lastX = e.clientX; mount.setPointerCapture?.(e.pointerId); };
      const onUp = () => { pointer.down = false; };
      const onLeave = () => { pointer.tx = 0; pointer.ty = 0; pointer.down = false; };
      mount.addEventListener('pointermove', onPointer);
      mount.addEventListener('pointerdown', onDown);
      mount.addEventListener('pointerup', onUp);
      mount.addEventListener('pointercancel', onUp);
      mount.addEventListener('pointerleave', onLeave);

      const resize = () => {
        if (!mount.clientWidth || !mount.clientHeight) return;
        camera.aspect = mount.clientWidth / mount.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(mount.clientWidth, mount.clientHeight);
      };
      const observer = new ResizeObserver(resize);
      observer.observe(mount);
      const clock = new THREE.Clock();
      const animate = () => {
        if (disposed) return;
        frame = requestAnimationFrame(animate);
        const t = clock.getElapsedTime();
        pointer.x += (pointer.tx - pointer.x) * 0.035;
        pointer.y += (pointer.ty - pointer.y) * 0.035;
        if (!reduced && !pointer.down) {
          targetRotation += 0.0018 + pointer.velocity * 0.08;
          carousel.rotation.y += (targetRotation - carousel.rotation.y) * 0.012;
          pointer.velocity *= 0.94;
        }
        carousel.rotation.x += ((pointer.y * 0.09) - carousel.rotation.x) * 0.025;
        carousel.position.x += (pointer.x * 0.12 - carousel.position.x) * 0.025;
        frontSculpture.scale.setScalar(0.72 + 0.28 * Math.max(0, Math.cos(carousel.rotation.y)));
        sideA.scale.setScalar(0.72 + 0.28 * Math.max(0, Math.cos(carousel.rotation.y - Math.PI * 2 / 3)));
        sideB.scale.setScalar(0.72 + 0.28 * Math.max(0, Math.cos(carousel.rotation.y + Math.PI * 2 / 3)));
        liquid.rotation.y = reduced ? 0 : t * 0.16;
        liquid.rotation.z = Math.sin(t * 0.32) * 0.09;
        liquid.scale.setScalar(1 + (reduced ? 0 : Math.sin(t * 0.8) * 0.018));
        loop.rotation.y = -t * (reduced ? 0 : 0.12);
        loop.rotation.x = 0.72 + Math.sin(t * 0.26) * 0.06;
        sideA.rotation.y = t * (reduced ? 0 : 0.12);
        sideA.rotation.z = Math.sin(t * 0.42) * 0.08;
        sideB.rotation.y = -t * (reduced ? 0 : 0.1);
        sideB.rotation.x = Math.sin(t * 0.36) * 0.08;
        arc.rotation.z = -0.28 + t * (reduced ? 0 : 0.045);
        arc2.rotation.y = 1.0 + t * (reduced ? 0 : 0.035);
        stars.rotation.y = pointer.x * 0.012 + (reduced ? 0 : t * 0.002);
        stars.rotation.x = pointer.y * 0.008;
        renderer.render(scene, camera);
      };
      animate();
      setReady(true);

      return () => {
        disposed = true;
        cancelAnimationFrame(frame);
        observer.disconnect();
        mount.removeEventListener('afterglow-slide', onSlide);
        mount.removeEventListener('pointermove', onPointer);
        mount.removeEventListener('pointerdown', onDown);
        mount.removeEventListener('pointerup', onUp);
        mount.removeEventListener('pointercancel', onUp);
        mount.removeEventListener('pointerleave', onLeave);
        disposables.forEach((item) => item?.dispose?.());
        envTarget?.dispose();
        renderer.dispose();
        if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
      };
    } catch (err) {
      console.error('3D scene could not be initialized:', err);
      setReady(false);
    }
  }, []);

  const slides = [
    { number: '01', name: 'LIQUID CHROME', note: 'REFLECTION / FORM' },
    { number: '02', name: 'CRYSTAL STUDY', note: 'LIGHT / REFRACTION' },
    { number: '03', name: 'SOFT MACHINE', note: 'MOTION / MATTER' },
  ];
  const selectSlide = (index) => {
    const next = (index + slides.length) % slides.length;
    setActiveSlide(next);
    const mount = mountRef.current;
    if (mount) mount.dispatchEvent(new CustomEvent('afterglow-slide', { detail: { index: next } }));
  };
  const changeSlide = (direction) => selectSlide(activeSlide + direction);

  return <div className="orb-stage">
    <div className="orb-scene" ref={mountRef} aria-label="Interactive 3D carousel of reflective sculptures. Drag to rotate." />
    {!ready && <div className="scene-fallback"><div className="fallback-orb" /></div>}
    <div className="carousel-ui">
      <div className="carousel-caption"><span>{slides[activeSlide].number} / 03</span><strong>{slides[activeSlide].name}</strong><small>{slides[activeSlide].note}</small></div>
      <div className="carousel-controls"><button type="button" aria-label="Previous 3D object" onClick={() => changeSlide(-1)}>←</button><div className="carousel-track">{slides.map((slide, i) => <button type="button" aria-label={`Show ${slide.name}`} className={i === activeSlide ? 'active' : ''} key={slide.number} onClick={() => selectSlide(i)} />)}</div><button type="button" aria-label="Next 3D object" onClick={() => changeSlide(1)}>→</button></div>
    </div>
  </div>;
}

function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [active, setActive] = useState('01');
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => setScrollProgress(window.scrollY / Math.max(1, document.documentElement.scrollHeight - window.innerHeight));
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const jumpTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMenuOpen(false);
  };

  return <main>
    <div className="progress-line" style={{ transform: `scaleX(${scrollProgress})` }} />
    <header className="topbar">
      <a href="#home" className="brand" aria-label="Afterglow home"><span className="brand-mark">A</span><span>AFTERGLOW<span className="brand-dot">.</span></span></a>
      <div className="top-meta"><span className="status-dot" /> DIGITAL ARTIFACTS / VOL. 001</div>
      <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen}>
        {menuOpen ? 'CLOSE' : 'MENU'} <span className={menuOpen ? 'menu-icon open' : 'menu-icon'}><i/><i/></span>
      </button>
    </header>

    {menuOpen && <nav className="menu-panel">
      <button onClick={() => jumpTo('home')}>01 / Home</button>
      <button onClick={() => jumpTo('manifesto')}>02 / Manifesto</button>
      <button onClick={() => jumpTo('experiments')}>03 / Experiments</button>
      <button onClick={() => jumpTo('contact')}>04 / Contact</button>
    </nav>}

    <section className="hero" id="home">
      <div className="hero-grid" />
      <div className="hero-copy">
        <div className="eyebrow reveal"><span className="eyebrow-line" /> INDEPENDENT DIGITAL UNIVERSE</div>
        <h1 className="hero-title"><span>BEYOND</span><span className="title-second">THE <em>VISIBLE</em><sup>®</sup></span></h1>
        <p className="hero-description">A living gallery of digital matter.<br/>Sculpted by light, motion and code.</p>
        <div className="hero-actions">
          <button className="pill-button primary" onClick={() => jumpTo('experiments')}>EXPLORE THE UNKNOWN <span>↗</span></button>
          <span className="sound-toggle" aria-label="Interactive 3D object"><span className="sound-bars"><i/><i/><i/><i/></span> MOVE TO INTERACT</span>
        </div>
      </div>
      <div className="orb-label label-top"><span>FIG. 001</span><span>MATTER / LIGHT</span></div>
      <OrbScene />
      <div className="orb-label label-bottom"><span>INTERACTIVE OBJECT</span><span>DRAG TO ROTATE</span></div>
      <div className="hero-index"><span>01</span><span className="index-line" /><span>04</span></div>
      <div className="scroll-cue"><span>SCROLL TO DISCOVER</span><span className="scroll-arrow">↓</span></div>
      <div className="hero-side-note">NOTHING IS<br/>AS IT SEEMS</div>
    </section>

    <section className="manifesto section-pad" id="manifesto">
      <div className="section-kicker"><span>02 — THE IDEA</span><span>FORM FOLLOWS FEELING</span></div>
      <div className="manifesto-layout">
        <h2>Reality is just<br/>a <span className="outline-text">starting point.</span></h2>
        <div className="manifesto-aside"><div className="asterisk">✳</div><p>We turn code into atmosphere. Algorithms become texture. Tiny interactions become moments you remember.</p><a href="#experiments" className="text-link" onClick={(e) => {e.preventDefault(); jumpTo('experiments')}}>MEET THE EXPERIMENTS <span>↘</span></a></div>
      </div>
      <div className="manifesto-bottom"><span>GENERATIVE BY NATURE</span><span>01 / 03</span><span>MADE OF PURE CODE</span></div>
    </section>

    <section className="experiments section-pad" id="experiments">
      <div className="section-kicker"><span>03 — THE PLAYGROUND</span><span>SELECT AN EXPERIMENT</span></div>
      <div className="experiments-heading"><h2>Small worlds.<br/><em>Infinite</em> possibilities.</h2><p>Move your cursor. Stay a while.<br/>Every detail is alive.</p></div>
      <div className="experiment-grid">
        <button className={`experiment-card card-one ${active === '01' ? 'selected' : ''}`} onMouseEnter={() => setActive('01')} onClick={() => setActive('01')}>
          <div className="card-art art-aurora"><div className="aurora-ring ring-a"/><div className="aurora-ring ring-b"/><div className="aurora-core"/></div>
          <div className="card-info"><span>01 / CHROMATIC FIELD</span><span>↗</span></div><h3>Light, in motion.</h3><p>A study in color, depth and the unseen forces between them.</p>
        </button>
        <button className={`experiment-card card-two ${active === '02' ? 'selected' : ''}`} onMouseEnter={() => setActive('02')} onClick={() => setActive('02')}>
          <div className="card-art art-particles"><div className="particle-orbit orbit-a"/><div className="particle-orbit orbit-b"/><div className="particle-core"/></div>
          <div className="card-info"><span>02 / SOFT MACHINES</span><span>↗</span></div><h3>Order from chaos.</h3><p>Emergent patterns shaped by simple rules and unexpected collisions.</p>
        </button>
        <button className={`experiment-card card-three ${active === '03' ? 'selected' : ''}`} onMouseEnter={() => setActive('03')} onClick={() => setActive('03')}>
          <div className="card-art art-wave"><div className="wave-grid"/></div>
          <div className="card-info"><span>03 / FLUID STUDY</span><span>↗</span></div><h3>Touch the invisible.</h3><p>Digital matter that bends, breathes and responds to your presence.</p>
        </button>
      </div>
      <div className="experiment-footer"><span>3 EXPERIMENTS IN THIS COLLECTION</span><span>MORE WORLDS LOADING <span className="loading-dots">•••</span></span></div>
    </section>

    <section className="statement">
      <div className="statement-glow"/>
      <span className="statement-kicker">A NOTE FROM THE OTHER SIDE</span>
      <p>“The future is not a place<br/>we arrive at. It is a thing<br/><em>we make visible.</em>”</p>
      <span className="statement-signature">— AFTERGLOW STUDIO</span>
      <div className="statement-orbit orbit-one"/><div className="statement-orbit orbit-two"/>
    </section>

    <section className="contact section-pad" id="contact">
      <div className="section-kicker"><span>04 — THE NEXT CHAPTER</span><span>OPEN TRANSMISSION</span></div>
      <div className="contact-layout"><h2>Have a strange<br/>idea? <em>Good.</em></h2><div className="contact-cta"><p>We like ideas that don't fit neatly in a box. Tell us what you're imagining.</p><a className="pill-button primary" href="mailto:hello@afterglow.studio">START A CONVERSATION <span>↗</span></a></div></div>
      <div className="footer-line"><a href="#home" className="brand"><span className="brand-mark">A</span><span>AFTERGLOW<span className="brand-dot">.</span></span></a><span>DESIGNED IN THE IN-BETWEEN</span><span>© 2026 — A DIGITAL EXPERIMENT</span><a href="#home" className="back-top">BACK TO TOP ↑</a></div>
    </section>
  </main>;
}

createRoot(document.getElementById('root')).render(<App />);
