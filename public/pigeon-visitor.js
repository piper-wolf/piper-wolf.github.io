// Optional enhancement: fetched only after load + idle. No dependencies or frame loop.
const bird = document.querySelector('.pigeon-visitor');
const perch = document.querySelector('.pigeon-perch');
const motion = matchMedia('(prefers-reduced-motion: reduce)');

if (bird && perch && !motion.matches) {
  let timer;
  let flight;
  let bob;
  let position;
  let right = false;

  const cancel = () => {
    clearTimeout(timer);
    if (flight) {
      flight.onfinish = null;
      flight.cancel();
      flight = undefined;
    }
    bob?.cancel();
    bird.removeAttribute('data-flying');
  };

  const home = () => {
    cancel();
    bird.style.cssText = '';
    position = undefined;
    right = false;
    delete bird.dataset.enhanced;
  };

  // Only use viewport gutters wide enough to contain the entire bird + clearance.
  // Otherwise it stays within the footer's dedicated, empty 64px strip.
  const places = () => {
    const content = document.querySelector('main').getBoundingClientRect();
    const width = document.documentElement.clientWidth;
    if (Math.min(content.left, width - content.right) >= 64) {
      bird.style.position = 'fixed';
      bird.style.left = '0';
      bird.style.top = '0';
      return [
        { x: content.left - 52, y: Math.min(innerHeight * 0.3, Math.max(0, innerHeight - 48)) },
        { x: content.left - 52, y: Math.min(innerHeight * 0.65, Math.max(0, innerHeight - 48)) },
      ];
    }
    bird.style.position = 'absolute';
    bird.style.left = '0';
    bird.style.top = '0';
    return [
      { x: Math.max(0, perch.clientWidth * 0.25 - 20), y: 12 },
      { x: Math.max(0, perch.clientWidth * 0.75 - 20), y: 12 },
    ];
  };

  const transform = (point) => `translate(${point.x}px, ${point.y}px)`;
  const schedule = () => {
    if (document.hidden || motion.matches) return;
    timer = setTimeout(flutter, 30000 + Math.random() * 30000);
  };

  const flutter = () => {
    if (document.hidden || motion.matches) return;
    const targets = places();
    // Narrow screens: don't animate an offscreen footer.
    if (bird.style.position !== 'fixed') {
      const rect = perch.getBoundingClientRect();
      if (rect.top < 0 || rect.bottom > innerHeight) { schedule(); return; }
    }
    right = !right;
    const destination = targets[Number(right)];
    const from = position;
    bird.querySelector('svg').style.transform = right ? '' : 'scaleX(-1)';
    bird.setAttribute('data-flying', '');
    flight = bird.animate([
      { transform: transform(from) },
      { transform: transform({ x: (from.x + destination.x) / 2, y: Math.min(from.y, destination.y) - 8 }) },
      { transform: transform(destination) },
    ], { duration: 1600, easing: 'ease-in-out' });
    flight.onfinish = () => {
      position = destination;
      bird.style.transform = transform(position);
      bird.removeAttribute('data-flying');
      flight = undefined;
      bob = bird.querySelector('.pigeon-head').animate([
        { transform: 'rotate(0)' }, { transform: 'rotate(8deg)' }, { transform: 'rotate(0)' },
      ], { duration: 450 });
      schedule();
    };
  };

  const reset = () => {
    home();
    if (motion.matches || document.hidden) return;
    position = places()[0];
    bird.style.transform = transform(position);
    bird.dataset.enhanced = '';
    schedule();
  };
  window.addEventListener('resize', reset, { passive: true });
  document.addEventListener('visibilitychange', reset);
  motion.addEventListener('change', reset);
  window.addEventListener('pagehide', home);
  window.addEventListener('pageshow', reset);
  reset();
}
