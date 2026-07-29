import { NextRequest, NextResponse } from "next/server";
import { db } from "@barnsquire/db";
import {
  appRouter,
  createContext,
  createCallerFactory,
  timeToSlot,
  SLOT_ORDER,
  type Slot,
} from "@barnsquire/trpc";
import { todayInTimeZone, hourMinuteInTimeZone } from "@/lib/utils";
import { bearerSecretMatches } from "@/lib/api-auth";

// Read-only barn summary for external displays — LED panels, dashboards, status
// screens. Counts and one task label only: no task/animal ids, no attachments,
// no free-text instructions, so the payload stays boring even though a secret
// guards it.
//
//   curl -H "Authorization: Bearer $INTEGRATION_SECRET" \
//     https://<host>/api/integrations/summary
//   curl ... "https://<host>/api/integrations/summary?barnId=<cuid>"
//
// Scope is membership: the response can only ever contain barns the
// INTEGRATION_USER_EMAIL user belongs to (a CARETAKER membership suffices).
// Guarded by its own secret rather than CRON_SECRET — that one authorizes
// push-notifying every user, which a wall display has no business doing.

export const dynamic = "force-dynamic";

const createCaller = createCallerFactory(appRouter);

const TASK_TYPES = [
  "FEEDING",
  "MEDICATION",
  "APPOINTMENT",
  "TURNOUT",
  "EXERCISE",
  "SCHEDULED_EVENT",
] as const;

interface Counts {
  total: number;
  outstanding: number;
}
const zero = (): Counts => ({ total: 0, outstanding: 0 });

export async function GET(req: NextRequest) {
  const secret = process.env.INTEGRATION_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "INTEGRATION_SECRET not configured" }, { status: 500 });
  }
  if (!bearerSecretMatches(req.headers, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = process.env.INTEGRATION_USER_EMAIL;
  if (!email) {
    return NextResponse.json({ error: "INTEGRATION_USER_EMAIL not configured" }, { status: 500 });
  }
  // Resolved by email rather than a pasted id, so the env stays readable and a
  // recreated user doesn't silently break the feed.
  const user = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) {
    return NextResponse.json({ error: "Integration user not found" }, { status: 500 });
  }

  const ctx = await createContext({ session: { user: { id: user.id } } });
  const caller = createCaller(ctx);

  const only = req.nextUrl.searchParams.get("barnId");
  const barns = (await caller.barn.list()).filter((b) => !only || b.id === only);
  if (only && barns.length === 0) {
    return NextResponse.json({ error: "Barn not found" }, { status: 404 });
  }

  const summaries = [];
  for (const barn of barns) {
    // One failing barn must not blank the whole response (same resilience the
    // notifications cron applies per user).
    try {
      const timezone = barn.timezone ?? "UTC";
      const date = todayInTimeZone(timezone);
      const { hour, minute } = hourMinuteInTimeZone(timezone);
      const currentSlot = timeToSlot(
        `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      );

      const groups = await caller.today.getDailyView({ barnId: barn.id, date });
      const tasks = groups.flatMap((g) => g.tasks);

      // Every bucket is zero-filled and always present. Consumers that merge
      // keys into a last-good state (the LED panels do) must never see a count
      // silently disappear — an absent key reads as "unchanged", not "zero".
      const bySlot = Object.fromEntries(SLOT_ORDER.map((s) => [s, zero()])) as Record<Slot, Counts>;
      const byType = Object.fromEntries(TASK_TYPES.map((t) => [t, zero()])) as Record<
        string,
        Counts
      >;

      let outstanding = 0;
      let skipped = 0;
      for (const task of tasks) {
        // A skipped task HAS a completion row — it counts as resolved, not
        // outstanding. Same predicate the notifications cron uses.
        const isOutstanding = !task.completion;
        if (isOutstanding) outstanding += 1;
        else if (task.completion?.skipped) skipped += 1;

        const slotBucket = bySlot[task.slot];
        if (slotBucket) {
          slotBucket.total += 1;
          if (isOutstanding) slotBucket.outstanding += 1;
        }
        const typeBucket = byType[task.taskType];
        if (typeBucket) {
          typeBucket.total += 1;
          if (isOutstanding) typeBucket.outstanding += 1;
        }
      }

      const nowIndex = SLOT_ORDER.indexOf(currentSlot);
      const outstandingPast = SLOT_ORDER.slice(0, nowIndex).reduce(
        (n, s) => n + (bySlot[s]?.outstanding ?? 0),
        0,
      );

      // The first outstanding task at or after the current slot, in the order
      // getDailyView already sorted the groups (barn group first, then by
      // building/name).
      let next: {
        slot: Slot;
        taskType: string;
        animalName: string;
        label: string;
      } | null = null;
      for (const slot of SLOT_ORDER.slice(nowIndex)) {
        const hit = tasks.find((t) => t.slot === slot && !t.completion);
        if (hit) {
          next = {
            slot: hit.slot,
            taskType: hit.taskType,
            animalName: hit.animalName,
            label: hit.label,
          };
          break;
        }
      }

      const refills = await caller.feedStock.getRefillsDue({ barnId: barn.id });

      summaries.push({
        barnId: barn.id,
        name: barn.name,
        timezone,
        date,
        currentSlot,
        tasks: {
          total: tasks.length,
          outstanding,
          skipped,
          completed: tasks.length - outstanding - skipped,
          outstandingNow: bySlot[currentSlot]?.outstanding ?? 0,
          outstandingPast,
          bySlot,
          byType,
          next,
        },
        feed: {
          lowCount: refills.length,
          // Floored to a whole day: `daysLeft` is a fractional prediction, and
          // rounding *down* is the safe direction for "days of feed left".
          // Done here so every display doesn't invent its own rounding.
          minDaysLeft: refills.length
            ? Math.floor(Math.min(...refills.map((r) => r.daysLeft)))
            : null,
          items: refills,
        },
      });
    } catch (err) {
      console.error(`integrations/summary: failed for barn ${barn.id}`, err);
    }
  }

  return NextResponse.json({ generatedAt: new Date().toISOString(), barns: summaries });
}
