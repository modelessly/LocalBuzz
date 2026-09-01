type WebMcpInputSchema = {
  type: "object";
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
};

type WebMcpTool = {
  name: string;
  title?: string;
  description: string;
  inputSchema?: WebMcpInputSchema;
  annotations?: {
    readOnlyHint?: boolean;
    untrustedContentHint?: boolean;
  };
  execute: (
    input: Record<string, unknown>,
    options: { signal: AbortSignal },
  ) => unknown | Promise<unknown>;
};

interface WebMcpModelContext {
  registerTool: (
    tool: WebMcpTool,
    options?: { signal?: AbortSignal; exposedTo?: string[] },
  ) => Promise<void>;
  getTools?: () => Promise<Array<{ name: string; description: string; inputSchema?: object }>>;
}

interface Document {
  readonly modelContext?: WebMcpModelContext;
}
