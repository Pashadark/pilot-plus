import {
  FiActivity,
  FiAlertTriangle,
  FiCpu,
  FiDroplet,
  FiHome,
  FiLayers,
  FiMap,
  FiTool,
  FiTruck,
} from 'react-icons/fi';

export const navigation = [
  { label: 'Панель управления', href: '/', icon: FiHome },
  { label: 'Онлайн-карта', href: '/map', icon: FiMap },
  { label: 'Автопарк', href: '/vehicles', icon: FiTruck },
  { label: 'Техническое обслуживание', href: '/maintenance', icon: FiTool },
  { label: 'Мойка', href: '/wash', icon: FiDroplet },
  { label: 'Устройства', href: '/devices', icon: FiCpu },
  { label: 'События', href: '/events', icon: FiAlertTriangle },
  { label: 'Состояние системы', href: '/system', icon: FiActivity },
  { label: 'Дизайн-система', href: '/ui-kit', icon: FiLayers },
] as const;
