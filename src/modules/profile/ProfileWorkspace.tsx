'use client';

import Image from 'next/image';
import { useState } from 'react';
import {
  FiActivity,
  FiBriefcase,
  FiCalendar,
  FiCheck,
  FiClock,
  FiEdit2,
  FiKey,
  FiMail,
  FiMapPin,
  FiMonitor,
  FiShield,
  FiUser,
  FiUsers,
} from 'react-icons/fi';

import { Avatar, Badge, Button, Card, PageHeader } from '@/shared/ui';

import { AvatarEditor } from './AvatarEditor';
import { BannerEditor } from './BannerEditor';
import { ProfileForms } from './ProfileForms';
import type { ProfileViewModel } from './profile-model';
import { SessionManager } from './SessionManager';
import { AvitoControlCard } from './AvitoControlCard';
import type { AvitoControl } from '@/modules/leads/avito/control';

type ProfileTab = 'overview' | 'data' | 'company' | 'security' | 'automation';

const tabs: { id: ProfileTab; label: string }[] = [
  { id: 'overview', label: 'Обзор' },
  { id: 'data', label: 'Данные' },
  { id: 'company', label: 'Компания' },
  { id: 'security', label: 'Безопасность' },
  { id: 'automation', label: 'Автоматизация' },
];

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="grid min-w-0 grid-cols-[2rem_minmax(0,1fr)] items-start gap-x-3 gap-y-1 border-b border-[var(--color-border)] py-3 last:border-0 sm:flex sm:items-center">
      <span className="row-span-2 grid size-8 shrink-0 place-items-center text-[var(--color-text-secondary)]">
        {icon}
      </span>
      <span className="min-w-0 flex-1 text-sm text-[var(--color-text-secondary)]">{label}</span>
      <span className="col-start-2 min-w-0 text-sm font-semibold [overflow-wrap:anywhere] break-words text-[var(--color-text)] sm:max-w-[58%] sm:text-right">
        {value}
      </span>
    </div>
  );
}

