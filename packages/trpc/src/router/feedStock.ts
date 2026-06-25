import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, protectedProcedure } from "../trpc";

type Db = import("@barnsquire/db").PrismaClient;

async function assertBarnAccess(
  db: Db,
  userId: string,
  barnId: string,
  minRole: "CARETAKER" | "BARN_MANAGER" = "BARN_MANAGER"
) {
  const roleOrder = { CARETAKER: 0, BARN_MANAGER: 1, GLOBAL_ADMIN: 2 } as const;
  const membership = await db.barnMembership.findUnique({
    where: { userId_barnId: { userId, barnId } },
  });
  if (!membership) throw new TRPCError({ code: "FORBIDDEN" });
  if (roleOrder[membership.role] < roleOrder[minRole]) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
}

// Quantity is free-text ("2", "0.5", "a handful"). Parse leniently; a value we
// can't read counts as one serving so it still contributes to consumption.
function parseQuantity(q: string): number {
  const n = parseFloat(q);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

const MS_PER_DAY = 86_400_000;

// Daily consumption per feed type, summed across active (non-medication)
// feeding schedules in the barn: (days/week ÷ 7) × quantity.
async function ratesByFeedType(db: Db, barnId: string) {
  const now = new Date();
  const schedules = await db.feedingSchedule.findMany({
    where: {
      isActive: true,
      isMedication: false,
      animal: { barnId, isActive: true },
      startDate: { lte: now },
      OR: [{ endDate: null }, { endDate: { gte: now } }],
    },
    select: { feedType: true, quantity: true, unit: true, repeatDays: true },
  });

  const map = new Map<string, { ratePerDay: number; unit: string | null }>();
  for (const s of schedules) {
    const prev = map.get(s.feedType) ?? { ratePerDay: 0, unit: null };
    prev.ratePerDay += (s.repeatDays.length / 7) * parseQuantity(s.quantity);
    if (!prev.unit && s.unit) prev.unit = s.unit;
    map.set(s.feedType, prev);
  }
  return map;
}

type StockRow = {
  feedType: string;
  unit: string | null;
  ratePerDay: number;
  servingsRemaining: number;
  daysLeft: number | null;
  thresholdDays: number;
  servingsPerContainer: number | null;
  tracked: boolean;
  needsRefill: boolean;
};

// Merge discovered feed types (from schedules) with recorded stock and project
// the current balance / days-left forward to today.
async function computeStock(db: Db, barnId: string): Promise<StockRow[]> {
  const [rates, stocks] = await Promise.all([
    ratesByFeedType(db, barnId),
    db.feedStock.findMany({ where: { barnId } }),
  ]);
  const stockByType = new Map(stocks.map((s) => [s.feedType, s]));
  const feedTypes = new Set<string>([...rates.keys(), ...stockByType.keys()]);
  const now = Date.now();

  const rows: StockRow[] = [];
  for (const feedType of feedTypes) {
    const rate = rates.get(feedType)?.ratePerDay ?? 0;
    const unit = rates.get(feedType)?.unit ?? null;
    const stock = stockByType.get(feedType);

    let servingsRemaining = 0;
    if (stock) {
      const elapsedDays = Math.max(0, (now - stock.asOfDate.getTime()) / MS_PER_DAY);
      servingsRemaining = Math.max(0, stock.servingsRemaining - rate * elapsedDays);
    }
    const daysLeft = rate > 0 ? servingsRemaining / rate : null;
    const thresholdDays = stock?.thresholdDays ?? 3;
    rows.push({
      feedType,
      unit,
      ratePerDay: rate,
      servingsRemaining,
      daysLeft,
      thresholdDays,
      servingsPerContainer: stock?.servingsPerContainer ?? null,
      tracked: !!stock,
      needsRefill: !!stock && daysLeft !== null && daysLeft <= thresholdDays,
    });
  }
  return rows.sort((a, b) => a.feedType.localeCompare(b.feedType));
}

export const feedStockRouter = router({
  list: protectedProcedure
    .input(z.object({ barnId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      await assertBarnAccess(ctx.db, ctx.session.user.id, input.barnId, "CARETAKER");
      return computeStock(ctx.db, input.barnId);
    }),

  getRefillsDue: protectedProcedure
    .input(z.object({ barnId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      await assertBarnAccess(ctx.db, ctx.session.user.id, input.barnId, "CARETAKER");
      const rows = await computeStock(ctx.db, input.barnId);
      return rows
        .filter((r) => r.needsRefill)
        .map((r) => ({ feedType: r.feedType, unit: r.unit, daysLeft: r.daysLeft! }));
    }),

  restock: protectedProcedure
    .input(
      z.object({
        barnId: z.string().cuid(),
        feedType: z.string().min(1).max(100),
        containers: z.number().positive(),
        servingsPerContainer: z.number().positive(),
        date: z.coerce.date().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertBarnAccess(ctx.db, ctx.session.user.id, input.barnId);
      const added = input.containers * input.servingsPerContainer;
      const asOfDate = input.date ?? new Date();

      // Burn the existing balance down to now before adding the new feed.
      const existing = await ctx.db.feedStock.findUnique({
        where: { barnId_feedType: { barnId: input.barnId, feedType: input.feedType } },
      });
      let currentRemaining = 0;
      if (existing) {
        const rate = (await ratesByFeedType(ctx.db, input.barnId)).get(input.feedType)?.ratePerDay ?? 0;
        const elapsedDays = Math.max(0, (Date.now() - existing.asOfDate.getTime()) / MS_PER_DAY);
        currentRemaining = Math.max(0, existing.servingsRemaining - rate * elapsedDays);
      }

      return ctx.db.feedStock.upsert({
        where: { barnId_feedType: { barnId: input.barnId, feedType: input.feedType } },
        create: {
          barnId: input.barnId,
          feedType: input.feedType,
          servingsRemaining: added,
          asOfDate,
          servingsPerContainer: input.servingsPerContainer,
        },
        update: {
          servingsRemaining: currentRemaining + added,
          asOfDate,
          servingsPerContainer: input.servingsPerContainer,
        },
      });
    }),

  setThreshold: protectedProcedure
    .input(
      z.object({
        barnId: z.string().cuid(),
        feedType: z.string().min(1).max(100),
        thresholdDays: z.number().int().min(0).max(365),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertBarnAccess(ctx.db, ctx.session.user.id, input.barnId);
      return ctx.db.feedStock.upsert({
        where: { barnId_feedType: { barnId: input.barnId, feedType: input.feedType } },
        create: {
          barnId: input.barnId,
          feedType: input.feedType,
          thresholdDays: input.thresholdDays,
          servingsRemaining: 0,
        },
        update: { thresholdDays: input.thresholdDays },
      });
    }),
});
