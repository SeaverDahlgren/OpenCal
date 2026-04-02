import { appendDebugLog } from "../../../../src/memory/logs.js";
import { z } from "zod";
import { mapCalendarDayView, mapCalendarMonthView, mapTodayOverview } from "../dto/mappers.js";
import { buildHostedMemoryContext } from "../memory/context.js";
import { createTodayRecommendationGenerator } from "../recommendations/generator.js";
import { TodayRecommendationService } from "../recommendations/service.js";
import { hostedDebugLogPath } from "../runtime/filesystem.js";
import { jsonError, jsonRoute, readJsonBody } from "../server/http.js";
import type { AuthedRouteContext } from "./types.js";
import { buildExpandedUtcDayBounds, buildExpandedUtcMonthBounds, dateKeyInTimezone, resolveUserTimezone } from "./utils.js";

const monthQuerySchema = z.object({
  year: z.coerce.number().int(),
  month: z.coerce.number().int().min(1).max(12),
});

const dayQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const createEventSchema = z.object({
  summary: z.string().min(1),
  start: z.string().min(1),
  end: z.string().min(1),
  location: z.string().optional(),
  description: z.string().optional(),
});

export async function handleCalendarRoute(ctx: AuthedRouteContext) {
  if (ctx.req.method === "GET" && ctx.url.pathname === "/api/v1/today") {
    const debugLogPath = hostedDebugLogPath(ctx.config);
    const forceRefresh = ["1", "true", "yes"].includes(
      (ctx.url.searchParams.get("refreshPlan") ?? "").toLowerCase(),
    );
    const timezone = resolveUserTimezone(ctx.profile);
    const today = dateKeyInTimezone(new Date(), timezone);
    const { timeMin, timeMax } = buildExpandedUtcDayBounds(today);
    const events = await ctx.calendarService.searchEvents({
      calendarId: "primary",
      timeMin,
      timeMax,
      maxResults: 25,
    });
    const overview = mapTodayOverview({
      date: today,
      timezone,
      events,
    });
    let insight = null;
    try {
      const memories = await ctx.memories.listByEmail(ctx.session.user.email);
      const recommendations = new TodayRecommendationService(
        ctx.recommendations,
        createTodayRecommendationGenerator(ctx.config),
        (error) => {
          void appendDebugLog(debugLogPath, "today.recommendation.error", {
            userEmail: ctx.session.user.email,
            date: today,
            error: error instanceof Error ? error.message : String(error),
          });
        },
      );
      insight = await recommendations.getOrCreate({
        user: ctx.session.user,
        profile: ctx.profile,
        memoryContext: buildHostedMemoryContext(memories),
        date: today,
        timezone,
        schedule: overview.schedule,
      }, {
        forceRefresh,
      });
    } catch (error) {
      await appendDebugLog(debugLogPath, "today.recommendation.error", {
        userEmail: ctx.session.user.email,
        date: today,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return await jsonRoute(
      ctx.res,
      200,
      {
        ...overview,
        insight,
      },
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
    const timezone = resolveUserTimezone(ctx.profile);
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
    const timezone = resolveUserTimezone(ctx.profile);
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

  if (ctx.req.method === "POST" && ctx.url.pathname === "/api/v1/calendar/events") {
    const body = createEventSchema.parse(await readJsonBody(ctx.req, ctx.config.maxRequestBodyBytes));
    const created = await ctx.calendarService.createEvent({
      summary: body.summary,
      start: body.start,
      end: body.end,
      location: body.location,
      description: body.description,
    });
    return await jsonRoute(ctx.res, 201, {
      eventId: created.id,
      summary: created.summary,
    });
  }

  return false;
}
