import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import { FiPause, FiPlay } from 'react-icons/fi';

import styles from './TrackPlayback.module.css';

export interface TrackPlaybackProps {
  progress: number;
  playing: boolean;
  reducedMotion: boolean;
  startTimestamp?: string;
  finishTimestamp?: string;
  onProgressChange: (progress: number) => void;
  onPlayingChange: (playing: boolean) => void;
  playbackSpeed?: 1 | 5 | 10 | 30;
  onPlaybackSpeedChange?: (speed: 1 | 5 | 10 | 30) => void;
}

const PRECISION_DELAY_MS = 450;

function timestampToMinutes(timestamp: string) {
  const [hours = 0, minutes = 0] = timestamp.split(':').map(Number);
  return hours * 60 + minutes;
}

function formatMinutes(value: number) {
  const normalized = ((Math.round(value) % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
}

function getTimeRange(startTimestamp: string, finishTimestamp: string) {
  const start = timestampToMinutes(startTimestamp);
  let finish = timestampToMinutes(finishTimestamp);
  if (finish < start) finish += 1440;
  return { start, finish, duration: Math.max(1, finish - start) };
}

export function TrackPlayback({
  progress,
  playing,
  reducedMotion,
  startTimestamp = '00:00',
  finishTimestamp = '23:59',
  onProgressChange,
  onPlayingChange,
  playbackSpeed = 1,
  onPlaybackSpeedChange = () => undefined,
}: TrackPlaybackProps) {
  const motionHintId = useId();
  const precisionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [precisionOpen, setPrecisionOpen] = useState(false);
  const { start, finish, duration } = useMemo(
    () => getTimeRange(startTimestamp, finishTimestamp),
    [finishTimestamp, startTimestamp],
  );
  const currentMinute = start + (Math.min(100, Math.max(0, progress)) / 100) * duration;
  const precisionStart = Math.max(start, Math.floor(currentMinute / 60) * 60);
  const precisionFinish = Math.min(finish, precisionStart + 55);
  const precisionMarks = useMemo(() => {
    const first = Math.ceil(precisionStart / 5) * 5;
    const marks: number[] = [];
    for (let minute = first; minute <= precisionFinish; minute += 5) marks.push(minute);
    return marks;
  }, [precisionFinish, precisionStart]);
  const motionHint = reducedMotion
    ? 'Сокращение анимации включено: используйте ползунок вручную.'
    : undefined;

  const cancelPrecisionTimer = () => {
    if (precisionTimerRef.current) clearTimeout(precisionTimerRef.current);
    precisionTimerRef.current = null;
  };
  const schedulePrecision = () => {
    cancelPrecisionTimer();
    precisionTimerRef.current = setTimeout(() => setPrecisionOpen(true), PRECISION_DELAY_MS);
  };

  useEffect(() => cancelPrecisionTimer, []);

  const seekToMinute = (minute: number) => {
    onProgressChange(((minute - start) / duration) * 100);
  };

  return (
    <div className={styles.player}>
      {motionHint ? (
        <span id={motionHintId} className="sr-only">
          {motionHint}
        </span>
      ) : null}
      <button
        type="button"
        aria-label={playing ? 'Приостановить маршрут' : 'Воспроизвести маршрут'}
        aria-disabled={reducedMotion}
        aria-describedby={motionHint ? motionHintId : undefined}
        onClick={() => {
          if (!reducedMotion) onPlayingChange(!playing);
        }}
        className={styles.playButton}
      >
        {playing ? <FiPause aria-hidden="true" /> : <FiPlay aria-hidden="true" />}
      </button>

      <div
        data-testid="playback-main-timeline"
        className={styles.timelineCluster}
        onPointerEnter={schedulePrecision}
        onPointerDown={schedulePrecision}
        onPointerUp={cancelPrecisionTimer}
        onPointerLeave={() => {
          cancelPrecisionTimer();
          setPrecisionOpen(false);
        }}
      >
        {precisionOpen ? (
          <div className={styles.precision} role="group" aria-label="Точная шкала времени">
            <div className={styles.precisionHeader}>
              <strong>{formatMinutes(currentMinute)}</strong>
              <span>точная перемотка · шаг 5 минут</span>
            </div>
            <div className={styles.precisionMarks}>
              {precisionMarks.map((minute) => (
                <button
                  key={minute}
                  type="button"
                  aria-label={`Перемотать на ${formatMinutes(minute)}`}
                  data-current={Math.abs(minute - currentMinute) < 2.5}
                  onClick={() => seekToMinute(minute)}
                >
                  <i aria-hidden="true" />
                  <span>{formatMinutes(minute)}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <span className={styles.currentTime}>{formatMinutes(currentMinute)}</span>
        <input
          type="range"
          min="0"
          max="100"
          step="any"
          value={progress}
          aria-label="Положение на маршруте"
          aria-valuetext={formatMinutes(currentMinute)}
          onChange={(event) => onProgressChange(Number(event.currentTarget.value))}
          className={styles.range}
          style={{ '--playback-progress': `${progress}%` } as CSSProperties}
        />
        <span className={styles.finishTime}>{formatMinutes(finish)}</span>
      </div>

      <div className={styles.speedControl} aria-label="Скорость воспроизведения">
        {([1, 5, 10, 30] as const).map((speed) => (
          <button
            key={speed}
            type="button"
            aria-label={`Скорость ${speed}x`}
            aria-pressed={playbackSpeed === speed}
            onClick={() => onPlaybackSpeedChange(speed)}
          >
            {speed}×
          </button>
        ))}
      </div>
    </div>
  );
}
