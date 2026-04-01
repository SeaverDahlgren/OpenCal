export type CalendarViewport = {
  visibleMonth: Date;
  selectedDate: string;
};

export type CalendarLoadPlan = {
  requestId: number;
  viewport: CalendarViewport;
};

export class CalendarNavigationController {
  private latestRequestId = 0;
  private viewport: CalendarViewport;

  constructor(initialViewport: CalendarViewport) {
    this.viewport = cloneViewport(initialViewport);
  }

  planRefresh(): CalendarLoadPlan {
    return this.plan(this.viewport);
  }

  planMonthShift(offset: number): CalendarLoadPlan {
    const targetMonth = startOfMonth(
      new Date(this.viewport.visibleMonth.getFullYear(), this.viewport.visibleMonth.getMonth() + offset, 1, 12),
    );
    const focusDate = toDateOnly(new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1, 12));
    return this.plan({
      visibleMonth: targetMonth,
      selectedDate: focusDate,
    });
  }

  planToday(now = new Date()): CalendarLoadPlan {
    return this.plan(createInitialCalendarViewport(now));
  }

  planSelectDay(date: string): CalendarLoadPlan {
    return this.plan({
      visibleMonth: startOfMonth(new Date(`${date}T12:00:00`)),
      selectedDate: date,
    });
  }

  isCurrent(requestId: number) {
    return requestId === this.latestRequestId;
  }

  private plan(viewport: CalendarViewport): CalendarLoadPlan {
    const nextViewport = normalizeViewport(viewport);
    this.viewport = nextViewport;
    this.latestRequestId += 1;
    return {
      requestId: this.latestRequestId,
      viewport: cloneViewport(nextViewport),
    };
  }
}

export function createInitialCalendarViewport(now = new Date()): CalendarViewport {
  return {
    visibleMonth: startOfMonth(now),
    selectedDate: toDateOnly(now),
  };
}

export function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1, 12);
}

export function toDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function cloneViewport(viewport: CalendarViewport): CalendarViewport {
  return {
    visibleMonth: new Date(viewport.visibleMonth),
    selectedDate: viewport.selectedDate,
  };
}

function normalizeViewport(viewport: CalendarViewport): CalendarViewport {
  return {
    visibleMonth: startOfMonth(viewport.visibleMonth),
    selectedDate: viewport.selectedDate,
  };
}
