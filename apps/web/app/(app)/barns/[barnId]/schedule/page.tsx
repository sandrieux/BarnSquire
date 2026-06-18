import { redirect } from "next/navigation";
import Link from "next/link";
import { CalendarClock, Bell } from "lucide-react";
import { auth } from "@/lib/auth";
import { createServerCaller } from "@/lib/trpc/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatTime } from "@/lib/utils";

const TYPE_LABELS: Record<string, string> = {
  VET: "Veterinary",
  FARRIER: "Farrier",
  DENTAL: "Dental",
  CHIRO: "Chiropractic",
  GROOMING: "Grooming",
  OTHER: "Other",
};

export default async function SchedulePage({ params }: { params: Promise<{ barnId: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");

  const { barnId } = await params;
  const caller = await createServerCaller();
  const [appointments, reminders] = await Promise.all([
    caller.appointment.list({ barnId, upcoming: true }),
    caller.appointment.listReminders({ barnId }),
  ]);

  // Group appointments by date (YYYY-MM-DD)
  const byDate = new Map<string, typeof appointments>();
  for (const appt of appointments) {
    const key = new Date(appt.scheduledAt).toISOString().slice(0, 10);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(appt);
  }
  const sortedDates = Array.from(byDate.keys()).sort();

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Schedule</h1>

      {/* Reminders */}
      {reminders.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="h-4 w-4" /> Recurring reminders
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {reminders.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-sm">
                <span>
                  <Badge variant="secondary" className="mr-2">{TYPE_LABELS[r.type]}</Badge>
                  {r.title}
                </span>
                <span className="text-muted-foreground">
                  every {r.repeatWeeks}w · next {formatDate(r.nextRemindAt)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Upcoming appointments grouped by date */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Upcoming appointments</h2>
        {sortedDates.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
            No upcoming appointments scheduled.
          </div>
        ) : (
          sortedDates.map((date) => (
            <div key={date} className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground">{formatDate(date)}</h3>
              {byDate.get(date)!.map((appt) => (
                <Card key={appt.id}>
                  <CardContent className="p-4 flex items-start gap-3">
                    <div className="rounded-full p-2 bg-blue-100 text-blue-700 shrink-0">
                      <CalendarClock className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary">{TYPE_LABELS[appt.type]}</Badge>
                        <span className="font-medium">{appt.title}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {formatTime(appt.scheduledAt)}
                        {" · "}
                        <Link
                          href={`/barns/${barnId}/animals/${appt.animal.id}`}
                          className="text-primary hover:underline"
                        >
                          {appt.animal.name}
                        </Link>
                        {appt.providerName ? ` · ${appt.providerName}` : ""}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
