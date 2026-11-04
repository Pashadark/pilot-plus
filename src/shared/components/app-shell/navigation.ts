import {
  FiActivity,
  FiBarChart2,
  FiAlertTriangle,
  FiAlertCircle,
  FiCpu,
  FiCreditCard,
  FiDroplet,
  FiHome,
  FiLayers,
  FiFileText,
  FiMap,
  FiPhoneCall,
  FiSettings,
  FiTool,
  FiTruck,
  FiUsers,
} from 'react-icons/fi';
import type { IconType } from 'react-icons';
import type { SafeUser } from '@/modules/auth/types';

export interface NavigationItem {
  label: string;
  href: string;
  icon: IconType;
  adminOnly?: boolean;
  requiredCapability?: 'CLIENTS' | 'RENTALS' | 'FINES';
}

export const navigation: readonly NavigationItem[] = [
  { label: 'Панель управления', href: '/', icon: FiHome },
  { label: 'Онлайн-карта', href: '/map', icon: FiMap },
  { label: 'Автопарк', href: '/vehicles', icon: FiTruck },
  { label: 'Клиенты', href: '/clients', icon: FiUsers, requiredCapability: 'CLIENTS' },
  { label: 'Заявки', href: '/leads', icon: FiPhoneCall, requiredCapability: 'CLIENTS' },
  { label: 'Аренда', href: '/rentals', icon: FiFileText, requiredCapability: 'RENTALS' },
  { label: 'Статистика', href: '/statistics', icon: FiBarChart2, requiredCapability: 'RENTALS' },
  { label: 'Штрафы', href: '/fines', icon: FiAlertCircle, requiredCapability: 'FINES' },
  { label: 'Залоги', href: '/deposits', icon: FiCreditCard, requiredCapability: 'RENTALS' },
  { label: 'Техническое обслуживание', href: '/maintenance', icon: FiTool },
  { label: 'Мойка', href: '/wash', icon: FiDroplet },
  { label: 'Устройства', href: '/devices', icon: FiCpu },
  { label: 'События', href: '/events', icon: FiAlertTriangle },
  { label: 'Администрирование', href: '/admin', icon: FiSettings, adminOnly: true },
  { label: 'Состояние системы', href: '/system', icon: FiActivity },
  { label: 'Дизайн-система', href: '/ui-kit', icon: FiLayers },
];

export function getVisibleNavigation(user: SafeUser) {
  return navigation.filter(
    (item) =>
      (item.href !== '/system' || user.role === 'SUPER_ADMIN') &&
      (!item.adminOnly || user.canAccessAdmin) &&
      (!item.requiredCapability || user.capabilities?.includes(item.requiredCapability)),
  );
}
