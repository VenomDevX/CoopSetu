"use client"

import * as React from "react"
import { format, parseISO } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export function DatePicker({
  value,
  onChange,
  className,
}: {
  value?: string;
  onChange?: (date: string) => void;
  className?: string;
}) {
  const date = value ? parseISO(value) : undefined;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "w-full h-9 px-3 bg-background border border-border rounded-[6px] text-sm focus:outline-none focus:border-foreground transition-colors flex items-center justify-between text-left font-mono",
            !date && "text-muted-foreground",
            className
          )}
        >
          {date ? format(date, "PPP") : <span>Pick a date</span>}
          <CalendarIcon className="h-4 w-4 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => onChange?.(d ? format(d, 'yyyy-MM-dd') : '')}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}
