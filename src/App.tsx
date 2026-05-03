import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

const FROG_SPRITE = "/assets/hop_sheet.png";
const RIBBET_AUDIO = "/assets/ribbet.wav";

type FrogConfig = {
  id: number;
  size: number;
  x: number;
  y: number;
  triggerDistance: number;
  comfortDistance: number;
  maxJumpDistance: number;
  landingSpread: number;
  overshootDistance: number;
  jumpDuration: number;
  jumpArc: number;
  restRotation: number;
  jumpRotation: number;
  jumpCooldown: number;
  reactionDelayMin: number;
  reactionDelayMax: number;
  nextJumpAt: number;
  pendingJumpAt: number | null;
  isJumping: boolean;
  rotation: number;
  flipped: boolean;
};

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getInitialPosition(isFirst = false) {
  if (typeof window === "undefined") {
    return { x: 0, y: 0 };
  }

  return {
    x: isFirst ? window.innerWidth / 2 - 30 : window.innerWidth / 2,
    y: isFirst ? window.innerHeight / 2 - 44 : window.innerHeight / 2,
  };
}

function createFrogConfig(id: number, isFirst = false): FrogConfig {
  const position = getInitialPosition(isFirst);

  return {
    id,
    size: isFirst ? 58 : randomBetween(42, 74),
    x: position.x,
    y: position.y,
    triggerDistance: isFirst ? 170 : randomBetween(120, 230),
    comfortDistance: isFirst ? 70 : randomBetween(48, 110),
    maxJumpDistance: isFirst ? 240 : randomBetween(170, 320),
    landingSpread: isFirst ? 115 : randomBetween(90, 220),
    overshootDistance: isFirst ? 95 : randomBetween(70, 180),
    jumpDuration: isFirst ? 0.42 : randomBetween(0.34, 0.62),
    jumpArc: isFirst ? 26 : randomBetween(18, 42),
    restRotation: isFirst ? -8 : randomBetween(-18, 18),
    jumpRotation: randomBetween(-10, 10),
    jumpCooldown: isFirst ? 220 : randomBetween(180, 420),
    reactionDelayMin: isFirst ? 30 : randomBetween(60, 180),
    reactionDelayMax: isFirst ? 180 : randomBetween(260, 680),
    nextJumpAt: 0,
    pendingJumpAt: null,
    isJumping: false,
    rotation: isFirst ? -8 : randomBetween(-18, 18),
    flipped: !isFirst && Math.random() > 0.5,
  };
}

function CursorFrog({ frog }: { frog: FrogConfig }) {
  return (
    <motion.div
      aria-hidden="true"
      css={{
        position: "absolute",
        top: 0,
        left: 0,
        width: `${frog.size}px`,
        height: `${frog.size}px`,
        backgroundImage: `url(${FROG_SPRITE})`,
        backgroundPosition: "0% 0%",
        backgroundRepeat: "no-repeat",
        backgroundSize: "300% 100%",
        imageRendering: "pixelated",
        animation: frog.isJumping
          ? `frog-hop-frames ${frog.jumpDuration}s steps(2, end) forwards`
          : "none",
        userSelect: "none",
        transformOrigin: "center",
        filter: "drop-shadow(0 10px 14px rgba(0, 0, 0, 0.28))",
      }}
      initial={false}
      animate={{
        x: frog.x,
        y: frog.isJumping ? [null, frog.y - frog.jumpArc, frog.y] : frog.y,
        rotate: frog.rotation,
        scaleX: frog.flipped ? -1 : 1,
        translateX: "-50%",
        translateY: "-50%",
      }}
      transition={{
        x: { duration: frog.jumpDuration, ease: "easeOut" },
        y: {
          duration: frog.jumpDuration,
          ease: ["easeOut", "easeIn"],
          times: [0, 0.45, 1],
        },
        rotate: { duration: frog.jumpDuration, ease: "easeOut" },
      }}
    />
  );
}

