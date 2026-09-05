"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

// react-day-picker v10 (bumped from v8): classNames keys and the nav-icon
// component API both changed. Mapping from the old v8 keys this component
// used to the current ones (per node_modules/react-day-picker's own
// UI/Chevron type declarations):
//   caption -> month_caption, table -> month_grid, head_row -> weekdays,
//   head_cell -> weekday, row -> week, cell -> day, day -> day_button,
//   day_selected -> selected, day_today -> today, day_outside -> outside,
//   day_disabled -> disabled, day_range_middle -> range_middle,
//   day_hidden -> hidden. nav_button (+ _previous/_next variants) is now two
//   separate keys with no shared umbrella, so the previously-shared classes
//   are applied to both. IconLeft/IconRight are replaced by a single
//   Chevron component that takes an `orientation` prop instead of two
//   separate components.
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  const navButtonClass = "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 flex items-center justify-center rounded-[6px]"
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        month_caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-medium",
        nav: "space-x-1 flex items-center",
        button_previous: cn(navButtonClass, "absolute left-1"),
        button_next: cn(navButtonClass, "absolute right-1"),
        month_grid: "w-full border-collapse space-y-1",
        weekdays: "flex",
        weekday: "text-muted-foreground rounded-[6px] w-8 font-normal text-[0.8rem]",
        week: "flex w-full mt-2",
        day: "text-center text-sm p-0 relative [&:has([aria-selected])]:bg-white/10 first:[&:has([aria-selected])]:rounded-l-[6px] last:[&:has([aria-selected])]:rounded-r-[6px] focus-within:relative focus-within:z-20",
        day_button: cn(
          "h-8 w-8 p-0 font-normal aria-selected:opacity-100 rounded-[6px] hover:bg-white/10 hover:text-white"
        ),
        selected: "bg-white text-black hover:bg-white hover:text-black focus:bg-white focus:text-black",
        today: "bg-white/20 text-white font-bold",
        outside: "text-white/30",
        disabled: "text-white/30",
        range_middle: "aria-selected:bg-white/10 aria-selected:text-white",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, ...iconProps }) =>
          orientation === "left"
            ? <ChevronLeft className="h-4 w-4" {...iconProps} />
            : <ChevronRight className="h-4 w-4" {...iconProps} />,
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
