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

type Slot = "MORNING" | "LUNCH" | "AFTERNOON" | "EVENING";

// Map a "HH:MM" time of day to a Today filter slot. Windows:
// Morning 06:00–12:00, Lunch 12:00–13:00, Afternoon 13:00–18:00, Evening otherwise.
function timeToSlot(hhmm: string): Slot {
  const [h = 0, m = 0] = hhmm.split(":").map(Number);
  const mins = h * 60 + m;
  if (mins >= 360 && mins < 720) return "MORNING";
  if (mins >= 720 && mins < 780) return "LUNCH";
  if (mins >= 780 && mins < 1080) return "AFTERNOON";
  return "EVENING";
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

      const weekday = targetDate.getDay() === 0 ? 7 : targetDate.getDay();
      const [animals, feedings, appointments, turnouts, exercises, scheduledEvents, completions] = await Promise.all([
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
            repeatDays: { has: weekday },
          },
          include: { fromStall: true, toStall: true, fromPasture: true, toPasture: true },
          orderBy: { startTime: "asc" },
        }),
        ctx.db.exerciseSchedule.findMany({
          where: {
            isActive: true,
            animal: { barnId: input.barnId, isActive: true },
            repeatDays: { has: weekday },
          },
          include: {
            locationArena: { select: { name: true } },
            locationPasture: { select: { name: true } },
          },
          orderBy: { startTime: "asc" },
        }),
        ctx.db.scheduledEvent.findMany({
          where: {
            isActive: true,
            barnId: input.barnId,
            repeatDays: { has: weekday },
          },
          orderBy: { startTime: "asc" },
        }),
        ctx.db.taskCompletion.findMany({
          where: {
            scheduledDate: targetDate,
            OR: [{ animal: { barnId: input.barnId } }, { scheduledEvent: { barnId: input.barnId } }],
          },
        }),
      ]);

      const completionMap = new Map(
        completions.map((c) => [
          c.feedingScheduleId ?? c.appointmentId ?? c.turnoutEventId ?? c.exerciseScheduleId ?? c.scheduledEventId,
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
        type: "stall" | "pasture" | "unassigned" | "barn";
        buildingName?: string;
        tasks: Array<{
          id: string;
          taskType: "FEEDING" | "MEDICATION" | "APPOINTMENT" | "TURNOUT" | "EXERCISE" | "SCHEDULED_EVENT";
          animalId: string;
          animalName: string;
          label: string;
          detail: string;
          slot: Slot;
          // Structured feed fields (feeding/medication tasks only) for the prep matrix.
          feedType?: string;
          quantity?: string;
          unit?: string | null;
          instructions?: string | null;
          completion: typeof completions[number] | undefined;
        }>;
      };

      const groups = new Map<string, LocationGroup>();

      const getOrCreateGroup = (
        groupId: string,
        name: string,
        type: "stall" | "pasture" | "unassigned" | "barn",
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
          slot: feeding.slot === "CUSTOM" ? timeToSlot(feeding.customTime ?? "00:00") : (feeding.slot as Slot),
          feedType: feeding.feedType,
          quantity: feeding.quantity,
          unit: feeding.unit,
          instructions: feeding.instructions,
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
        const apptDate = new Date(appt.scheduledAt);
        const time = apptDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        const apptHhmm = `${String(apptDate.getHours()).padStart(2, "0")}:${String(apptDate.getMinutes()).padStart(2, "0")}`;
        group.tasks.push({
          id: appt.id,
          taskType: "APPOINTMENT",
          animalId: appt.animalId,
          animalName: animal.name,
          label: `${appt.type}: ${appt.title}`,
          detail: `${time}${appt.providerName ? " — " + appt.providerName : ""}`,
          slot: timeToSlot(apptHhmm),
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
          slot: timeToSlot(turnout.startTime),
          completion: completionMap.get(turnout.id),
        });
      }

      for (const exercise of exercises) {
        const animal = animalMap.get(exercise.animalId);
        if (!animal) continue;
        const groupId = animal.homeStallId ?? animal.homePastureId ?? "unassigned";
        const groupName = animal.homeStall?.name ?? animal.homePasture?.name ?? "No Location";
        const groupType = animal.homeStallId ? "stall" : animal.homePastureId ? "pasture" : "unassigned";
        const buildingName = animal.homeStall?.building?.name;
        const group = getOrCreateGroup(groupId, groupName, groupType, buildingName);
        const typeLabel = exercise.type.replace(/_/g, " ").toLowerCase();
        const time = exercise.endTime ? `${exercise.startTime} – ${exercise.endTime}` : exercise.startTime;
        const locationName = exercise.locationArena?.name ?? exercise.locationPasture?.name;
        const detailParts = [time];
        if (locationName) detailParts.push(locationName);
        if (exercise.trainer) detailParts.push(exercise.trainer);
        group.tasks.push({
          id: exercise.id,
          taskType: "EXERCISE",
          animalId: exercise.animalId,
          animalName: animal.name,
          label: `Exercise: ${typeLabel}`,
          detail: detailParts.join(" · "),
          slot: timeToSlot(exercise.startTime),
          completion: completionMap.get(exercise.id),
        });
      }

      // Barn-level scheduled events (animal-less) go in a dedicated "Barn" group.
      for (const event of scheduledEvents) {
        const group = getOrCreateGroup("barn", "Barn", "barn");
        group.tasks.push({
          id: event.id,
          taskType: "SCHEDULED_EVENT",
          animalId: "",
          animalName: "",
          label: event.title,
          detail: event.endTime ? `${event.startTime} – ${event.endTime}` : event.startTime,
          slot: timeToSlot(event.startTime),
          completion: completionMap.get(event.id),
        });
      }

      return Array.from(groups.values()).sort((a, b) => {
        // Barn-level group always sorts first.
        if (a.type === "barn") return -1;
        if (b.type === "barn") return 1;
        if (a.buildingName && b.buildingName) return a.buildingName.localeCompare(b.buildingName);
        return a.name.localeCompare(b.name);
      });
    }),

  completeTask: protectedProcedure
    .input(z.object({
      barnId: z.string().cuid(),
      date: z.string().date(),
      taskType: z.enum(["FEEDING", "MEDICATION", "APPOINTMENT", "TURNOUT", "EXERCISE", "SCHEDULED_EVENT"]),
      animalId: z.string().cuid().optional(),
      feedingScheduleId: z.string().cuid().optional(),
      appointmentId: z.string().cuid().optional(),
      turnoutEventId: z.string().cuid().optional(),
      exerciseScheduleId: z.string().cuid().optional(),
      scheduledEventId: z.string().cuid().optional(),
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
          exerciseScheduleId_scheduledDate: input.exerciseScheduleId
            ? { exerciseScheduleId: input.exerciseScheduleId, scheduledDate }
            : undefined as never,
          scheduledEventId_scheduledDate: input.scheduledEventId
            ? { scheduledEventId: input.scheduledEventId, scheduledDate }
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
      taskType: z.enum(["FEEDING", "MEDICATION", "APPOINTMENT", "TURNOUT", "EXERCISE", "SCHEDULED_EVENT"]),
      animalId: z.string().cuid().optional(),
      feedingScheduleId: z.string().cuid().optional(),
      appointmentId: z.string().cuid().optional(),
      turnoutEventId: z.string().cuid().optional(),
      exerciseScheduleId: z.string().cuid().optional(),
      scheduledEventId: z.string().cuid().optional(),
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
          exerciseScheduleId: input.exerciseScheduleId,
          scheduledEventId: input.scheduledEventId,
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