function Overview({ profile }: { profile: ProfileViewModel }) {
  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-[1.1fr_0.9fr]">
      <Card className="min-w-0 p-4 sm:p-5">
        <h2 className="text-lg font-bold text-[var(--color-text)]">О сотруднике</h2>
        <div className="mt-2">
          <DetailRow icon={<FiUser />} label="Имя" value={profile.user.name} />
          <DetailRow icon={<FiBriefcase />} label="Должность" value={profile.role.position} />
          <DetailRow icon={<FiMail />} label="E-mail" value={profile.user.email} />
          <DetailRow icon={<FiMapPin />} label="Офис" value={profile.company.office} />
          <DetailRow
            icon={<FiCalendar />}
            label="Дата регистрации"
            value={profile.account.registeredAt}
          />
          <DetailRow
            icon={<FiClock />}
            label="Последний вход"
            value={profile.account.lastLoginAt}
          />
        </div>
      </Card>

      <Card className="min-w-0 p-4 sm:p-5">
        <h2 className="text-lg font-bold text-[var(--color-text)]">Мои права</h2>
        <div className="mt-3 grid gap-2">
          {profile.role.permissions.map((permission, index) => {
            const icons = [FiShield, FiUsers, FiBriefcase, FiKey];
            const Icon = icons[index] ?? FiCheck;
            return (
              <div
                key={permission}
                className="flex items-center gap-3 rounded-xl bg-[var(--color-primary-soft)]/55 p-3"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-[var(--color-primary)] shadow-sm dark:bg-[var(--color-surface-elevated)]">
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--color-text)]">
                    {permission}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                    Разрешено вашей ролью
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="min-w-0 p-4 sm:p-5">
        <h2 className="text-base font-bold text-[var(--color-text)]">Последняя активность</h2>
        <div className="mt-3 space-y-4">
          <div className="flex gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
              <FiMonitor />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Вход в систему</p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                {profile.account.lastLoginAt} · текущая сессия
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
              <FiActivity />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Аккаунт работает</p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                СУПА ПРО · {profile.company.office}
              </p>
            </div>
          </div>
        </div>
      </Card>

      <Card className="min-w-0 p-4 sm:p-5">
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[var(--color-success-soft)] text-[var(--color-success)]">
            <FiShield className="size-6" />
          </span>
          <div className="min-w-0">
            <h2 className="font-bold text-[var(--color-text)]">Аккаунт защищён</h2>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Активных сессий: {profile.account.activeSessions}. Текущая действует до{' '}
              {profile.account.sessionExpiresAt}.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

export function ProfileWorkspace({
  profile,
  avito,
}: {
  profile: ProfileViewModel;
  avito?: AvitoControl | null;
}) {
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');

  return (
    <section aria-label="Профиль сотрудника" className="grid min-w-0 grid-cols-1 gap-5">
      <PageHeader
        title="Профиль"
        titleId="profile-page-title"
        actions={
          <Button type="button" variant="outline" onClick={() => setActiveTab('data')}>
            <FiEdit2 />
            Редактировать профиль
          </Button>
        }
      />
      <div className="relative min-h-[21rem] overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)]">
        <Image
          src={profile.bannerUrl ?? '/profile/profile-banner-bg.png'}
          alt=""
          fill
          priority
          unoptimized={Boolean(profile.bannerUrl)}
          sizes="(max-width: 768px) 100vw, 1100px"
          className="object-cover"
        />
        <BannerEditor />
        <div className="relative z-10 flex min-h-[21rem] items-end pt-28 sm:pt-36">
          <div
            data-testid="profile-identity-dock"
            className="flex w-full flex-col gap-4 border-t border-[var(--color-border)] bg-[var(--color-surface)]/95 p-4 shadow-[0_-12px_32px_-24px_rgba(15,23,42,0.45)] backdrop-blur-xl sm:gap-6 sm:px-7 sm:py-5 lg:flex-row lg:items-center lg:justify-between"
          >
            <div className="flex min-w-0 items-center gap-4 sm:gap-5">
              <AvatarEditor name={profile.user.name} avatarUrl={profile.user.avatarUrl} />
              <div className="min-w-0">
                <h2 className="text-2xl font-bold tracking-tight break-words text-[var(--color-text)] sm:text-3xl">
                  {profile.user.name}
                </h2>
                <p className="mt-1 text-sm font-medium break-words text-[var(--color-text-secondary)]">
                  {profile.role.position}
                </p>
                <p className="mt-1 text-sm font-semibold break-words text-[var(--color-text)]">
                  {profile.company.name}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 lg:max-w-[42%] lg:shrink-0 lg:justify-end">
              <Badge tone="success">
                <span className="mr-1 inline-block size-1.5 rounded-full bg-current" />
                {profile.account.status}
              </Badge>
              <Badge tone="primary">{profile.role.label}</Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="flex min-w-0 items-end gap-4 border-b border-[var(--color-border)]">
        <div
          role="tablist"
          aria-label="Разделы профиля"
          className="flex w-full min-w-0 gap-1 overflow-x-auto overscroll-x-contain"
        >
          {tabs
            .filter((tab) => tab.id !== 'automation' || avito)
            .map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`shrink-0 border-b-2 px-4 py-3 text-sm font-semibold transition ${activeTab === tab.id ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'}`}
              >
                {tab.label}
              </button>
            ))}
        </div>
      </div>

      <div role="tabpanel" className="min-w-0">
        {activeTab === 'overview' && <Overview profile={profile} />}
        {avito && (
          <div hidden={activeTab !== 'automation'} className="max-w-3xl space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Автоматизация</h2>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                Помощники для обработки обращений. Вы решаете, когда они работают.
              </p>
            </div>
            <AvitoControlCard initial={avito} />
          </div>
        )}
        {activeTab === 'data' && <ProfileForms user={profile.user} section="profile" />}
        {activeTab === 'company' && (
          <div className="grid min-w-0 gap-5 xl:grid-cols-[0.8fr_1.2fr]">
            <Card className="min-w-0 p-5">
              <h2 className="text-lg font-bold">Компания</h2>
              <div className="mt-3">
                <DetailRow icon={<FiBriefcase />} label="Название" value={profile.company.name} />
                <DetailRow
                  icon={<FiUser />}
                  label="Статус в компании"
                  value={profile.company.legalRole}
                />
                <DetailRow icon={<FiMapPin />} label="Офис" value={profile.company.office} />
                <DetailRow icon={<FiShield />} label="Роль в системе" value={profile.role.label} />
              </div>
            </Card>

            <Card className="min-w-0 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold">Сотрудники</h2>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                    {profile.company.members.length} в команде
                  </p>
                </div>
                <FiUsers className="size-6 text-[var(--color-primary)]" aria-hidden />
              </div>
              <div className="mt-4 grid gap-3">
                {profile.company.members.map((member) => (
                  <article
                    key={member.id}
                    className="flex min-w-0 items-center gap-3 rounded-xl border border-[var(--color-border)] p-3"
                  >
                    <Avatar
                      name={member.name}
                      src={member.avatarUrl}
                      size="lg"
                      className="shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-bold text-[var(--color-text)]">
                          {member.name}
                        </p>
                        <Badge tone={member.status === 'Активен' ? 'success' : 'neutral'}>
                          {member.status}
                        </Badge>
                      </div>
                      <p className="mt-0.5 flex flex-wrap gap-x-1 truncate text-sm text-[var(--color-text-secondary)]">
                        <span>{member.position}</span>
                        <span aria-hidden>·</span>
                        <span>{member.role}</span>
                      </p>
                      <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                        Последняя активность: {member.lastActivityAt}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </Card>
          </div>
        )}
        {activeTab === 'security' && (
          <div className="grid gap-5 xl:grid-cols-[0.7fr_1.3fr]">
            <Card className="p-5">
              <FiShield className="size-8 text-[var(--color-success)]" />
              <h2 className="mt-3 text-lg font-bold">Защита аккаунта</h2>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                Активных сессий: {profile.account.activeSessions}. Смена пароля завершит остальные
                сессии.
              </p>
            </Card>
            <ProfileForms user={profile.user} section="security" />
            <Card className="p-5 xl:col-span-2">
              <SessionManager sessions={profile.account.sessions} />
            </Card>
          </div>
        )}
      </div>
    </section>
  );
}
