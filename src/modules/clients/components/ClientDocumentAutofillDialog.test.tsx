// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ClientDocumentAutofillDialog } from './ClientDocumentAutofillDialog';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function image(name: string) {
  return new File([new Uint8Array([1, 2, 3])], name, { type: 'image/jpeg' });
}

function selected(file: File) {
  return { 0: file, length: 1, item: () => file };
}

describe('ClientDocumentAutofillDialog', () => {
  it('просит три документа и заполняет форму объединённым результатом', async () => {
    const onApply = vi.fn();
    const files = {
      passportMain: image('passport-main.jpg'),
      passportRegistration: image('registration.jpg'),
      driverLicense: image('licence.jpg'),
    };
    const responses: Record<string, Record<string, string>> = {
      PASSPORT_MAIN: { firstName: 'ИВАН', passportSeries: '4518' },
      PASSPORT_REGISTRATION: { registrationAddress: 'Г. МОСКВА, УЛ. ТВЕРСКАЯ, Д. 1' },
      DRIVER_LICENSE: { driverLicense: '99 24 267195' },
    };
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = init?.body as FormData;
      const kind = String(body.get('documentKind'));
      return new Response(JSON.stringify({ fields: responses[kind] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<ClientDocumentAutofillDialog open onOpenChange={vi.fn()} onApply={onApply} />);

    expect(screen.getByLabelText('Основной разворот паспорта')).toBeTruthy();
    expect(screen.getByLabelText('Страница с регистрацией')).toBeTruthy();
    expect(screen.getByLabelText('Водительское удостоверение')).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Распознать и заполнить' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    fireEvent.change(screen.getByLabelText('Основной разворот паспорта'), {
      target: { files: selected(files.passportMain) },
    });
    fireEvent.change(screen.getByLabelText('Страница с регистрацией'), {
      target: { files: selected(files.passportRegistration) },
    });
    fireEvent.change(screen.getByLabelText('Водительское удостоверение'), {
      target: { files: selected(files.driverLicense) },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Распознать и заполнить' }));

    await waitFor(() => expect(onApply).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(onApply).toHaveBeenCalledWith(
      {
        firstName: 'ИВАН',
        passportSeries: '4518',
        registrationAddress: 'Г. МОСКВА, УЛ. ТВЕРСКАЯ, Д. 1',
        driverLicense: '99 24 267195',
      },
      files,
    );
  });

  it('применяет удачные результаты и пропускает дальше, если один документ не распознан', async () => {
    const onApply = vi.fn();
    const onOpenChange = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        const kind = String((init?.body as FormData).get('documentKind'));
        if (kind === 'PASSPORT_REGISTRATION') {
          return new Response(JSON.stringify({ error: 'Не удалось распознать документ.' }), {
            status: 422,
            headers: { 'content-type': 'application/json' },
          });
        }
        return new Response(
          JSON.stringify({ fields: kind === 'PASSPORT_MAIN' ? { lastName: 'ИВАНОВ' } : {} }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }),
    );
    render(<ClientDocumentAutofillDialog open onOpenChange={onOpenChange} onApply={onApply} />);
    for (const [label, file] of [
      ['Основной разворот паспорта', image('passport.jpg')],
      ['Страница с регистрацией', image('registration.jpg')],
      ['Водительское удостоверение', image('licence.jpg')],
    ] as const) {
      fireEvent.change(screen.getByLabelText(label), { target: { files: selected(file) } });
    }
    fireEvent.click(screen.getByRole('button', { name: 'Распознать и заполнить' }));

    await waitFor(() => expect(onApply).toHaveBeenCalledOnce());
    expect(onApply.mock.calls[0]?.[0]).toEqual({ lastName: 'ИВАНОВ' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
