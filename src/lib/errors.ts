export type DomainError =
  | { type: "INVALID_INPUT"; message: string; field?: string }
  | { type: "NOT_FOUND"; message: string; id?: string }
  | { type: "BUSINESS_RULE"; message: string; rule: string }
  | { type: "GATEWAY_ERROR"; message: string; cause?: unknown }
  | { type: "NOT_IMPLEMENTED"; feature: string; message: string }
  | {
      type: "INSUFFICIENT_DATA";
      required: number;
      available: number;
      message: string;
    };

export function invalidInput(message: string, field?: string): DomainError {
  return field !== undefined
    ? { type: "INVALID_INPUT", message, field }
    : { type: "INVALID_INPUT", message };
}

export function notFound(message: string, id?: string): DomainError {
  return id !== undefined
    ? { type: "NOT_FOUND", message, id }
    : { type: "NOT_FOUND", message };
}

export function businessRule(message: string, rule: string): DomainError {
  return { type: "BUSINESS_RULE", message, rule };
}

export function gatewayError(message: string, cause?: unknown): DomainError {
  return { type: "GATEWAY_ERROR", message, cause };
}

export function notImplemented(feature: string, message?: string): DomainError {
  return {
    type: "NOT_IMPLEMENTED",
    feature,
    message: message ?? `${feature} is not implemented`,
  };
}

export function insufficientData(
  required: number,
  available: number,
  message?: string,
): DomainError {
  return {
    type: "INSUFFICIENT_DATA",
    required,
    available,
    message: message ?? `Need ${required} data points, only ${available} available`,
  };
}
