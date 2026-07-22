export interface OperationsCalendarEvent {
  id: string;
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
