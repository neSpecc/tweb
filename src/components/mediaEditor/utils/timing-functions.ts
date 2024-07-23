/**
 * @example const bezier = cubicBezier(0.21, 0.48, 0.31, 1.13);
 */
export function cubicBezier(p1x: number, p1y: number, p2x: number, p2y: number): (t: number) => number {
  return function (t: number) {
    const cx = 3 * p1x;
    const bx = 3 * (p2x - p1x) - cx;
    const ax = 1 - cx - bx;
    const cy = 3 * p1y;
    const by = 3 * (p2y - p1y) - cy;
    const ay = 1 - cy - by;

    function sampleCurveX(t: number) {
      return ((ax * t + bx) * t + cx) * t;
    }

    function sampleCurveY(t: number) {
      return ((ay * t + by) * t + cy) * t;
    }

    function sampleCurveDerivativeX(t: number) {
      return (3 * ax * t + 2 * bx) * t + cx;
    }

    function solveCurveX(x, epsilon = 1e-6) {
      let t0;
      let t1;
      let t2;
      let x2;
      let d2;
      let i;

      // First try a few iterations of Newton's method -- normally very fast.
      for (t2 = x, i = 0; i < 8; i++) {
        x2 = sampleCurveX(t2) - x;
        if (Math.abs(x2) < epsilon) {
          return t2;
        }
        d2 = sampleCurveDerivativeX(t2);
        if (Math.abs(d2) < epsilon) {
          break;
        }
        t2 -= x2 / d2;
      }

      // Fall back to the bisection method for reliability.
      t0 = 0;
      t1 = 1;
      t2 = x;

      if (t2 < t0) {
        return t0;
      }
      if (t2 > t1) {
        return t1;
      }

      while (t0 < t1) {
        x2 = sampleCurveX(t2);
        if (Math.abs(x2 - x) < epsilon) {
          return t2;
        }
        if (x > x2) {
          t0 = t2;
        }
        else {
          t1 = t2;
        }
        t2 = (t1 - t0) * 0.5 + t0;
      }

      // Failure.
      return t2;
    }

    return sampleCurveY(solveCurveX(t));
  };
}

/**
 * Linear interpolation function to compute intermediate values between the start and end sizes
 */
export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

export function easeOutQuad(t: number): number {
  return t * (2 - t);
}
