import { TokenStreamChunk } from "@krypton/shared-types";

export interface SseStreamOptions {
  response: Response;
  agentId: string;
  taskId?: string;
  onChunk: (payload: unknown) => { delta?: string; isComplete?: boolean };
  onToken?: (chunk: TokenStreamChunk) => void;
  abortSignal?: AbortSignal;
}

export abstract class BaseAdapter {
  protected async fetchWithBackoff(
    url: string,
    options: RequestInit,
    maxRetries = 3,
    attempt = 1
  ): Promise<Response> {
    try {
      const res = await fetch(url, options);

      if (res.status === 429 || (res.status >= 500 && res.status <= 504)) {
        if (attempt <= maxRetries) {
          const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 10_000);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          return this.fetchWithBackoff(url, options, maxRetries, attempt + 1);
        }
      }

      return res;
    } catch (err) {
      if (attempt <= maxRetries && !(err instanceof Error && err.name === "AbortError")) {
        const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 10_000);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        return this.fetchWithBackoff(url, options, maxRetries, attempt + 1);
      }
      throw err;
    }
  }

  protected async processSseStream(opts: SseStreamOptions): Promise<string> {
    const { response, agentId, taskId, onChunk, onToken, abortSignal } = opts;
    const body = response.body;
    if (!body) {
      throw new Error("Response body is null or undefined for streaming request.");
    }

    const reader = body.getReader();
    const decoder = new TextDecoder("utf-8");
    let accumulatedText = "";
    let tokenIndex = 0;
    let buffer = "";

    try {
      while (true) {
        if (abortSignal?.aborted) {
          await reader.cancel();
          break;
        }

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(":")) continue;

          if (trimmed.startsWith("data:")) {
            const dataStr = trimmed.slice(5).trim();
            if (dataStr === "[DONE]") {
              onToken?.({
                type: "token_stream",
                agentId,
                taskId,
                delta: "",
                isComplete: true,
                index: tokenIndex++,
                timestamp: Date.now(),
              });
              continue;
            }

            try {
              const parsed = JSON.parse(dataStr);
              const { delta, isComplete } = onChunk(parsed);
              if (delta) {
                accumulatedText += delta;
                onToken?.({
                  type: "token_stream",
                  agentId,
                  taskId,
                  delta,
                  isComplete: Boolean(isComplete),
                  index: tokenIndex++,
                  timestamp: Date.now(),
                });
              }
            } catch {
              // Ignore non-JSON ping lines
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return accumulatedText;
  }
}
