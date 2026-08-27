/**
 * Counting with buttons rather than a keyboard.
 *
 * A number box asks a Referee to select, clear and retype for a change of one,
 * and in these dialogs the ordinary change *is* one — one more ration in the
 * pot, one more spell attempted. The box stays under the buttons because it is
 * what the reader reads and what holds the row's minimum and maximum; the
 * buttons only move it.
 *
 * Markup is `<span class="dw-stepper"><button class="dw-step-down">…<input>…
 * <button class="dw-step-up"></span>`, and the input may carry whatever class
 * its own reader wants — this only ever looks for the input inside the stepper
 * it was clicked in.
 */
export function wireSteppers(html: JQuery): void {
  html.on("click", ".dw-step-up, .dw-step-down", (event) => {
    const button = event.currentTarget as HTMLElement;
    const box = button.parentElement?.querySelector("input") as HTMLInputElement | null;
    if (!box) return;

    const step = button.classList.contains("dw-step-up") ? 1 : -1;
    const min = box.min === "" ? 0 : Number(box.min);
    const max = box.max === "" ? Number.MAX_SAFE_INTEGER : Number(box.max);
    box.value = String(Math.min(max, Math.max(min, (Number(box.value) || 0) + step)));

    // The live readouts listen for `change`; a value moved by script does not
    // announce itself, so it is announced here.
    box.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

/** The markup for one stepper, so every dialog draws the same control. */
export function stepper(attributes: string): string {
  return `<span class="dw-stepper">
    <button type="button" class="dw-step-down" title="One less"><i class="fas fa-minus"></i></button>
    <input type="number" ${attributes}>
    <button type="button" class="dw-step-up" title="One more"><i class="fas fa-plus"></i></button>
  </span>`;
}
