"use client";

import {
  FiHome,
  FiMap,
  FiTruck,
  FiCpu,
  FiClock,
  FiAlertTriangle,
  FiShield,
  FiBarChart2,
  FiUsers,
  FiBriefcase,
  FiBell,
  FiFileText,
  FiSettings,
} from "react-icons/fi";

const menu = [
  {
    name: "Панель управления",
    icon: FiHome,
    active: true,
  },
  {
    name: "Онлайн-карта",
    icon: FiMap,
  },
  {
    name: "Автомобили",
    icon: FiTruck,
  },
  {
    name: "Устройства",
    icon: FiCpu,
  },
  {
    name: "История маршрутов",
    icon: FiClock,
  },
  {
    name: "События",
    icon: FiAlertTriangle,
  },
  {
    name: "Геозоны",
    icon: FiShield,
  },
  {
    name: "Аналитика и отчёты",
    icon: FiBarChart2,
  },
  {
    name: "Пользователи",
    icon: FiUsers,
  },
  {
    name: "Компании",
    icon: FiBriefcase,
  },
  {
    name: "Уведомления",
    icon: FiBell,
  },
  {
    name: "Журнал действий",
    icon: FiFileText,
  },
  {
    name: "Настройки",
    icon: FiSettings,
  },
];

export function Sidebar() {
  return (
    <aside
      className="
        fixed
        left-0
        top-16
        bottom-0
        w-[280px]
        
        /* СТЕКЛОМОРФИЗМ И ГЛУБИНА */
        bg-white/70
        backdrop-blur-2xl
        backdrop-saturate-150
        
        /* ГРАНИЦЫ И ТЕНИ */
        border-r
        border-white/20
        shadow-[4px_0_24px_rgba(0,0,0,0.02),8px_0_48px_rgba(0,0,0,0.01)]
        
        flex
        flex-col
        
        px-5
        py-6
        
        z-40
        
        /* ПЛАВНЫЕ ПЕРЕХОДЫ */
        transition-all
        duration-500
      "
    >
      {/* MENU — ЛАКОНИЧНАЯ МОЩЬ */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto custom-scrollbar">
        {menu.map((item) => {
          const Icon = item.icon;

          return (
            <div
              key={item.name}
              className={`
                group
                flex items-center gap-3
                rounded-xl
                px-3 py-2.5
                cursor-pointer
                text-sm font-medium
                transition-all duration-300
                relative
                ${
                  item.active
                    ? `
                      bg-gradient-to-r from-[#0092BE]/10 to-[#0092BE]/5
                      text-[#0092BE]
                      shadow-sm
                      /* ПОЛОСКА АКТИВНОГО ПУНКТА */
                      before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2
                      before:h-5 before:w-[3px] before:rounded-r-full before:bg-[#0092BE]
                    `
                    : `
                      text-[#64748B]
                      hover:bg-[#F1F5F9]/80
                      hover:text-[#0092BE]
                      hover:shadow-sm
                    `
                }
              `}
            >
              <div
                className={`
                  flex h-9 w-9 items-center justify-center
                  rounded-lg
                  transition-all duration-300
                  ${
                    item.active
                      ? "bg-[#0092BE] text-white shadow-md shadow-[#0092BE]/20"
                      : "group-hover:bg-[#0092BE]/10 group-hover:shadow-sm"
                  }
                `}
              >
                <Icon size={18} />
              </div>
              <span className="truncate">{item.name}</span>
              
              {/* ИНДИКАТОР АКТИВНОСТИ (ТОЧКА СПРАВА) */}
              {item.active && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#0092BE] opacity-60" />
              )}
            </div>
          );
        })}
      </nav>

      {/* FOOTER — МИНИМАЛИЗМ */}
      <div className="border-t border-[#E2E8F0]/60 pt-4 mt-2">
        <div className="px-3 flex items-center justify-between">
          <div className="text-[11px] font-medium text-[#64748B] tracking-wide">
            Pilot+ Enterprise
          </div>
          <div className="text-[10px] font-mono text-[#94A3B8] bg-[#F1F5F9] px-2 py-0.5 rounded-full">
            v1.0.0
          </div>
        </div>
      </div>
    </aside>
  );
}