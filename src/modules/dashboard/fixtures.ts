import type { FleetEvent, FleetStat, FuelSlice, MileagePoint, Vehicle } from './types';

// Демонстрационные данные изолированы от будущего серверного потока телеметрии.
export const fleetStats = [
  {
    id: 'total',
    label: 'Всего ТС',
    value: '128',
    detail: '+12,1% чем вчера',
    tone: 'success',
    icon: 'vehicle',
  },
  {
    id: 'moving',
    label: 'На ходу',
    value: '87',
    detail: '68% автопарка',
    tone: 'success',
    icon: 'activity',
  },
  {
    id: 'idle',
    label: 'Остановки',
    value: '21',
    detail: '16% автопарка',
    tone: 'warning',
    icon: 'pause',
  },
  {
    id: 'offline',
    label: 'Нет на связи',
    value: '8',
    detail: '6% автопарка',
    tone: 'danger',
    icon: 'signal',
  },
  {
    id: 'mileage',
    label: 'Пробег сегодня',
    value: '3 742 км',
    detail: '+11,2% за день',
    tone: 'success',
    icon: 'mileage',
  },
  {
    id: 'fuel',
    label: 'Расход топлива',
    value: '128 л',
    detail: '+8,4% за день',
    tone: 'success',
    icon: 'fuel',
  },
] satisfies readonly FleetStat[];

export const fleetEvents = [
  {
    id: 'speed',
    title: 'Превышение скорости',
    vehicleName: 'Haval Jolion',
    timeLabel: '12:46',
    tone: 'danger',
  },
  {
    id: 'geofence-enter',
    title: 'Въезд в геозону',
    vehicleName: 'Geely Atlas',
    timeLabel: '11:32',
    tone: 'warning',
  },
  {
    id: 'connection',
    title: 'Потеря связи',
    vehicleName: 'Kia K5',
    timeLabel: '10:21',
    tone: 'danger',
  },
  {
    id: 'battery',
    title: 'Низкий заряд АКБ',
    vehicleName: 'Lada Vesta',
    timeLabel: '09:15',
    tone: 'warning',
  },
  {
    id: 'geofence-office',
    title: 'Вход в геозону',
    vehicleName: 'Changan Uni-T',
    timeLabel: '08:45',
    tone: 'info',
  },
] satisfies readonly FleetEvent[];

export const mileageByDay = [
  { label: '13 июл', value: 720 },
  { label: '14 июл', value: 1380 },
  { label: '15 июл', value: 2180 },
  { label: '16 июл', value: 1760 },
  { label: '17 июл', value: 2360 },
  { label: '18 июл', value: 2980 },
  { label: '19 июл', value: 3742 },
] satisfies readonly MileagePoint[];

export const fuelBreakdown = [
  { label: 'По датчикам', value: 98, percent: 76, tone: 'primary' },
  { label: 'По норме', value: 20, percent: 16, tone: 'success' },
  { label: 'Слития', value: 10, percent: 8, tone: 'danger' },
] satisfies readonly FuelSlice[];

export const vehicles = [
  {
    id: 'haval-jolion',
    name: 'Haval Jolion',
    plate: 'А123ВС777',
    speedKph: 65,
    status: 'moving',
    longitude: 37.6173,
    latitude: 55.7558,
    lastSeenLabel: 'только что',
    fuelPercent: 74,
    mileageKm: 38420,
  },
  {
    id: 'geely-atlas',
    name: 'Geely Atlas',
    plate: 'М456ОР799',
    speedKph: 0,
    status: 'idle',
    longitude: 37.67,
    latitude: 55.76,
    lastSeenLabel: '2 минуты назад',
    fuelPercent: 51,
    mileageKm: 52108,
  },
  {
    id: 'kia-k5',
    name: 'Kia K5',
    plate: 'Т789КХ197',
    speedKph: 42,
    status: 'offline',
    longitude: 37.58,
    latitude: 55.74,
    lastSeenLabel: '18 минут назад',
    fuelPercent: 36,
    mileageKm: 68904,
  },
] satisfies readonly Vehicle[];
