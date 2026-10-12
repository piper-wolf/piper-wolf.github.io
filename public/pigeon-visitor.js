// Fetched only after load + idle. Native animations, no dependencies or frame loop.
const bird = document.querySelector('.pigeon-visitor');
const perch = document.querySelector('.pigeon-perch');
const motion = matchMedia('(prefers-reduced-motion: reduce)');

if (bird && perch) {
  const size = 40;
  const feet = 58 * size / 64;
  let flightTimer, idleTimer, idleEnd, scrollTimer, flight, position;
  let lastIdle = -1;

  const stopIdle = () => {
    clearTimeout(idleTimer);
    clearTimeout(idleEnd);
    delete bird.dataset.idle;
  };
  const cancel = () => {
    clearTimeout(flightTimer);
    stopIdle();
    if (flight) {
      flight.onfinish = null;
      flight.cancel();
      flight = undefined;
    }
    delete bird.dataset.flying;
  };
  const hide = () => {
    cancel();
    perch.style.visibility = 'hidden';
    delete bird.dataset.enhanced;
  };

  const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  const places = () => {
    const width = document.documentElement.clientWidth;
    // Text and controls are off limits, including their touch targets. Image-link
    // wrappers include the frame border, so test the actual image pixels instead.
    const blockers = [...document.querySelectorAll('header a, main a, main p, main h1, main h2, main h3, main time, main figcaption, main img, button, input, select, textarea, footer')]
      .filter((el) => !el.querySelector('img'))
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width && r.height && r.bottom > 0 && r.top < innerHeight);
    const result = [];
    for (const element of document.querySelectorAll('[data-pigeon-landing]')) {
      const rect = element.getBoundingClientRect();
      const header = element.dataset.pigeonLanding === 'header';
      const line = header ? rect.bottom - 1 : rect.top;
      let left = Math.max(12, rect.left + 12);
      let right = Math.min(width - 12, rect.right - 12);
      if (header) {
        left = Math.max(left, element.firstElementChild.getBoundingClientRect().right + 12);
        right = Math.min(right, element.querySelector('nav').getBoundingClientRect().left - 12);
      }
      // Clearance includes the peck/head extension and half-wing stretch.
      if (right - left < 64 || line - feet < 8 || line + 8 > innerHeight) continue;
      for (const fraction of [0.2, 0.5, 0.8]) {
        const x = left + 12 + (right - left - 64) * fraction;
        const y = line - feet;
        const clearance = { left: x - 10, right: x + size + 14, top: y - 6, bottom: line + 3 };
        if (!blockers.some((r) => overlaps(clearance, r))) result.push({ x, y, element, fraction });
      }
    }
    return result;
  };

  const transform = (point) => `translate(${point.x}px, ${point.y}px)`;
  const idle = () => {
    if (document.hidden || motion.matches || flight || !position) return;
    // Never repeat the last action; breathing/blinking continue between gestures.
    lastIdle = (lastIdle + 1 + Math.floor(Math.random() * 2)) % 3;
    bird.dataset.idle = ['look', 'peck', 'stretch'][lastIdle];
    idleEnd = setTimeout(() => { delete bird.dataset.idle; scheduleIdle(); }, 1900);
  };
  const scheduleIdle = () => { idleTimer = setTimeout(idle, 6000 + Math.random() * 8000); };
  const scheduleFlight = () => { flightTimer = setTimeout(flutter, 30000 + Math.random() * 30000); };

  const flutter = () => {
    if (document.hidden || motion.matches || !position) return;
    const targets = places().filter((p) => Math.hypot(p.x - position.x, p.y - position.y) > 60);
    if (!targets.length) { scheduleFlight(); return; }
    // Prefer another horizontal edge, but a short hop along this one is fine.
    const otherEdges = targets.filter((p) => p.element !== position.element);
    const choices = otherEdges.length ? otherEdges : targets;
    const destination = choices[Math.floor(Math.random() * choices.length)];
    const from = position;
    stopIdle();
    bird.querySelector('svg').style.transform = destination.x >= from.x ? '' : 'scaleX(-1)';
    const distance = Math.hypot(destination.x - from.x, destination.y - from.y);
    const duration = Math.min(2600, 1600 + distance * 1.2);
    const rise = Math.min(110, 40 + distance * 0.12);
    bird.style.setProperty('--flight-duration', `${duration}ms`);
    bird.dataset.flying = '';
    const frames = [0, 0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 0.95, 1].map((t) => ({
      offset: t,
      transform: transform({
        x: from.x + (destination.x - from.x) * t,
        y: Math.max(8, from.y + (destination.y - from.y) * t - Math.sin(Math.PI * t) * rise),
      }),
    }));
    flight = bird.animate(frames, { duration, easing: 'ease-in-out' });
    flight.onfinish = () => {
      position = destination;
      bird.style.transform = transform(position);
      delete bird.dataset.flying;
      flight = undefined;
      scheduleIdle();
      scheduleFlight();
    };
  };

  const reset = () => {
    clearTimeout(scrollTimer);
    hide();
    if (motion.matches || document.hidden) return;
    const targets = places();
    // Keep the same spot on the same edge during resize/image loading/scroll.
    position = targets.find((p) => p.element === position?.element && p.fraction === position.fraction) ?? targets[0];
    if (!position) return;
    bird.style.transform = transform(position);
    perch.style.visibility = 'visible';
    bird.dataset.enhanced = '';
    scheduleIdle();
    scheduleFlight();
  };
  window.addEventListener('resize', reset, { passive: true });
  // Do not leave a fixed bird floating over content while its edge scrolls away.
  window.addEventListener('scroll', () => {
    hide();
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(reset, 150);
  }, { passive: true });
  document.addEventListener('visibilitychange', reset);
  motion.addEventListener('change', reset);
  window.addEventListener('pagehide', () => { clearTimeout(scrollTimer); hide(); });
  window.addEventListener('pageshow', reset);
  reset();
}
