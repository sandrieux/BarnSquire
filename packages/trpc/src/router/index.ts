import { router } from "../trpc";
import { barnRouter } from "./barn";
import { locationRouter } from "./location";
import { animalRouter } from "./animal";
import { feedingRouter } from "./feeding";
import { appointmentRouter } from "./appointment";
import { turnoutRouter } from "./turnout";
import { todayRouter } from "./today";
import { mediaRouter } from "./media";
import { adminRouter } from "./admin";

export const appRouter = router({
  barn: barnRouter,
  location: locationRouter,
  animal: animalRouter,
  feeding: feedingRouter,
  appointment: appointmentRouter,
  turnout: turnoutRouter,
  today: todayRouter,
  media: mediaRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
