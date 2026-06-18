import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { expandScheduleForDate } from "./feeding";

async function assertBarnAccess(
  db: import("@barnsquire/db").PrismaClient,
  userId: string,
  barnId: string
) {
  const membership = await db.barnMembership.findUnique({
    where: { userId_barnId: { userId, barnId } },
  });
  if (!membership) throw new TRPCError({ code: "FORBIDDEN" });
  return membership;
}

export const todayRouter = router({
  getDailyView: protectedProcedure
    .input(z.object({ barnId: z.string().cuid(), date: z.string().date() }))
    .query(async ({ ctx, input }) => {
      await assertBarnAccess(ctx.db, ctx.session.user.id, input.barnId);
      // Construct local midnight so getDay() yields the correct weekday
      // (new Date("YYYY-MM-DD") would parse as UTC midnight and shift the day).
      const [ty, tm, td] = input.date.split("-").map(Number);
      const targetDate = new Date(ty!, tm! - 1, td!);

      const [animals, feedings, appointments, turnouts, completions] = await Promise.all([
        ctx.db.animal.findMany({
          where: { barnId: input.barnId, isActive: true },
          include: {
            homeStall: { include: { building: { select: { id: true, name: true } } } },
            homePasture: true,
          },
          orderBy: { name: "asc" },
        }),
        ctx.db.feedingSchedule.findMany({
          where: {
            isActive: true,
            animal: { barnId: input.barnId, isActive: true },
            startDate: { lte: targetDate },
            OR: [{ endDate: null }, { endDate: { gte: targetDate } }],
          },
        }),
        ctx.db.appointment.findMany({
          where: {
            barnId: input.barnId,
            scheduledAt: {
              gte: new Date(input.date),
              lt: new Date(new Date(input.date).setDate(new Date(input.date).getDate() + 1)),
            },
          },
          orderBy: { scheduledAt: "asc" },
        }),
        ctx.db.turnoutEvent.findMany({
          where: {
            isActive: true,
            animal: { barnId: input.barnId },
            repeatDays: { has: targetDate.getDay() === 0 ? 7 : targetDate.getDay() },
          },
          include: { fromStall: true, toStall: true, fromPasture: true, toPasture: true },
          orderBy: { startTime: "asc" },
        }),
        ctx.db.taskCompletion.findMany({
          where: {
            scheduledDate: targetDate,
            animal: { barnId: input.barnId },
          },
        }),
      ]);

      const completionMap = new Map(
        completions.map((c) => [
          c.feedingScheduleId ?? c.appointmentId ?? c.turnoutEventId,
          c,
        ])
      );

      const activeFeedings = feedings.filter((f) =>
        expandScheduleForDate(
          { startDate: f.startDate, endDate: f.endDate, repeatDays: f.repeatDays },
          targetDate
        )
      );

      // Group by location
      type LocationGroup = {
        id: string;
        name: string;
        type: "stall" | "pasture" | "unassigned";
        buildingName?: string;
        tasks: Array<{
          id: string;
          taskType: "FEEDING" | "MEDICATION" | "APPOINTMENT" | "TURNOUT";
          animalId: string;
          animalName: string;
          label: string;
          detail: string;
          completion: typeof completions[number] | undefined;
        }>;
      };

      const groups = new Map<string, LocationGroup>();

      const getOrCreateGroup = (
        groupId: string,
        name: string,
        type: "stall" | "pasture" | "unassigned",
        buildingName?: string
      ): LocationGroup => {
        if (!groups.has(groupId)) {
          groups.set(groupId, { id: groupId, name, type, buildingName, tasks: [] });
        }
        return groups.get(groupId)!;
      };

      const animalMap = new Map(animals.map((a) => [a.id, a]));

      for (const feeding of activeFeedings) {
        const animal = animalMap.get(feeding.animalId);
        if (!animal) continue;
        const groupId = animal.homeStallId ?? animal.homePastureId ?? "unassigned";
        const groupName = animal.homeStall?.name ?? animal.homePasture?.name ?? "No Location";
        const groupType = animal.homeStallId ? "stall" : animal.homePastureId ? "pasture" : "unassigned";
        const buildingName = animal.homeStall?.building?.name;
        const group = getOrCreateGroup(groupId, groupName, groupType, buildingName);
        group.tasks.push({
          id: feeding.id,
          taskType: feeding.isMedication ? "MEDICATION" : "FEEDING",
          animalId: feeding.animalId,
          animalName: animal.name,
          label: `${feeding.slot}: ${feeding.feedType}`,
          detail: `${feeding.quantity}${feeding.unit ? " " + feeding.unit : ""}${feeding.instructions ? " — " + feeding.instructions : ""}`,
          completion: completionMap.get(feeding.id),
        });
      }

      for (const appt of appointments) {
        const animal = animalMap.get(appt.animalId);
        if (!animal) continue;
        const groupId = animal.homeStallId ?? animal.homePastureId ?? "unassigned";
        const groupName = animal.homeStall?.name ?? animal.homePasture?.name ?? "No Location";
        const groupType = animal.homeStallId ? "stall" : animal.homePastureId ? "pasture" : "unassigned";
        const buildingName = animal.homeStall?.building?.name;
        const group = getOrCreateGroup(groupId, groupName, groupType, buildingName);
        const time = new Date(appt.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        group.tasks.push({
          id: appt.id,
          taskType: "APPOINTMENT",
          animalId: appt.animalId,
          animalName: animal.name,
          label: `${appt.type}: ${appt.title}`,
          detail: `${time}${appt.providerName ? " — " + appt.providerName : ""}`,
          completion: completionMap.get(appt.id),
        });
      }

      for (const turnout of turnouts) {
        const animal = animalMap.get(turnout.animalId);
        if (!animal) continue;
        const groupId = animal.homeStallId ?? animal.homePastureId ?? "unassigned";
        const groupName = animal.homeStall?.name ?? animal.homePasture?.name ?? "No Location";
        const groupType = animal.homeStallId ? "stall" : animal.homePastureId ? "pasture" : "unassigned";
        const buildingName = animal.homeStall?.building?.name;
        const group = getOrCreateGroup(groupId, groupName, groupType, buildingName);
        const toName = turnout.toStall?.name ?? turnout.toPasture?.name ?? "?";
        group.tasks.push({
          id: turnout.id,
          taskType: "TURNOUT",
          animalId: turnout.animalId,
          animalName: animal.name,
          label: `Turnout → ${toName}`,
          detail: `${turnout.startTime} – ${turnout.endTime}`,
          completion: completionMap.get(turnout.id),
        });
      }

      return Array.from(groups.values()).sort((a, b) => {
        if (a.buildingName && b.buildingName) return a.buildingName.localeCompare(b.buildingName);
        return a.name.localeCompare(b.name);
      });
    }),

  completeTask: protectedProcedure
    .input(z.object({
      barnId: z.string().cuid(),
      date: z.string().date(),
      taskType: z.enum(["FEEDING", "MEDICATION", "APPOINTMENT", "TURNOUT"]),
      animalId: z.string().cuid(),
      feedingScheduleId: z.string().cuid().optional(),
      appointmentId: z.string().cuid().optional(),
      turnoutEventId: z.string().cuid().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertBarnAccess(ctx.db, ctx.session.user.id, input.barnId);
      const { barnId: _b, date, ...rest } = input;
      const scheduledDate = new Date(date);
      return ctx.db.taskCompletion.upsert({
        where: {
          feedingScheduleId_scheduledDate: input.feedingScheduleId
            ? { feedingScheduleId: input.feedingScheduleId, scheduledDate }
            : undefined as never,
          appointmentId_scheduledDate: input.appointmentId
            ? { appointmentId: input.appointmentId, scheduledDate }
            : undefined as never,
          turnoutEventId_scheduledDate: input.turnoutEventId
            ? { turnoutEventId: input.turnoutEventId, scheduledDate }
            : undefined as never,
        } as never,
        create: {
          ...rest,
          scheduledDate,
          completedAt: new Date(),
          completedByUserId: ctx.session.user.id,
          skipped: false,
        },
        update: {
          completedAt: new Date(),
          skipped: false,
          notes: input.notes,
        },
      });
    }),

  skipTask: protectedProcedure
    .input(z.object({
      barnId: z.string().cuid(),
      date: z.string().date(),
      taskType: z.enum(["FEEDING", "MEDICATION", "APPOINTMENT", "TURNOUT"]),
      animalId: z.string().cuid(),
      feedingScheduleId: z.string().cuid().optional(),
      appointmentId: z.string().cuid().optional(),
      turnoutEventId: z.string().cuid().optional(),
      skipReason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertBarnAccess(ctx.db, ctx.session.user.id, input.barnId);
      const scheduledDate = new Date(input.date);
      return ctx.db.taskCompletion.create({
        data: {
          taskType: input.taskType,
          scheduledDate,
          animalId: input.animalId,
          feedingScheduleId: input.feedingScheduleId,
          appointmentId: input.appointmentId,
          turnoutEventId: input.turnoutEventId,
          skipped: true,
          skipReason: input.skipReason,
          completedByUserId: ctx.session.user.id,
        },
      });
    }),

  getCompletionHistory: protectedProcedure
    .input(z.object({
      barnId: z.string().cuid(),
      animalId: z.string().cuid().optional(),
      date: z.string().date(),
    }))
    .query(async ({ ctx, input }) => {
      await assertBarnAccess(ctx.db, ctx.session.user.id, input.barnId);
      return ctx.db.taskCompletion.findMany({
        where: {
          scheduledDate: new Date(input.date),
          animalId: input.animalId,
          animal: { barnId: input.barnId },
        },
        include: {
          completedBy: { select: { id: true, name: true, email: true } },
          animal: { select: { id: true, name: true } },
        },
        orderBy: { completedAt: "desc" },
      });
    }),
});
