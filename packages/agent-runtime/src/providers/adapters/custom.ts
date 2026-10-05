import { ProviderProtocol } from "@krypton/shared-types";
import { OpenAiProtocolAdapter } from "./openai.js";
import { LLMProvider, GenerateOptions, GenerateResult } from "../types.js";
import { sanitizeBaseUrl } from "@krypton/shared-types";

/**
 * Custom / Local Endpoint Adapter.
 * Extends OpenAiProtocolAdapter with relaxed credentials and local defaults.
 */
export class CustomProtocolAdapter extends OpenAiProtocolAdapter {
  public override readonly protocol: ProviderProtocol = "custom";
}

/**
 * Custom / Local Gateway implementing LLMProvider.
 */
export class CustomGateway implements LLMProvider {
  public readonly providerId: string;
  public readonly model: string;
  public readonly protocol: ProviderProtocol = "custom";
  public readonly baseUrl: string;
  private readonly adapter: CustomProtocolAdapter;
  private readonly apiKey?: string;
  private readonly defaultHeaders: Record<string, string>;

  constructor(options: {
    model: string;
    providerId?: string;
    apiKey?: string;
    baseUrl?: string;
    defaultHeaders?: Record<string, string>;
  }) {
    this.providerId = options.providerId || "custom";
    this.model = options.model;
    this.baseUrl = sanitizeBaseUrl(options.baseUrl || "http://localhost:8000/v1");
    this.apiKey = options.apiKey;
    this.defaultHeaders = options.defaultHeaders || {};
    this.adapter = new CustomProtocolAdapter();
  }

  public async generate(options: GenerateOptions): Promise<GenerateResult> {
    return this.adapter.execute(this.model, options, {
      baseUrl: this.baseUrl,
      apiKey: this.apiKey,
      headers: this.defaultHeaders,
    });
  }
}
