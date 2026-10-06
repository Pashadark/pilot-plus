// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { TrackDateControls } from './TrackDateControls';

afterEach(()=>{ cleanup(); vi.useRealTimers(); });
it('selects yesterday by calendar date even when API only returned today',()=>{
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-19T00:30:00+03:00'));
  const onChange=vi.fn(); const onPeriodChange=vi.fn();
  render(<TrackDateControls dates={['2026-09-19']} value="2026-09-19" period="day" onChange={onChange} onPeriodChange={onPeriodChange}/>);
  fireEvent.click(screen.getByRole('button',{name:'18.09.2026'}));
  expect(onChange).toHaveBeenCalledWith('2026-09-18');
  expect(onPeriodChange).toHaveBeenCalledWith('day');
  expect(screen.queryByRole('button',{name:'Сегодня'})).toBeNull();
  expect(screen.queryByRole('button',{name:'7 дней'})).toBeNull();
});
it('keeps a selected older date visible and ignores cleared calendar',()=>{
  const onChange=vi.fn();
  render(<TrackDateControls dates={[]} value="2026-08-01" period="day" onChange={onChange} onPeriodChange={vi.fn()}/>);
  expect(screen.getByRole('button',{name:'01.08.2026'}).getAttribute('aria-pressed')).toBe('true');
  fireEvent.change(screen.getByLabelText('Выбрать любую дату'),{target:{value:''}});
  expect(onChange).not.toHaveBeenCalled();
});

it('переключает соседние дни стрелками и показывает компактные подписи',()=>{
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-04T12:00:00+03:00'));
  const onChange=vi.fn();
  render(<TrackDateControls dates={[]} value="2026-10-04" period="day" onChange={onChange} onPeriodChange={vi.fn()}/>);

  expect(screen.getByRole('button',{name:'04.10.2026'}).textContent).toContain('Сегодня');
  expect(screen.getByRole('button',{name:'03.10.2026'}).textContent).toContain('03 окт');
  fireEvent.click(screen.getByRole('button',{name:'Предыдущий день'}));
  expect(onChange).toHaveBeenCalledWith('2026-10-03');
});
