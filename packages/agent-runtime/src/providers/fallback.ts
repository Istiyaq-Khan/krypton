import { LLMProvider, GenerateOptions, GenerateResult } from "./types.js";

export interface FallbackProviderOptions {
  primary: LLMProvider;
  fallbacks: LLMProvider[];
  onFallback?: (failedProvider: LLMProvider, nextProvider: LLMProvider, error: Error) => void;
}

/**
 * Resilient Fallback Provider Wrapper.
 * Catches transient rate limits, network failures, or server errors on the primary provider
 * and seamlessly executes alternative fallback models in sequence without crashing the session.
 */
export class FallbackProvider implements LLMProvider {
  public readonly primary: LLMProvider;
  public readonly fallbacks: LLMProvider[];
  private readonly onFallback?: (failedProvider: LLMProvider, nextProvider: LLMProvider, error: Error) => void;

  constructor(options: FallbackProviderOptions) {
    this.primary = options.primary;
    this.fallbacks = options.fallbacks || [];
    this.onFallback = options.onFallback;
  }

  public get providerId(): string {
    return this.primary.providerId;
  }

  public get model(): string {
    return this.primary.model;
  }

  public get protocol() {
    return this.primary.protocol;
  }

  public get baseUrl() {
    return this.primary.baseUrl;
  }

  public isTransientError(err: unknown): boolean {
    if (!err) return false;
    const msg = String(err instanceof Error ? err.message : err).toLowerCase();
    return (
      msg.includes("429") ||
      msg.includes("rate limit") ||
      msg.includes("quota") ||
      msg.includes("500") ||
      msg.includes("502") ||
      msg.includes("503") ||
      msg.includes("504") ||
      msg.includes("timeout") ||
      msg.includes("econnrefused") ||
      msg.includes("fetch failed") ||
      msg.includes("network") ||
      msg.includes("service unavailable")
    );
  }

  public async generate(options: GenerateOptions): Promise<GenerateResult> {
    const chain: LLMProvider[] = [this.primary, ...this.fallbacks];
    const errors: Array<{ provider: string; model: string; error: string }> = [];

    for (let i = 0; i < chain.length; i++) {
      const current = chain[i];

      if (options.abortSignal?.aborted) {
        throw new Error("Execution was aborted by operator.");
      }

      try {
        return await current.generate(options);
      } catch (err: any) {
        if (options.abortSignal?.aborted) {
          throw err;
        }

        const isLast = i === chain.length - 1;
        const errMsg = err?.message || String(err);
        errors.push({
          provider: current.providerId,
          model: current.model,
          error: errMsg,
        });

        if (isLast) {
          const summary = errors
            .map((e) => `[${e.provider}/${e.model}]: ${e.error}`)
            .join("; ");
          throw new Error(`All providers in fallback chain failed. ${summary}`);
        }

        const next = chain[i + 1];
        if (this.onFallback) {
          this.onFallback(current, next, err instanceof Error ? err : new Error(errMsg));
        } else {
          console.warn(
            `⚠️ [FallbackProvider] Model ${current.providerId}/${current.model} failed (${errMsg}). Failing over to ${next.providerId}/${next.model}...`
          );
        }
      }
    }

    throw new Error("No provider available in fallback chain.");
  }
}
