'use client';

import Image from 'next/image';
import { useState } from 'react';
import { FiCamera, FiCheck, FiChevronRight, FiFileText, FiMaximize, FiUser } from 'react-icons/fi';

import {
  uploadClientDocumentAction,
  uploadClientPhotoAction,
} from '@/modules/client-documents/actions';
import type { ClientOcrFields } from '@/modules/clients/document-ocr';
import { applyClientOcrReviewAction } from '@/modules/clients/actions';
import { Button } from '@/shared/ui';

import styles from './RentalDocumentScanStep.module.css';
import { dateInputValue } from './rental-document-review';

type Client = {
  id: string;
  companyId: string;
  firstName?: string;
  middleName?: string | null;
  lastName?: string;
  fullName: string;
  birthDate?: string | null;
  phone: string | null;
  additionalPhone?: string | null;
  email?: string | null;
  passport: string | null;
  registrationAddress?: string | null;
  actualAddress?: string | null;
  driverLicense: string | null;
  driverLicenseIssuedAt?: string | null;
  driverLicenseExpiresAt: string | null;
  status?: string;
  updatedAt?: string;
  localPhotoUrl?: string | null;
  documentsReady?: boolean;
};

type OcrResponse = { fields?: ClientOcrFields; portrait?: string | null; error?: string };
type ScanPhase =
  'idle' | 'preparing' | 'recognizing' | 'portrait' | 'review' | 'saving' | 'done' | 'error';

function dataUrlFile(dataUrl: string) {
  const [header, payload] = dataUrl.split(',');
  const mime = /data:([^;]+)/u.exec(header ?? '')?.[1] ?? 'image/webp';
  const bytes = Uint8Array.from(atob(payload ?? ''), (character) => character.charCodeAt(0));
  return new File([bytes], 'passport-portrait.webp', { type: mime });
}

async function recognize(kind: 'PASSPORT_MAIN' | 'DRIVER_LICENSE', file: File) {
  const payload = new FormData();
  payload.set('documentKind', kind);
  payload.set('file', file);
  const response = await fetch('/clients/document-ocr', { method: 'POST', body: payload });
  const result = (await response.json()) as OcrResponse;
  if (!response.ok) throw new Error(result.error || 'Не удалось распознать документ.');
  return result;
}

