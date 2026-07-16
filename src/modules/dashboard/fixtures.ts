import type { FleetEvent, FleetStat, Vehicle } from './types';

// Демонстрационные данные изолированы от будущего серверного потока телеметрии.
export const fleetStats = [
  { id: 'total', label: 'Всего автомобилей', value: '245', detail: '+12 сегодня', tone: 'primary' },
  { id: 'online', label: 'На связи', value: '231', detail: '94% парка', tone: 'success' },
  { id: 'offline', label: 'Нет связи', value: '5', detail: 'Требуют внимания', tone: 'danger' },
  { id: 'maintenance', label: 'Требуется ТО', value: '9', detail: 'Запланировано', tone: 'warning' },
] satisfies readonly FleetStat[];

export const fleetEvents = [
  { id: 'geofence', title: 'Автомобиль покинул геозону', vehicleName: 'Haval Jolion', timeLabel: '2 минуты назад', tone: 'danger' },
  { id: 'connection', title: 'Нет связи с устройством', vehicleName: 'Geely Atlas', timeLabel: '18 минут назад', tone: 'warning' },
  { id: 'maintenance', title: 'Приближается обслуживание', vehicleName: 'Kia K5', timeLabel: '1 час назад', tone: 'info' },
] satisfies readonly FleetEvent[];

export const vehicles = [
  { id: 'haval-jolion', name: 'Haval Jolion', plate: 'А123ВС777', speedKph: 65, status: 'moving', longitude: 37.6173, latitude: 55.7558, lastSeenLabel: 'только что', fuelPercent: 74, mileageKm: 38420 },
  { id: 'geely-atlas', name: 'Geely Atlas', plate: 'М456ОР799', speedKph: 0, status: 'idle', longitude: 37.67, latitude: 55.76, lastSeenLabel: '2 минуты назад', fuelPercent: 51, mileageKm: 52108 },
  { id: 'kia-k5', name: 'Kia K5', plate: 'Т789КХ197', speedKph: 42, status: 'offline', longitude: 37.58, latitude: 55.74, lastSeenLabel: '18 минут назад', fuelPercent: 36, mileageKm: 68904 },
] satisfies readonly Vehicle[];
