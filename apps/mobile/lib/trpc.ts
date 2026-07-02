import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import type { AppRouter } from "@barnsquire/trpc/client";
import { getTrpcUrl } from "./apiBase";
import { authedFetch } from "./api";

// End-to-end typed tRPC client. `@barnsquire/trpc/client` is a TYPE-ONLY export,
// so no server code (Prisma, S3 SDK) enters the mobile bundle.
export const trpc = createTRPCReact<AppRouter>();

export function createTrpcClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: getTrpcUrl(),
        fetch: authedFetch,
      }),
    ],
  });
}
