import { SteeringInputEvent } from "@krypton/shared-types";

/**
 * Dual-Buffer Asynchronous Steering Queue.
 *
 * Buffer A: Primary execution task items processed sequentially by the agent loop.
 * Buffer B: High-priority steering interrupt queue receiving real-time user steering inputs
 * (from Voice HUD, Terminal CLI, or Desktop UI).
 *
 * Evaluated between every tool step so users can dynamically course-correct agents mid-flight.
 */
export class DualBufferQueue<T = unknown> {
  private primaryBuffer: T[] = [];
  private steeringBuffer: SteeringInputEvent[] = [];

  /**
   * Enqueues an item to the primary execution queue (Buffer A).
   */
  public enqueuePrimary(item: T): void {
    this.primaryBuffer.push(item);
  }

  /**
   * Enqueues a high-priority steering interrupt (Buffer B).
   * Immediate priority items are unshifted to the front.
   */
  public enqueueSteering(event: SteeringInputEvent): void {
    if (event.priority === "immediate") {
      this.steeringBuffer.unshift(event);
    } else {
      this.steeringBuffer.push(event);
    }
  }

  /**
   * Checks whether any high-priority steering events are currently waiting.
   */
  public hasSteeringInterrupt(): boolean {
    return this.steeringBuffer.length > 0;
  }

  /**
   * Drains and returns all pending steering interrupt events.
   */
  public drainSteering(): SteeringInputEvent[] {
    const events = [...this.steeringBuffer];
    this.steeringBuffer = [];
    return events;
  }

  /**
   * Dequeues the next item:
   * Prioritizes steering interrupts if present; otherwise returns next primary item.
   */
  public dequeue(): { steering?: SteeringInputEvent; primaryItem?: T } {
    if (this.steeringBuffer.length > 0) {
      return { steering: this.steeringBuffer.shift() };
    }
    if (this.primaryBuffer.length > 0) {
      return { primaryItem: this.primaryBuffer.shift() };
    }
    return {};
  }

  /**
   * Returns current buffer sizes.
   */
  public size(): { primary: number; steering: number } {
    return {
      primary: this.primaryBuffer.length,
      steering: this.steeringBuffer.length,
    };
  }

  /**
   * Clears both buffers.
   */
  public clear(): void {
    this.primaryBuffer = [];
    this.steeringBuffer = [];
  }
}
