import { describe, expect, it } from "vitest";
import { CalendarNavigationController, createInitialCalendarViewport } from "../apps/web/src/calendar-navigation.js";

describe("web calendar navigation", () => {
  it("computes sequential month shifts from the latest planned viewport", () => {
    const controller = new CalendarNavigationController({
      visibleMonth: new Date(2026, 2, 1, 12),
      selectedDate: "2026-03-31",
    });

    const april = controller.planMonthShift(1);
    const may = controller.planMonthShift(1);

    expect(april.viewport.selectedDate).toBe("2026-04-01");
    expect(april.viewport.visibleMonth.getMonth()).toBe(3);
    expect(may.viewport.selectedDate).toBe("2026-05-01");
    expect(may.viewport.visibleMonth.getMonth()).toBe(4);
  });

  it("ignores stale responses once a newer month request is planned", () => {
    const controller = new CalendarNavigationController(createInitialCalendarViewport(new Date(2026, 2, 31, 12)));

    const first = controller.planMonthShift(1);
    const second = controller.planMonthShift(1);

    expect(controller.isCurrent(first.requestId)).toBe(false);
    expect(controller.isCurrent(second.requestId)).toBe(true);
  });

  it("moves the visible month to the selected day when picking a date in another month", () => {
    const controller = new CalendarNavigationController(createInitialCalendarViewport(new Date(2026, 2, 31, 12)));

    const selected = controller.planSelectDay("2026-04-03");

    expect(selected.viewport.selectedDate).toBe("2026-04-03");
    expect(selected.viewport.visibleMonth.getFullYear()).toBe(2026);
    expect(selected.viewport.visibleMonth.getMonth()).toBe(3);
    expect(selected.viewport.visibleMonth.getDate()).toBe(1);
  });
});
