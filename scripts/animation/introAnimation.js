/* global gsap */
import { loadCSS, loadScript } from '../aem.js';

/**
 * On-load intro for a video-banner inside a section styled "Intro Animation":
 * 1. a shutter splits open from a thin centre line,
 * 2. the intro video plays once on top of the (paused) loop video,
 * 3. the loop takes over seamlessly and the hero text fades in.
 *
 * The shutter and hidden text are applied synchronously so they are in place
 * before the section is shown; GSAP loads without blocking LCP.
 */

const MOBILE_QUERY = '(max-width: 900px)';
const SHUTTER_FALLBACK_MS = 1500; // open even if the intro is slow to start
const INTRO_MAX_MS = 10000; // never keep the hero text hidden longer than this

let gsapReady;

// aem.js loadScript resolves immediately when the tag already exists, even if
// another animation is still loading it, so wait for the global as well.
function loadGsap() {
  if (!gsapReady) {
    const src = `${window.hlx.codeBasePath}/scripts/thirdparty/gsap.min.js`;
    gsapReady = loadScript(src).then(() => window.gsap || new Promise((resolve, reject) => {
      const script = document.querySelector(`head > script[src="${src}"]`);
      script.addEventListener('load', () => resolve(window.gsap));
      script.addEventListener('error', reject);
    }));
  }
  return gsapReady;
}

function createIntroVideo(src) {
  const video = document.createElement('video');
  video.className = 'intro-animation-video';
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
  video.setAttribute('src', src);
  return video;
}

function createShutter() {
  const shutter = document.createElement('div');
  shutter.className = 'intro-animation-shutter';
  shutter.setAttribute('aria-hidden', 'true');
  shutter.innerHTML = '<div class="shutter-half shutter-top"></div><div class="shutter-half shutter-bottom"></div>';
  return shutter;
}

// Resolves once the video has actually painted a frame, so the swap never shows a gap.
function firstFrame(video) {
  return new Promise((resolve) => {
    if (!video.paused) {
      resolve();
      return;
    }
    video.addEventListener('playing', () => {
      if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(() => resolve());
      else resolve();
    }, { once: true });
    video.play().catch(resolve);
  });
}

export default async function initIntroAnimation(block) {
  const media = block.querySelector('.video-banner-media');
  const loop = media?.querySelector('video');
  const content = block.querySelector('.video-banner-content');
  const isMobile = window.matchMedia(MOBILE_QUERY).matches;
  const introSrc = media?.dataset[isMobile ? 'introMobile' : 'introDesktop'];

  const isFirstSection = block.closest('.section') === document.querySelector('main .section');

  const skip = !loop || !introSrc || !isFirstSection
    || block.classList.contains('is-editor')
    || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (skip) {
    loop?.play().catch(() => { });
    return;
  }

  await loadCSS(`${window.hlx.codeBasePath}/scripts/animation/introAnimation.css`);

  const shutter = createShutter();
  const intro = createIntroVideo(introSrc);
  block.classList.add('intro-animation-pending');
  block.append(shutter);
  media.append(intro);

  const gsapLoad = loadGsap();

  // --- Step 1: shutter reveal, as soon as the intro is playing ---
  let shutterOpened = false;
  const openShutter = async () => {
    if (shutterOpened) return;
    shutterOpened = true;
    try {
      await gsapLoad;
      gsap.timeline({ onComplete: () => shutter.remove() })
        .to(shutter.querySelector('.shutter-top'), { yPercent: -100, duration: 1.5, ease: 'power2.inOut' }, 0)
        .to(shutter.querySelector('.shutter-bottom'), { yPercent: 100, duration: 1.5, ease: 'power2.inOut' }, 0);
    } catch {
      shutter.remove();
    }
  };

  // --- Step 3: hero text reveal ---
  const revealContent = async () => {
    try {
      await gsapLoad;
      gsap.set(content, { opacity: 0, y: 15 });
      block.classList.remove('intro-animation-pending');
      gsap.to(content, {
        opacity: 1, y: 0, duration: 0.8, ease: 'power2.out', clearProps: 'opacity,transform',
      });
    } catch {
      block.classList.remove('intro-animation-pending');
    }
  };

  // --- Step 2: intro -> loop handoff ---
  let handedOff = false;
  const handoff = async () => {
    if (handedOff) return;
    handedOff = true;
    openShutter();

    await firstFrame(loop);
    revealContent();
    try {
      await gsapLoad;
      gsap.to(intro, { opacity: 0, duration: 0.35, onComplete: () => intro.remove() });
    } catch {
      intro.remove();
    }
  };

  intro.addEventListener('playing', () => {
    loop.preload = 'auto';
    openShutter();
  }, { once: true });
  intro.addEventListener('ended', handoff, { once: true });
  intro.addEventListener('error', handoff, { once: true });
  window.matchMedia(MOBILE_QUERY).addEventListener('change', handoff, { once: true });
  setTimeout(openShutter, SHUTTER_FALLBACK_MS);
  setTimeout(handoff, INTRO_MAX_MS);
  intro.play().catch(handoff);
}
