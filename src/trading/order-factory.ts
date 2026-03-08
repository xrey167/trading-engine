// Re-export OrderFactory types and function from the core engine
// to avoid circular imports (factory lives in trading-engine.ts,
// next to the Order class hierarchy it constructs).

export { createOrder, type CreateOrderParams } from '../../trading-engine.js';
