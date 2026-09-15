/**
 * Point in 2D coordinate space.
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Options for generating humanized cubic Bézier movement trajectories.
 */
export interface TrajectoryOptions {
  steps?: number;
  overshoot?: boolean;
  overshootDistance?: number;
  jitter?: boolean;
  jitterIntensity?: number;
}

/**
 * Generates natural, human-like mouse movement trajectories and keystroke delays.
 */
export class MouseHumanizer {
  /**
   * Generates a cubic Bézier trajectory from start to target with natural velocity easing,
   * micro-overshoots past the target, and motor-control correction jitter.
   */
  public static generateTrajectory(
    start: Point,
    target: Point,
    options: TrajectoryOptions = {}
  ): Point[] {
    const steps = options.steps ?? Math.max(15, Math.min(50, Math.round(this.distance(start, target) / 15)));
    const overshoot = options.overshoot ?? true;
    const jitter = options.jitter ?? true;
    const jitterIntensity = options.jitterIntensity ?? 1.5;

    // Calculate distance and direction
    const dx = target.x - start.x;
    const dy = target.y - start.y;
    const dist = Math.hypot(dx, dy);

    // If start and target are practically identical, return target
    if (dist < 2) {
      return [{ x: Math.round(target.x), y: Math.round(target.y) }];
    }

    // Determine intermediate overshoot target if distance is non-trivial (> 20px)
    let finalTarget = { ...target };
    let primaryTarget = { ...target };

    if (overshoot && dist > 20) {
      const overshootFactor = options.overshootDistance
        ? options.overshootDistance / dist
        : (Math.random() * 0.04 + 0.02); // 2% to 6% overshoot past target
      primaryTarget = {
        x: target.x + dx * overshootFactor + (Math.random() - 0.5) * 6,
        y: target.y + dy * overshootFactor + (Math.random() - 0.5) * 6,
      };
    }

    // Randomized control points P1 and P2 creating natural curvature
    // Perpendicular deviation based on distance
    const normalX = -dy / dist;
    const normalY = dx / dist;
    const curvature = (Math.random() * 0.4 - 0.2) * dist; // deviation arc

    const p0 = { ...start };
    const p1: Point = {
      x: start.x + dx * 0.25 + normalX * curvature + (Math.random() - 0.5) * 10,
      y: start.y + dy * 0.25 + normalY * curvature + (Math.random() - 0.5) * 10,
    };
    const p2: Point = {
      x: start.x + dx * 0.75 + normalX * (curvature * 0.6) + (Math.random() - 0.5) * 10,
      y: start.y + dy * 0.75 + normalY * (curvature * 0.6) + (Math.random() - 0.5) * 10,
    };
    const p3 = { ...primaryTarget };

    const trajectory: Point[] = [];

    // Phase 1: Cubic Bézier to primary target with S-curve easing
    for (let i = 0; i <= steps; i++) {
      const linearT = i / steps;
      // Smooth step / S-curve easing: 3t^2 - 2t^3
      const easedT = linearT * linearT * (3 - 2 * linearT);

      let pt = this.cubicBezier(p0, p1, p2, p3, easedT);

      // Add micro-jitter during travel
      if (jitter && i > 0 && i < steps) {
        pt = {
          x: pt.x + (Math.random() - 0.5) * jitterIntensity,
          y: pt.y + (Math.random() - 0.5) * jitterIntensity,
        };
      }

      trajectory.push({
        x: Math.round(pt.x * 10) / 10,
        y: Math.round(pt.y * 10) / 10,
      });
    }

    // Phase 2: Micro-correction from overshoot point back to exact final target
    if (overshoot && (primaryTarget.x !== finalTarget.x || primaryTarget.y !== finalTarget.y)) {
      const correctionSteps = Math.max(3, Math.min(8, Math.round(steps * 0.2)));
      const lastPoint = trajectory[trajectory.length - 1];

      for (let j = 1; j <= correctionSteps; j++) {
        const ct = j / correctionSteps;
        const easedCt = ct * ct * (3 - 2 * ct);
        trajectory.push({
          x: Math.round((lastPoint.x + (finalTarget.x - lastPoint.x) * easedCt) * 10) / 10,
          y: Math.round((lastPoint.y + (finalTarget.y - lastPoint.y) * easedCt) * 10) / 10,
        });
      }
    }

    // Ensure final point matches target exactly
    trajectory[trajectory.length - 1] = {
      x: Math.round(finalTarget.x),
      y: Math.round(finalTarget.y),
    };

    return trajectory;
  }

  private static cubicBezier(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
    const u = 1 - t;
    const tt = t * t;
    const uu = u * u;
    const uuu = uu * u;
    const ttt = tt * t;

    return {
      x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
      y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y,
    };
  }

  private static distance(a: Point, b: Point): number {
    return Math.hypot(b.x - a.x, b.y - a.y);
  }
}

/**
 * Simulates human typing rhythms with Gaussian-distributed keypress delays and punctuation pauses.
 */
export class KeystrokeHumanizer {
  /**
   * Generates a realistic delay in milliseconds for typing a given character.
   * Uses Box-Muller transform for Gaussian distribution bounded between 60ms and 140ms.
   */
  public static getKeypressDelay(char: string): number {
    // Base Gaussian distribution: Mean = 95ms, StdDev = 18ms
    const u1 = Math.max(1e-6, Math.random());
    const u2 = Math.random();
    const randStdNormal = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);

    let delay = 95 + randStdNormal * 18;

    // Word boundary pause (space or newline)
    if (char === " " || char === "\n") {
      delay += 80 + Math.random() * 80; // 175ms - 255ms
    } else if (/[.,;:!?]/.test(char)) {
      // Punctuation reflection pause
      delay += 120 + Math.random() * 120; // 215ms - 335ms
    } else if (/[A-Z]/.test(char)) {
      // Shift-key modifier penalty
      delay += 25 + Math.random() * 25;
    }

    // Clamp strictly within realistic human typing bounds (60ms - 350ms)
    return Math.round(Math.max(60, Math.min(350, delay)));
  }

  /**
   * Generates array of key stroke delays for an entire string.
   */
  public static generateDelays(text: string): number[] {
    return Array.from(text).map((char) => this.getKeypressDelay(char));
  }
}
