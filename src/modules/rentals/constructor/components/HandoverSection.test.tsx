// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { RentalConstructorState } from '../domain/types';
import { HandoverSection } from './HandoverSection';

afterEach(cleanup);

describe('HandoverSection', () => {
  it('collects issuance readings and only explicit received-payment flags', () => {
    const onChange = vi.fn();
    const state: RentalConstructorState = {
      agreementType: 'STANDARD',
      clientMode: 'existing',
      depositMinor: 1_500_000,
    };
    render(<HandoverSection state={state} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Одометр при выдаче, км *'), {
      target: { value: '84639' },
    });
    fireEvent.click(screen.getByLabelText('Аренда оплачена'));

    expect(onChange).toHaveBeenCalledWith({ startMileageKm: 84639 });
    expect(onChange).toHaveBeenCalledWith({ rentReceived: true });
    expect(screen.getByLabelText('Залог получен')).toBeTruthy();
  });
});