function App() {
  const pointerRef = useRef(getInitialPosition());
  const jumpAudioRef = useRef<HTMLAudioElement | null>(null);
  const nextFrogId = useRef(1);
  const jumpTimeouts = useRef<ReturnType<typeof window.setTimeout>[]>([]);
  const [frogs, setFrogs] = useState<FrogConfig[]>(() => [
    createFrogConfig(0, true),
  ]);
  const frogsRef = useRef(frogs);

  useEffect(() => {
    jumpAudioRef.current = new Audio(RIBBET_AUDIO);
    jumpAudioRef.current.volume = 0.14;

    const updatePointer = (clientX: number, clientY: number) => {
      pointerRef.current = { x: clientX, y: clientY };
    };

    const handlePointerMove = (event: PointerEvent) => {
      updatePointer(event.clientX, event.clientY);
    };

    const handleTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (touch) {
        updatePointer(touch.clientX, touch.clientY);
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("touchmove", handleTouchMove, { passive: true });

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("touchmove", handleTouchMove);
    };
  }, []);

  const croak = () => {
    const audio = jumpAudioRef.current;
    if (!audio) {
      return;
    }

    const croakAudio = audio.cloneNode() as HTMLAudioElement;
    croakAudio.volume = 0.14;
    croakAudio.play().catch(() => {});
  };

  const spawnFrog = () => {
    const id = nextFrogId.current;
    nextFrogId.current += 1;
    setFrogs((currentFrogs) => {
      const nextFrogs = [...currentFrogs, createFrogConfig(id)];
      frogsRef.current = nextFrogs;
      return nextFrogs;
    });
  };

  useEffect(() => {
    let frameId = 0;

    const scheduleJumpSettled = (frog: FrogConfig) => {
      const timeoutId = window.setTimeout(() => {
        const nextFrogs = frogsRef.current.map((currentFrog) =>
          currentFrog.id === frog.id
            ? {
                ...currentFrog,
                isJumping: false,
                rotation: currentFrog.restRotation,
              }
            : currentFrog,
        );

        frogsRef.current = nextFrogs;
        setFrogs(nextFrogs);
      }, frog.jumpDuration * 1000);

      jumpTimeouts.current.push(timeoutId);
    };

    const getLanding = (frog: FrogConfig) => {
      const pointer = pointerRef.current;
      const dx = pointer.x - frog.x;
      const dy = pointer.y - frog.y;
      const distance = Math.hypot(dx, dy);
      const directionX = distance === 0 ? 1 : dx / distance;
      const directionY = distance === 0 ? 0 : dy / distance;
      const sideX = -directionY;
      const sideY = directionX;
      const overshoot = randomBetween(0, frog.overshootDistance);
      const shouldOvershoot = Math.random() > 0.58;
      const cursorOffset = shouldOvershoot
        ? overshoot
        : -randomBetween(24, frog.comfortDistance * 1.7);
      const lateralSpread = Math.min(
        frog.landingSpread + distance * randomBetween(0.08, 0.32),
        frog.maxJumpDistance * 0.8,
      );
      const sideOffset = randomBetween(
        -lateralSpread,
        lateralSpread,
      );
      const desiredX =
        pointer.x + directionX * cursorOffset + sideX * sideOffset;
      const desiredY =
        pointer.y + directionY * cursorOffset + sideY * sideOffset;
      const jumpDx = desiredX - frog.x;
      const jumpDy = desiredY - frog.y;
      const jumpDistance = Math.hypot(jumpDx, jumpDy);
      const boundedDistance = Math.min(jumpDistance, frog.maxJumpDistance);
      const jumpScale = jumpDistance === 0 ? 0 : boundedDistance / jumpDistance;
      const landingMargin = frog.size / 2 + 4;

      return {
        x: clamp(
          frog.x + jumpDx * jumpScale,
          landingMargin,
          window.innerWidth - landingMargin,
        ),
        y: clamp(
          frog.y + jumpDy * jumpScale,
          landingMargin,
          window.innerHeight - landingMargin,
        ),
      };
    };

    const checkFrogs = () => {
      const now = performance.now();
      let jumped = false;
      let pendingChanged = false;
      const nextFrogs = frogsRef.current.map((frog) => {
        const pointer = pointerRef.current;
        const distanceFromPointer = Math.hypot(
          pointer.x - frog.x,
          pointer.y - frog.y,
        );

        if (
          frog.isJumping ||
          now < frog.nextJumpAt
        ) {
          return frog;
        }

        if (distanceFromPointer <= frog.triggerDistance) {
          if (frog.pendingJumpAt === null) {
            return frog;
          }

          pendingChanged = true;
          return {
            ...frog,
            pendingJumpAt: null,
          };
        }

        if (frog.pendingJumpAt === null) {
          pendingChanged = true;
          return {
            ...frog,
            pendingJumpAt:
              now + randomBetween(frog.reactionDelayMin, frog.reactionDelayMax),
          };
        }

        if (now < frog.pendingJumpAt) {
          return frog;
        }

        const landing = getLanding(frog);
        const nextFrog = {
          ...frog,
          ...landing,
          isJumping: true,
          pendingJumpAt: null,
          nextJumpAt: now + frog.jumpDuration * 1000 + frog.jumpCooldown,
          rotation:
            frog.restRotation +
            frog.jumpRotation +
            (landing.x > frog.x ? 1 : -1) * 8,
          flipped: landing.x < frog.x,
        };

        jumped = true;
        croak();
        scheduleJumpSettled(nextFrog);

        return nextFrog;
      });

      if (jumped) {
        frogsRef.current = nextFrogs;
        setFrogs(nextFrogs);
      } else if (pendingChanged) {
        frogsRef.current = nextFrogs;
      }

      frameId = window.requestAnimationFrame(checkFrogs);
    };

    frameId = window.requestAnimationFrame(checkFrogs);

    return () => {
      window.cancelAnimationFrame(frameId);
      jumpTimeouts.current.forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      jumpTimeouts.current = [];
    };
  }, []);

  return (
    <div
      css={{
        maxWidth: "1280px",
        margin: "0 auto",
        padding: "20px",
        textAlign: "center",
        height: "100%",
        alignContent: "space-around",
      }}
    >
      <div
        css={{
          position: "fixed",
          inset: 0,
          overflow: "hidden",
          pointerEvents: "none",
          zIndex: 1,
        }}
      >
        {frogs.map((frog) => (
          <CursorFrog key={frog.id} frog={frog} />
        ))}
      </div>
      <motion.h1
        animate={{ color: ["#F5A9B8", "#5BCEFA"] }}
        transition={{
          duration: 2,
          repeat: Infinity,
          repeatType: "reverse",
          ease: "linear",
        }}
      >
        Piper Wolf
      </motion.h1>
      <motion.p
        initial={{ x: -500 }}
        animate={{ x: 0 }}
        transition={{ type: "spring", duration: 2 }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98, transition: { duration: 0.1 } }}
        css={{
          cursor: "pointer",
          userSelect: "none",
          position: "relative",
          zIndex: 2,
        }}
        onClick={() => {
          spawnFrog();
        }}
      >
        The only way to learn is by playing. The only way to win is by learning.
        And the only way to begin is by beginning.
      </motion.p>
    </div>
  );
}

export default App;
