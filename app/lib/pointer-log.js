// A recording of pointer input, saved as JSON.
//
// A recording from the real panel is the input for later tests: the gesture
// code can replay it under Node and be checked against what a hand did.

/**
 * @typedef {{
 *   t: number, type: string, id: number, kind: string,
 *   x: number, y: number, w: number, h: number, pressure: number
 * }} LogEntry
 */

/**
 * One entry per sample. A move carries the samples the browser coalesced into
 * it, which on a fast panel is several per frame.
 *
 * @param {PointerEvent} event
 * @param {number} start the `performance.now()` the recording began at
 * @returns {LogEntry[]}
 */
export function entriesOf(event, start) {
  const samples =
    event.type === 'pointermove' && event.getCoalescedEvents ? event.getCoalescedEvents() : [];
  const list = samples.length ? samples : [event];
  return list.map((sample) => ({
    t: Math.round((sample.timeStamp - start) * 10) / 10,
    type: event.type.replace('pointer', ''),
    id: sample.pointerId,
    kind: sample.pointerType,
    x: Math.round(sample.clientX * 10) / 10,
    y: Math.round(sample.clientY * 10) / 10,
    w: sample.width,
    h: sample.height,
    pressure: sample.pressure,
  }));
}

/** What the browser says about the screen, saved with a recording. */
export function environment() {
  return {
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
    screen: { width: screen.width, height: screen.height },
    window: { width: innerWidth, height: innerHeight },
    devicePixelRatio,
  };
}

/**
 * Hands the recording to the reader as a file.
 *
 * @param {LogEntry[]} entries
 */
export function download(entries) {
  const recordedAt = new Date().toISOString();
  const body = JSON.stringify({ recordedAt, environment: environment(), entries });
  const url = URL.createObjectURL(new Blob([body], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `touches-${recordedAt.replace(/[:.]/g, '-')}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
