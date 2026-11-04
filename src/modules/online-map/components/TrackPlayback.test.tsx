// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { TrackPlayback } from './TrackPlayback';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it('shows trip time and maps progress to the current clock time', () => {
  render(
    <TrackPlayback
      progress={25}
      playing={false}
      reducedMotion={false}
      startTimestamp="14:30:00"
      finishTimestamp="16:30:00"
      onProgressChange={() => undefined}
      onPlayingChange={() => undefined}
    />,
  );

  expect(screen.getByText('15:00')).toBeTruthy();
  expect(screen.getByText('16:30')).toBeTruthy();
});

it('opens a five-minute precision timeline after the user lingers on the main timeline', () => {
  vi.useFakeTimers();

  render(
    <TrackPlayback
      progress={25}
      playing={false}
      reducedMotion={false}
      startTimestamp="14:30:00"
      finishTimestamp="16:30:00"
      onProgressChange={() => undefined}
      onPlayingChange={() => undefined}
    />,
  );

  const timeline = screen.getByTestId('playback-main-timeline');
  fireEvent.pointerEnter(timeline);
  act(() => vi.advanceTimersByTime(500));

  const precision = screen.getByRole('group', { name: 'Точная шкала времени' });
  expect(precision).toBeTruthy();
  expect(screen.getByText('15:05')).toBeTruthy();
  expect(screen.getByText('15:10')).toBeTruthy();
});

it('seeks to an exact five-minute mark on the precision timeline', () => {
  vi.useFakeTimers();
  const onProgressChange = vi.fn();

  render(
    <TrackPlayback
      progress={25}
      playing={false}
      reducedMotion={false}
      startTimestamp="14:30:00"
      finishTimestamp="16:30:00"
      onProgressChange={onProgressChange}
      onPlayingChange={() => undefined}
    />,
  );

  fireEvent.pointerEnter(screen.getByTestId('playback-main-timeline'));
  act(() => vi.advanceTimersByTime(500));
  fireEvent.click(screen.getByRole('button', { name: 'Перемотать на 15:10' }));

  expect(onProgressChange).toHaveBeenCalledWith(expect.closeTo(33.333, 2));
});

it('offers real-time route playback speeds without decorative color themes', () => {
  const onPlaybackSpeedChange = vi.fn();

  render(
    <TrackPlayback
      progress={0}
      playing={false}
      reducedMotion={false}
      onProgressChange={() => undefined}
      onPlayingChange={() => undefined}
      playbackSpeed={1}
      onPlaybackSpeedChange={onPlaybackSpeedChange}
    />,
  );

  expect(screen.queryByRole('button', { name: 'Скорость 2x' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Скорость 1x' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Скорость 5x' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Скорость 10x' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Скорость 30x' }));
  expect(onPlaybackSpeedChange).toHaveBeenCalledWith(30);
});
