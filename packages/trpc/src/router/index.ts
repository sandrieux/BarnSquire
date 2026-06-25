import { router } from "../trpc";
import { barnRouter } from "./barn";
import { locationRouter } from "./location";
import { animalRouter } from "./animal";
import { feedingRouter } from "./feeding";
import { appointmentRouter } from "./appointment";
import { turnoutRouter } from "./turnout";
import { exerciseRouter } from "./exercise";
import { scheduledEventRouter } from "./scheduledEvent";
import { feedStockRouter } from "./feedStock";
import { todayRouter } from "./today";
import { mediaRouter } from "./media";
import { ledgerRouter } from "./ledger";
import { adminRouter } from "./admin";
import { userRouter } from "./user";

export const appRouter = router({
  user: userRouter,
  barn: barnRouter,
  location: locationRouter,
  animal: animalRouter,
  feeding: feedingRouter,
  appointment: appointmentRouter,
  turnout: turnoutRouter,
  exercise: exerciseRouter,
  scheduledEvent: scheduledEventRouter,
  feedStock: feedStockRouter,
  today: todayRouter,
  media: mediaRouter,
  ledger: ledgerRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
