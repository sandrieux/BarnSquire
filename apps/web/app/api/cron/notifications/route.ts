import { NextRequest, NextResponse } from "next/server";
import { db } from "@barnsquire/db";
import { appRouter, createContext, createCallerFactory } from "@barnsquire/trpc";
import { todayInTimeZone } from "@/lib/utils";

// Scheduled sender for mobile push notifications. Trigger from system cron on the
// server, e.g. once each morning:
//   curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/notifications
// For each user with a registered device, it summarizes today's outstanding tasks
// and low feeds across their barns and sends one Expo push per device.

export const dynamic = "force-dynamic";

const createCaller = createCallerFactory(appRouter);
const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";

interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  sound: "default";
}

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const provided =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    req.nextUrl.searchParams.get("secret");
  if (provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Group device tokens by user.
  const devices = await db.deviceToken.findMany();
  const tokensByUser = new Map<string, string[]>();
  for (const d of devices) {
    tokensByUser.set(d.userId, [...(tokensByUser.get(d.userId) ?? []), d.token]);
  }

  const messages: ExpoMessage[] = [];

  for (const [userId, tokens] of tokensByUser) {
    try {
      const ctx = await createContext({ session: { user: { id: userId } } });
      const caller = createCaller(ctx);
      const barns = (await caller.barn.list()) as Array<{
        id: string;
        timezone?: string | null;
      }>;

      let dueTasks = 0;
      let lowFeeds = 0;
      for (const barn of barns) {
        const date = todayInTimeZone(barn.timezone ?? "UTC");
        const groups = await caller.today.getDailyView({ barnId: barn.id, date });
        for (const g of groups) {
          for (const task of g.tasks) {
            if (!task.completion) dueTasks += 1;
          }
        }
        const refills = await caller.feedStock.getRefillsDue({ barnId: barn.id });
        lowFeeds += refills.length;
      }

      if (dueTasks === 0 && lowFeeds === 0) continue;

      const parts = [
        dueTasks > 0 ? `${dueTasks} task${dueTasks === 1 ? "" : "s"} due today` : null,
        lowFeeds > 0 ? `${lowFeeds} feed${lowFeeds === 1 ? "" : "s"} running low` : null,
      ].filter(Boolean);

      for (const token of tokens) {
        messages.push({
          to: token,
          title: "BarnSquire",
          body: parts.join(" · "),
          sound: "default",
        });
      }
    } catch (err) {
      console.error(`notifications: failed for user ${userId}`, err);
    }
  }

  // Expo accepts up to 100 messages per request.
  let sent = 0;
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    try {
      const res = await fetch(EXPO_PUSH_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(batch),
      });
      if (res.ok) sent += batch.length;
      else console.error("notifications: Expo push error", await res.text());
    } catch (err) {
      console.error("notifications: Expo push request failed", err);
    }
  }

  return NextResponse.json({ users: tokensByUser.size, messages: messages.length, sent });
}
