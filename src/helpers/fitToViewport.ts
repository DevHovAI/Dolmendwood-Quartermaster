/**
 * Working out how tall a window may be, and who gives up the difference.
 *
 * Pulled out of the note-config hook so the arithmetic can be checked without a
 * browser. The DOM part around it is three style assignments; this is the part
 * that can be wrong.
 *
 * The problem it solves: Foundry measures an ApplicationV2 once at render, and
 * the module adds four fieldsets afterwards. Those are invisible unless the
 * window grows — and a window grown past the screen puts its footer, with the
 * Create button on it, somewhere nothing can scroll to.
 */

/** Share of the viewport a sheet may occupy before it has to start scrolling. */
export const VIEWPORT_SHARE = 0.9;

/**
 * Smallest the injected block may be squeezed to. Below this it is worse than
 * a window hanging over the edge, so the content area takes over the scrolling.
 */
export const MIN_BLOCK_HEIGHT = 160;

export interface FitResult {
  /** null = leave the window as it is; it fits. */
  windowHeight: number | null;
  /** null = the block needs no cap. */
  blockMaxHeight: number | null;
  /** The whole content area has to scroll too, because the block hit its floor. */
  contentMustScroll: boolean;
}

/**
 * @param naturalHeight what the sheet measures when nothing constrains it
 * @param blockHeight   the injected block's own unconstrained height
 * @param viewportHeight the browser window's inner height
 */
export function fitToViewport(
  naturalHeight: number,
  blockHeight: number,
  viewportHeight: number
): FitResult {
  const tallest = Math.floor(viewportHeight * VIEWPORT_SHARE);
  const overshoot = naturalHeight - tallest;

  if (overshoot <= 0) {
    return { windowHeight: null, blockMaxHeight: null, contentMustScroll: false };
  }

  const wanted = blockHeight - overshoot;
  const blockMaxHeight = Math.max(MIN_BLOCK_HEIGHT, wanted);

  return {
    windowHeight: tallest,
    blockMaxHeight,
    // The block could not absorb all of it: whatever is left has to be
    // scrollable somewhere, or the footer is unreachable again.
    contentMustScroll: wanted < MIN_BLOCK_HEIGHT,
  };
}
