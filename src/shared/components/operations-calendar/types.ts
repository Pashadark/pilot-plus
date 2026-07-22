export interface OperationsCalendarEvent {
  id: string;
  /** Строгий RFC3339-момент с `Z` или смещением `±HH:mm`. */
  startsAt: string;
  title: string;
  vehicleLabel: string;
  statusLabel: string;
  tone: 'neutral' | 'primary' | 'success' | 'warning' | 'danger';
  icon: 'tool' | 'droplet';
}

export interface CalendarDay {
  isoDate: string;
  dayNumber: number;
  inCurrentMonth: boolean;
  isToday: boolean;
  events: readonly OperationsCalendarEvent[];
}

export interface CalendarMonth {
  month: string;
  label: string;
  days: readonly CalendarDay[];
}
