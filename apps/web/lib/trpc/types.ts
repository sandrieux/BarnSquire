import type { AppRouter } from "@barnsquire/trpc";
import type { inferRouterOutputs, inferRouterInputs } from "@trpc/server";

export type RouterOutputs = inferRouterOutputs<AppRouter>;
export type RouterInputs = inferRouterInputs<AppRouter>;