export function RentalDocumentScanStep({
  client,
  onReady,
}: {
  client: Client;
  onReady: (ready: boolean) => void;
}) {
  const [passportFile, setPassportFile] = useState<File | null>(null);
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<ScanPhase>(client.documentsReady ? 'done' : 'idle');
  const [fields, setFields] = useState<ClientOcrFields>({});
  const [portrait, setPortrait] = useState<string | null>(client.localPhotoUrl ?? null);
  const [error, setError] = useState('');

  const phaseLabel = {
    idle: 'Добавьте два документа',
    preparing: 'Подготавливаем изображения',
    recognizing: 'Распознаём данные',
    portrait: 'Выделяем фотографию клиента',
    review: 'Проверьте распознанные данные',
    saving: 'Проверяем и сохраняем',
    done: 'Документы готовы',
    error: 'Нужна повторная проверка',
  }[phase];
  const scannerHint = {
    idle: 'Наведите камеру на разворот паспорта',
    preparing: 'Подготавливаем изображения',
    recognizing: 'Читаем паспорт и водительское удостоверение',
    portrait: 'Выделяем фотографию клиента',
    review: 'Результат готов — проверьте данные ниже',
    saving: 'Сохраняем подтверждённые данные',
    done: 'Паспорт, права и фотография сохранены',
    error: 'Проверьте фотографии и попробуйте ещё раз',
  }[phase];

  async function scan() {
    if (!passportFile || !licenseFile) {
      setError('Добавьте основной разворот паспорта и водительское удостоверение.');
      return;
    }
    setError('');
    setPhase('preparing');
    try {
      await new Promise((resolve) => setTimeout(resolve, 180));
      setPhase('recognizing');
      const [passport, license] = await Promise.all([
        recognize('PASSPORT_MAIN', passportFile),
        recognize('DRIVER_LICENSE', licenseFile),
      ]);
      const merged = { ...passport.fields, ...license.fields };
      setFields(merged);
      setPhase('portrait');
      if (passport.portrait) setPortrait(passport.portrait);

      await new Promise((resolve) => setTimeout(resolve, 120));
      setPhase('review');
    } catch (scanError) {
      setPhase('error');
      setError(scanError instanceof Error ? scanError.message : 'Не удалось обработать документы.');
    }
  }

  function setField(field: keyof ClientOcrFields, value: string) {
    setFields((current) => ({ ...current, [field]: value }));
  }

  async function confirm() {
    if (!passportFile || !licenseFile) return;
    setError('');
    try {
      setPhase('saving');

      const update = new FormData();
      update.set('clientId', client.id);
      update.set('companyId', client.companyId);
      update.set('expectedUpdatedAt', client.updatedAt ?? '');
      update.set(
        'firstName',
        fields.firstName ?? client.firstName ?? client.fullName.split(' ')[1] ?? '',
      );
      update.set('middleName', fields.middleName ?? client.middleName ?? '');
      update.set(
        'lastName',
        fields.lastName ?? client.lastName ?? client.fullName.split(' ')[0] ?? '',
      );
      update.set('birthDate', dateInputValue(fields.birthDate ?? client.birthDate));
      update.set(
        'passport',
        [fields.passportSeries, fields.passportNumber].filter(Boolean).join(' ') ||
          client.passport ||
          '',
      );
      update.set('driverLicense', fields.driverLicense ?? client.driverLicense ?? '');
      update.set(
        'driverLicenseIssuedAt',
        dateInputValue(fields.driverLicenseIssuedAt ?? client.driverLicenseIssuedAt),
      );
      update.set(
        'driverLicenseExpiresAt',
        dateInputValue(fields.driverLicenseExpiresAt ?? client.driverLicenseExpiresAt),
      );
      const updated = await applyClientOcrReviewAction({ status: 'idle' }, update);
      if (updated.status === 'error') throw new Error(updated.message);

      const uploadDocument = (
        file: File,
        category: 'PASSPORT' | 'DRIVER_LICENSE',
        title: string,
      ) => {
        const upload = new FormData();
        upload.set('clientId', client.id);
        upload.set('uploadId', crypto.randomUUID());
        upload.set('category', category);
        upload.set('title', title);
        upload.set('file', file);
        return uploadClientDocumentAction({ status: 'idle' }, upload);
      };
      const uploads = await Promise.all([
        uploadDocument(passportFile, 'PASSPORT', 'Паспорт — основной разворот'),
        uploadDocument(licenseFile, 'DRIVER_LICENSE', 'Водительское удостоверение'),
        portrait?.startsWith('data:')
          ? (() => {
              const upload = new FormData();
              upload.set('clientId', client.id);
              upload.set('uploadId', crypto.randomUUID());
              upload.set('file', dataUrlFile(portrait));
              return uploadClientPhotoAction({ status: 'idle' }, upload);
            })()
          : null,
      ]);
      const failed = uploads.find((result) => result?.status === 'error');
      if (failed) throw new Error(failed.message);
      setPhase('done');
      onReady(true);
    } catch (scanError) {
      setPhase('error');
      setError(scanError instanceof Error ? scanError.message : 'Не удалось обработать документы.');
    }
  }

  return (
    <section className={styles.root} aria-labelledby="documents-title">
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Шаг 1 · Документы</p>
          <h2 id="documents-title">Сканируем документы клиента</h2>
          <p>Система заполнит реквизиты и подготовит фотографию профиля.</p>
        </div>
      </div>

      {['preparing', 'recognizing', 'portrait'].includes(phase) ? (
        <section
          className={styles.scannerStage}
          data-active="true"
          aria-label="Сканирование паспорта"
        >
          <div className={styles.scannerViewport}>
            <Image
              className={styles.passportCover}
              src="/documents/passport-cover.png"
              alt="Обложка паспорта"
              width={360}
              height={540}
              priority
            />
            <FiMaximize className={styles.scannerCorners} aria-hidden="true" />
            <span className={styles.scanBeam} data-testid="passport-scan-beam" aria-hidden="true" />
          </div>
          <div className={styles.scannerCopy}>
            <strong>Автоматически распознаём данные</strong>
            <span>{scannerHint}</span>
          </div>
        </section>
      ) : null}

      <div className={styles.uploads}>
        <label data-ready={Boolean(passportFile)}>
          <FiFileText aria-hidden="true" />
          <span>
            <strong>Паспорт</strong>
            <small>{passportFile?.name ?? 'Основной разворот с фотографией'}</small>
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            onChange={(event) => setPassportFile(event.target.files?.[0] ?? null)}
          />
          <b>{passportFile ? <FiCheck /> : <FiChevronRight />}</b>
        </label>
        <label data-ready={Boolean(licenseFile)}>
          <FiFileText aria-hidden="true" />
          <span>
            <strong>Водительское удостоверение</strong>
            <small>{licenseFile?.name ?? 'Лицевая сторона'}</small>
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            onChange={(event) => setLicenseFile(event.target.files?.[0] ?? null)}
          />
          <b>{licenseFile ? <FiCheck /> : <FiChevronRight />}</b>
        </label>
        <div className={styles.clientCard}>
          <span className={styles.clientPhoto}>
            {portrait ? (
              <Image src={portrait} alt="Фотография клиента" width={56} height={56} unoptimized />
            ) : (
              <FiUser aria-hidden="true" />
            )}
          </span>
          <span>
            <strong>{client.fullName}</strong>
            <small>Проверьте данные перед продолжением</small>
          </span>
          <FiChevronRight aria-hidden="true" />
        </div>
      </div>

      <p className={styles.phaseStatus} aria-live="polite">
        <FiCamera aria-hidden="true" />
        <span>
          <strong>{phaseLabel}</strong>
          <small>Данные остаются внутри Supa Pro</small>
        </span>
      </p>

      {phase === 'review' || phase === 'saving' ? (
        <section className={styles.review} aria-labelledby="ocr-review-title">
          <div className={styles.reviewHeading}>
            <div>
              <p className={styles.eyebrow}>Результат сканирования</p>
              <h3 id="ocr-review-title">Проверьте распознанные данные</h3>
            </div>
            <span>Поля можно исправить до сохранения</span>
          </div>
          <div className={styles.reviewGrid}>
            <label>
              <span>Фамилия</span>
              <input
                value={fields.lastName ?? client.lastName ?? client.fullName.split(' ')[0] ?? ''}
                onChange={(event) => setField('lastName', event.target.value)}
              />
            </label>
            <label>
              <span>Имя</span>
              <input
                value={fields.firstName ?? client.firstName ?? client.fullName.split(' ')[1] ?? ''}
                onChange={(event) => setField('firstName', event.target.value)}
              />
            </label>
            <label>
              <span>Отчество</span>
              <input
                value={fields.middleName ?? client.middleName ?? ''}
                onChange={(event) => setField('middleName', event.target.value)}
              />
            </label>
            <label>
              <span>Дата рождения</span>
              <input
                type="date"
                value={dateInputValue(fields.birthDate ?? client.birthDate)}
                onChange={(event) => setField('birthDate', event.target.value)}
              />
            </label>
            <label>
              <span>Серия паспорта</span>
              <input
                value={fields.passportSeries ?? client.passport?.split(' ')[0] ?? ''}
                onChange={(event) => setField('passportSeries', event.target.value)}
              />
            </label>
            <label>
              <span>Номер паспорта</span>
              <input
                value={fields.passportNumber ?? client.passport?.split(' ')[1] ?? ''}
                onChange={(event) => setField('passportNumber', event.target.value)}
              />
            </label>
            <label>
              <span>Водительское удостоверение</span>
              <input
                value={fields.driverLicense ?? client.driverLicense ?? ''}
                onChange={(event) => setField('driverLicense', event.target.value)}
              />
            </label>
            <label>
              <span>Права действуют до</span>
              <input
                type="date"
                value={dateInputValue(
                  fields.driverLicenseExpiresAt ?? client.driverLicenseExpiresAt,
                )}
                onChange={(event) => setField('driverLicenseExpiresAt', event.target.value)}
              />
            </label>
          </div>
        </section>
      ) : null}
      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
      {!client.documentsReady || phase !== 'done' ? (
        <div className={styles.actions}>
          {phase === 'review' || phase === 'saving' ? (
            <Button type="button" onClick={confirm} disabled={phase === 'saving'}>
              Подтвердить и сохранить
            </Button>
          ) : (
            <Button
              type="button"
              onClick={scan}
              disabled={['preparing', 'recognizing', 'portrait'].includes(phase)}
            >
              {phase === 'error' ? 'Попробовать ещё раз' : 'Распознать документы'}
            </Button>
          )}
        </div>
      ) : null}
    </section>
  );
}
