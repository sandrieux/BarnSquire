// Client-safe entrypoint for non-server consumers (e.g. the React Native app).
// It re-exports ONLY the router TYPE, so importing `@barnsquire/trpc/client`
// never pulls in server runtime code (Prisma, the S3 SDK, bcrypt). A mobile
// bundle uses this for end-to-end tRPC type inference:
//   import type { AppRouter } from "@barnsquire/trpc/client";
export type { AppRouter } from "../src/router/index";
