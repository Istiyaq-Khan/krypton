import { EventEmitter } from "node:events";
import {
  ClarificationCancelation,
  ClarificationCancelationSchema,
  ClarificationRequest,
  ClarificationRequestSchema,
  InteractionChannel,
} from "@krypton/shared-types";

export interface ChannelTransportHandler {
  channel: InteractionChannel;
  dispatch(request: ClarificationRequest): Promise<void>;
  cancel(cancelation: ClarificationCancelation): Promise<void>;
}

/**
 * Multi-Channel Prompt Dispatcher.
 * Broadcasts structured ClarificationRequest packets across registered UI, CLI, Voice,
 * and messaging transports, and dispatches cancellation tokens once an answer is received.
 */
export class PromptBus extends EventEmitter {
  private transports = new Map<InteractionChannel, ChannelTransportHandler>();

  /**
   * Registers an active client channel transport.
   */
  public registerTransport(handler: ChannelTransportHandler): void {
    this.transports.set(handler.channel, handler);
    this.emit("transportRegistered", { channel: handler.channel });
  }

  public unregisterTransport(channel: InteractionChannel): void {
    this.transports.delete(channel);
    this.emit("transportUnregistered", { channel });
  }

  public getActiveChannels(): InteractionChannel[] {
    return Array.from(this.transports.keys());
  }

  /**
   * Broadcasts a ClarificationRequest to all active transports.
   */
  public async broadcastRequest(request: ClarificationRequest): Promise<void> {
    const validated = ClarificationRequestSchema.parse(request);

    const promises = Array.from(this.transports.values()).map(async (handler) => {
      try {
        await handler.dispatch(validated);
      } catch (err) {
        this.emit("dispatchError", {
          channel: handler.channel,
          requestId: validated.requestId,
          error: err,
        });
      }
    });

    await Promise.all(promises);
    this.emit("requestBroadcasted", { requestId: validated.requestId });
  }

  /**
   * Broadcasts a cancelation token to all registered channels.
   */
  public async broadcastCancelation(
    cancelation: ClarificationCancelation
  ): Promise<void> {
    const validated = ClarificationCancelationSchema.parse(cancelation);

    const promises = Array.from(this.transports.values()).map(async (handler) => {
      try {
        await handler.cancel(validated);
      } catch (err) {
        this.emit("cancelError", {
          channel: handler.channel,
          requestId: validated.requestId,
          error: err,
        });
      }
    });

    await Promise.all(promises);
    this.emit("cancelationBroadcasted", { requestId: validated.requestId });
  }
}
