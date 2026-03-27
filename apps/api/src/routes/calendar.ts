import { z } from "zod";
import { mapCalendarDayView, mapCalendarMonthView, mapTodayOverview } from "../dto/mappers.js";
import { jsonError, jsonRoute } from "../server/http.js";
import type { AuthedRouteContext } from "./types.js";
import { buildExpandedUtcDayBounds, buildExpandedUtcMonthBounds, dateKeyInTimezone, resolveUserTimezone } from "./utils.js";

const monthQuerySchema = z.object({
  year: z.coerce.number().int(),
  month: z.coerce.number().int().min(1).max(12),
});

const dayQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function handleCalendarRoute(ctx: AuthedRouteContext) {
  if (ctx.req.method === "GET" && ctx.url.pathname === "/api/v1/today") {
    const timezone = resolveUserTimezone(ctx.workspace.user);
    const today = dateKeyInTimezone(new Date(), timezone);
    const { timeMin, timeMax } = buildExpandedUtcDayBounds(today);
    const events = await ctx.calendarService.searchEvents({
      calendarId: "primary",
      timeMin,
      timeMax,
      maxResults: 25,
    });
    return await jsonRoute(
      ctx.res,
      200,
      mapTodayOverview({
        date: today,
        timezone,
        events,
      }),
    );
  }

  if (ctx.req.method === "GET" && ctx.url.pathname === "/api/v1/calendar/month") {
    const parsed = monthQuerySchema.safeParse({
      year: ctx.url.searchParams.get("year"),
      month: ctx.url.searchParams.get("month"),
    });
    if (!parsed.success) {
      return await jsonError(ctx.res, 400, "VALIDATION_ERROR", "year and month are required.", false);
    }
    const { year, month } = parsed.data;
    const timezone = resolveUserTimezone(ctx.workspace.user);
    const { timeMin, timeMax } = buildExpandedUtcMonthBounds(year, month);
    const events = await ctx.calendarService.searchEvents({
      calendarId: "primary",
      timeMin,
      timeMax,
      maxResults: 250,
    });
    return await jsonRoute(
      ctx.res,
      200,
      mapCalendarMonthView({
        year,
        month,
        timezone,
        events,
      }),
    );
  }

  if (ctx.req.method === "GET" && ctx.url.pathname === "/api/v1/calendar/day") {
    const parsed = dayQuerySchema.safeParse({
      date: ctx.url.searchParams.get("date"),
    });
    if (!parsed.success) {
      return await jsonError(ctx.res, 400, "VALIDATION_ERROR", "date is required.", false);
    }
    const { date } = parsed.data;
    const timezone = resolveUserTimezone(ctx.workspace.user);
    const { timeMin, timeMax } = buildExpandedUtcDayBounds(date);
    const events = await ctx.calendarService.searchEvents({
      calendarId: "primary",
      timeMin,
      timeMax,
      maxResults: 100,
    });
    return await jsonRoute(
      ctx.res,
      200,
      mapCalendarDayView({
        date,
        timezone,
        events,
      }),
    );
  }

  return false;
}
