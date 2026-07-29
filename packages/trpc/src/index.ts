export { appRouter } from "./router/index";
export type { AppRouter } from "./router/index";
export { createContext } from "./context";
export type { Context, CreateContextOptions, AuthSession, AuthenticatedContext } from "./context";
export { createCallerFactory } from "./trpc";
// Time-of-day slot bucketing, shared with headless consumers so the windows
// (06/12/13/18) live in exactly one place.
export { timeToSlot, SLOT_ORDER } from "./router/today";
export type { Slot } from "./router/today";
