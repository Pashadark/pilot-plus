import { FiAlertTriangle, FiCpu, FiHome, FiLayers, FiMap, FiTruck } from 'react-icons/fi';

export const navigation = [
  { label: 'Панель управления', href: '/', icon: FiHome },
  { label: 'Онлайн-карта', href: '/map', icon: FiMap },
  { label: 'Автомобили', href: '/vehicles', icon: FiTruck },
  { label: 'Устройства', href: '/devices', icon: FiCpu },
  { label: 'События', href: '/events', icon: FiAlertTriangle },
  { label: 'Дизайн-система', href: '/ui-kit', icon: FiLayers },
] as const;
