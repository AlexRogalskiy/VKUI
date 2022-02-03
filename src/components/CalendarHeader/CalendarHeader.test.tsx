import ru from "date-fns/locale/ru";
import { render } from "@testing-library/react";
import { CalendarHeader, getYears, getMonths } from "./CalendarHeader";

describe("CalendarHeader", () => {
  it("displays prev month button", () => {
    const viewDate = new Date("1970-01-01");
    const onChange = jest.fn();
    const { container } = render(
      <CalendarHeader viewDate={viewDate} onChange={onChange} prevMonth />
    );

    expect(
      container.getElementsByClassName("CalendarHeader__nav-icon-prev")[0]
    ).toBeTruthy();
  });
  it("displays next month button", () => {
    const viewDate = new Date("1970-01-01");
    const onChange = jest.fn();
    const { container } = render(
      <CalendarHeader viewDate={viewDate} onChange={onChange} nextMonth />
    );

    expect(
      container.getElementsByClassName("CalendarHeader__nav-icon-next")[0]
    ).toBeTruthy();
  });
  describe("getYears", () => {
    it("returns years options", () => {
      const result = getYears(2000, 5);

      expect(result).toEqual([
        {
          label: "1995",
          value: 1995,
        },
        {
          label: "1996",
          value: 1996,
        },
        {
          label: "1997",
          value: 1997,
        },
        {
          label: "1998",
          value: 1998,
        },
        {
          label: "1999",
          value: 1999,
        },
        {
          label: "2000",
          value: 2000,
        },
        {
          label: "2001",
          value: 2001,
        },
        {
          label: "2002",
          value: 2002,
        },
        {
          label: "2003",
          value: 2003,
        },
        {
          label: "2004",
          value: 2004,
        },
        {
          label: "2005",
          value: 2005,
        },
      ]);
    });
  });
  describe("getMonths", () => {
    it("returns months options", () => {
      const result = getMonths(ru);

      expect(result).toEqual([
        {
          label: "январь",
          value: 0,
        },
        {
          label: "февраль",
          value: 1,
        },
        {
          label: "март",
          value: 2,
        },
        {
          label: "апрель",
          value: 3,
        },
        {
          label: "май",
          value: 4,
        },
        {
          label: "июнь",
          value: 5,
        },
        {
          label: "июль",
          value: 6,
        },
        {
          label: "август",
          value: 7,
        },
        {
          label: "сентябрь",
          value: 8,
        },
        {
          label: "октябрь",
          value: 9,
        },
        {
          label: "ноябрь",
          value: 10,
        },
        {
          label: "декабрь",
          value: 11,
        },
      ]);
    });
  });
});