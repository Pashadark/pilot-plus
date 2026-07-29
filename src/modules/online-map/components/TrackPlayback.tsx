import { FiPause, FiPlay } from 'react-icons/fi';

import { Button } from '@/shared/ui';

export interface TrackPlaybackProps {
  progress: number;
  playing: boolean;
  reducedMotion: boolean;
  onProgressChange: (progress: number) => void;
  onPlayingChange: (playing: boolean) => void;
}

export function TrackPlayback({
  progress,
  playing,
  reducedMotion,
  onProgressChange,
  onPlayingChange,
}: TrackPlaybackProps) {
  const motionHint = reducedMotion
    ? 'Сокращение анимации включено: используйте ползунок вручную.'
    : undefined;

  return (
    <div className="flex min-h-11 items-center gap-3">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        aria-label={playing ? 'Приостановить маршрут' : 'Воспроизвести маршрут'}
        title={motionHint}
        disabled={reducedMotion}
        onClick={() => onPlayingChange(!playing)}
        className="shrink-0"
      >
        {playing ? (
          <FiPause aria-hidden="true" className="size-5" />
        ) : (
          <FiPlay aria-hidden="true" className="size-5" />
        )}
      </Button>
      <input
        type="range"
        min="0"
        max="100"
        step="any"
        value={progress}
        aria-label="Положение на маршруте"
        onChange={(event) => onProgressChange(Number(event.currentTarget.value))}
        className="min-h-11 min-w-0 flex-1 cursor-pointer accent-[var(--color-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
      />
    </div>
  );
}
