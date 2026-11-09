/* Bounded drawing geometry; all measured endpoints remain unchanged. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VLMTrails = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const MAX_OFFSET_RATIO = .25;

  function controls(source, target, sourceCentroid, targetCentroid, strength) {
    const dx = target[0]-source[0], dy = target[1]-source[1];
    const distance = Math.hypot(dx,dy);
    if (distance === 0) return {first: [...source], second: [...target], distance};
    const nx = -dy/distance, ny = dx/distance;
    const limit = MAX_OFFSET_RATIO*distance;
    const force = Math.max(0,Math.min(1,strength));
    // Attraction only bends across the chord. Fixed longitudinal positions
    // prevent backwards travel; relative bounds prevent near-stationary loops.
    const bend = (centroid, endpoint) => {
      const offset = ((centroid[0]-endpoint[0])*nx+(centroid[1]-endpoint[1])*ny)*force;
      return limit*Math.tanh(offset/limit);
    };
    const a = bend(sourceCentroid,source), b = bend(targetCentroid,target);
    return {
      first: [source[0]+dx/3+nx*a, source[1]+dy/3+ny*a],
      second: [target[0]-dx/3+nx*b, target[1]-dy/3+ny*b],
      distance
    };
  }
  return {controls, MAX_OFFSET_RATIO};
});
