import { useId } from 'react';
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
  const motionHintId = useId();
  const motionHint = reducedMotion
    ? 'Сокращение анимации включено: используйте ползунок вручную.'
    : undefined;

  return (
    <div className="flex min-h-11 items-center gap-3">
      {motionHint ? (
        <span id={motionHintId} className="sr-only">
          {motionHint}
        </span>
      ) : null}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        aria-label={playing ? 'Приостановить маршрут' : 'Воспроизвести маршрут'}
        aria-disabled={reducedMotion}
        aria-describedby={motionHint ? motionHintId : undefined}
        onClick={() => {
          if (!reducedMotion) onPlayingChange(!playing);
        }}
        className={`shrink-0 ${reducedMotion ? 'cursor-not-allowed opacity-55' : ''}`}
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
