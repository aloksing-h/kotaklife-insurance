# Infinity Intro

Full-screen video introduction with the existing shutter reveal and scroll-driven
infinity transition into a partner banner or section.

## Loading

The shutter starts immediately when the intro initializes, independently of video
loading, matching the zero-delay timeline in the
[Intro-Banner-V2 reference](https://yesoryes.io/staging/kotak_life_r2_v6/Intro-Banner-V2/).
The intro becomes visible only after a decoded frame is presented, and the loop
must present a frame before the intro fades away. Slow video loading does not
hold the shutter closed.

On desktop and mobile, both shutter halves open together over 1.5 seconds
with `power2.inOut`, retaining the existing responsive framing. Each half clips the
same centered, cover-sized full-stage background, leaving the original 3px slit.

The video shade repeats the prototype's translucent diagonal gradient in 4px by
4px tiles. This creates the cube-dot texture over the intro and loop videos.
It moves and scales with the video and is also present on both foreground
ribbon layers, so it stays aligned through the existing mask transition.

Transition masks are decoded before masking is enabled. If a mask cannot load, an
error is logged and the partner remains in normal page flow.

## Mask alignment

The main mask and both foreground masks use the same explicit width, height and
position. Their shared coordinate space is 1600 by 961, even though the foreground
image files have smaller intrinsic dimensions. Geometry is refreshed on video
metadata and stage/header/host size changes, including during a transition,
without restarting the animation or the hero reveal.

Foreground masks are intersected with the main silhouette so the front ribbon
cannot protrude beyond the outer curve. The foreground uses the same video shade
as the background layer to avoid a visible seam where they join.

The right-hand opening is part of the mask artwork and is intentionally preserved.
The existing ribbon calibration, target placement, easings and durations are unchanged.

## Validation

Run the video-readiness regression tests:

```powershell
node --experimental-vm-modules --test test\infinity-intro.test.js
```

Browser checks should cover delayed video and mask responses, forward/reverse
scroll transitions, reduced motion and resizing during and after the transition.
