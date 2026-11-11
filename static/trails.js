/* Bounded drawing geometry; all measured endpoints remain unchanged. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VLMTrails = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const DEFAULT_STRENGTH = .45;
  const DEFAULT_OFFSET_RATIO = .25;
  const MAX_OFFSET_RATIO = .4;

  function controls(source, target, sourceCentroid, targetCentroid, strength) {
    const dx = target[0]-source[0], dy = target[1]-source[1];
    const distance = Math.hypot(dx,dy);
    if (distance === 0) return {firstHalf: [source, source], middle: source, secondHalf: [target, target], distance};
    const nx = -dy/distance, ny = dx/distance;
    const force = Math.max(0,Math.min(1,strength));
    const boost = Math.max(0,(force-DEFAULT_STRENGTH)/(1-DEFAULT_STRENGTH));
    const limit = distance*(DEFAULT_OFFSET_RATIO+boost*(MAX_OFFSET_RATIO-DEFAULT_OFFSET_RATIO));
    const bend = (centroid, endpoint) => {
      const offset = ((centroid[0]-endpoint[0])*nx+(centroid[1]-endpoint[1])*ny)*force;
      return limit*Math.tanh(offset/limit);
    };
    // Keep the previous midpoint attraction and approach measured endpoints along the chord.
    // Opposing pulls cancel instead of producing bends on both sides of the chord.
    const offset = .375 * (bend(sourceCentroid, source) + bend(targetCentroid, target));
    const along = (t, across = 0) => [source[0] + t*dx + across*nx, source[1] + t*dy + across*ny];
    return {
      firstHalf: [along(1/6), along(1/3, offset)],
      middle: along(1/2, offset),
      secondHalf: [along(2/3, offset), along(5/6)],
      distance
    };
  }
  function cubicAt(source, target, [first, second], t) {
    const u = 1 - t;
    return source.map((value, axis) => u*u*u*value + 3*u*u*t*first[axis]
      + 3*u*t*t*second[axis] + t*t*t*target[axis]);
  }

  function pointAt(source, target, curve, t) {
    return t < .5
      ? cubicAt(source, curve.middle, curve.firstHalf, t*2)
      : cubicAt(curve.middle, target, curve.secondHalf, t*2-1);
  }

  return {controls, pointAt, DEFAULT_STRENGTH, MAX_OFFSET_RATIO};
});
