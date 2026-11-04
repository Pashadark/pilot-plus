'use client';

import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { useReducedMotion } from 'framer-motion';

import { Button } from '@/shared/ui';
import { deriveVehicleGpsStatus } from '@/modules/vehicles/gps-status';
import { useMinuteNow } from '@/modules/vehicles/use-minute-now';

import { filterOnlineMapVehicles } from '../filter-vehicles';
import { attachFinesToTracks } from '../track-history-model';
import {
  buildTrackPeriodViewModel,
  buildTrackViewModel,
  getPlaybackFrame,
  getPlaybackTrail,
  getTrackBounds,
  getTrackPointCursorMs,
} from '../track-model';
import type {
  OnlineMapTrackHistoryDto,
  TrackPeriodMode,
  VehicleTrackActivitySection,
  VehicleTrackEventView,
  VehicleTrackSegment,
} from '../track-types';
import type { OnlineMapFilter, OnlineMapVehicle } from '../types';
import { useVehicleTrackHistory } from '../useVehicleTrackHistory';
import { FleetVehicleRail } from './FleetVehicleRail';
import type { OnlineFleetMapProps } from './OnlineFleetMap';
import { OnlineFleetMapClient } from './OnlineFleetMapClient';
import { SelectedVehiclePanel } from './SelectedVehiclePanel';
import { TrackDateControls } from './TrackDateControls';
import { TrackDaySummary } from './TrackDaySummary';
import { TrackEventList } from './TrackEventList';
import { TrackEventSummary } from './TrackEventSummary';
import { TrackFineList } from './TrackFineList';
import { TrackPlayback } from './TrackPlayback';
import { TrackSpeedLegend } from './TrackSpeedLegend';
import { TrackSegmentList } from './TrackSegmentList';

export interface OnlineMapWorkspaceProps {
  mapComponent?: ComponentType<OnlineFleetMapProps>;
  vehicles?: readonly OnlineMapVehicle[];
  initialSelectedVehicleId?: string | null;
  initialTrackDate?: string | null;
  initialSelectedEventId?: string | null;
  historyProvider?: (vehicleId: string) => OnlineMapTrackHistoryDto;
}

export function OnlineMapWorkspace({
  mapComponent: MapComponent = OnlineFleetMapClient,
  vehicles = [],
  initialSelectedVehicleId = null,
  initialTrackDate = null,
  initialSelectedEventId = null,
  historyProvider,
}: OnlineMapWorkspaceProps) {
  const [snapshotVehicles, setSnapshotVehicles] = useState<readonly OnlineMapVehicle[]>(vehicles);
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<OnlineMapFilter>('all');
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [mobileFleetOpen, setMobileFleetOpen] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(
    initialSelectedVehicleId,
  );
  const [trackDate, setTrackDate] = useState(() => initialTrackDate ?? getMoscowDate(new Date()));
  const [trackPeriod, setTrackPeriod] = useState<TrackPeriodMode>('day');
  const [playbackTripId, setPlaybackTripId] = useState<string | null>(null);
  const [playbackCursorMs, setPlaybackCursorMs] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 5 | 10 | 30>(1);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(initialSelectedEventId);
  const [previewedEventId, setPreviewedEventId] = useState<string | null>(null);
  const [previewedSegmentId, setPreviewedSegmentId] = useState<string | null>(null);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [mobilePanelCollapsed, setMobilePanelCollapsed] = useState(false);
  const reducedMotion = useReducedMotion() ?? false;
  const minuteNow = useMinuteNow();
  const previousAnimationTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof EventSource === 'undefined') return;
    const source = new EventSource('/api/map/live');
    const onSnapshot = (event: MessageEvent<string>) => {
      try {
        const parsed: unknown = JSON.parse(event.data);
        if (
          typeof parsed !== 'object' ||
          parsed === null ||
          !('vehicles' in parsed) ||
          !Array.isArray(parsed.vehicles) ||
          !parsed.vehicles.every(isOnlineMapVehicle)
        ) {
          return;
        }
        setSnapshotVehicles(parsed.vehicles);
      } catch {
        // Keep the last authoritative snapshot when a malformed event arrives.
      }
    };
    source.addEventListener('snapshot', onSnapshot as EventListener);
    return () => source.close();
  }, []);

  const liveVehicles = useMemo(
    () =>
      minuteNow === null
        ? snapshotVehicles
        : snapshotVehicles.map((vehicle) =>
            vehicle.recordedAt === undefined
              ? vehicle
              : {
                  ...vehicle,
                  gpsStatus: deriveVehicleGpsStatus(
                    {
                      recordedAt: vehicle.recordedAt,
                      speedKph: vehicle.speedKph,
                      address: vehicle.address,
                      hasCoordinates: vehicle.latitude !== null && vehicle.longitude !== null,
                    },
                    minuteNow,
                  ),
                },
          ),
    [minuteNow, snapshotVehicles],
  );

  const filteredVehicles = useMemo(
    () => filterOnlineMapVehicles(liveVehicles, query, activeFilter),
    [activeFilter, liveVehicles, query],
  );
  const selectedVehicle =
    filteredVehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? null;
  const effectiveSelectedVehicleId = selectedVehicle?.id ?? null;
  const historyFrom = trackPeriod === 'seven-days' ? addCalendarDays(trackDate, -6) : trackDate;
  const remoteHistory = useVehicleTrackHistory({
    vehicleId: historyProvider ? null : effectiveSelectedVehicleId,
    from: historyFrom,
    to: trackDate,
    refreshIntervalMs: !playing && trackDate === getMoscowDate(new Date()) ? 30_000 : 0,
  });
  const providedHistory = useMemo(
    () => (selectedVehicle && historyProvider ? historyProvider(selectedVehicle.id) : null),
    [historyProvider, selectedVehicle],
  );
  const history = providedHistory ?? remoteHistory.data;
  const trackDates = useMemo(() => history?.availableDates ?? [], [history]);
  const historyTracks = useMemo(() => (history ? attachFinesToTracks(history) : []), [history]);
  const dayTrack = useMemo(
    () => historyTracks.find((track) => track.date === trackDate) ?? null,
    [historyTracks, trackDate],
  );
  const selectedDayDistanceKm = useMemo(
    () => (dayTrack ? buildTrackViewModel(dayTrack).distanceKm : null),
    [dayTrack],
  );
  const periodTracks = useMemo(() => {
    if (!effectiveSelectedVehicleId) return [];
    if (trackPeriod === 'seven-days') return historyTracks;
    return dayTrack ? [dayTrack] : [];
  }, [dayTrack, effectiveSelectedVehicleId, historyTracks, trackPeriod]);
  const trackViewModel = useMemo(
    () => (periodTracks.length > 0 ? buildTrackPeriodViewModel(periodTracks, trackPeriod) : null),
    [periodTracks, trackPeriod],
  );
  const playbackTrack =
    periodTracks.find((track) => track.date === playbackTripId) ?? periodTracks[0] ?? null;
  const playbackBounds = useMemo(
    () => (playbackTrack ? getTrackBounds(playbackTrack) : null),
    [playbackTrack],
  );
  const effectivePlaybackCursorMs = playbackBounds
    ? Math.min(
        playbackBounds.endMs,
        Math.max(playbackBounds.startMs, playbackCursorMs ?? playbackBounds.startMs),
      )
    : null;
  const playbackFrame = useMemo(
    () =>
      playbackTrack && effectivePlaybackCursorMs !== null
        ? getPlaybackFrame(playbackTrack, effectivePlaybackCursorMs)
        : null,
    [effectivePlaybackCursorMs, playbackTrack],
  );
  const playbackPoint = playbackFrame?.position ?? null;
  const playbackHeading = playbackFrame?.headingDegrees ?? 0;
  const playbackActive = playbackCursorMs !== null;
  const playbackTrail = useMemo(
    () =>
      playbackActive && playbackTrack && effectivePlaybackCursorMs !== null
        ? getPlaybackTrail(playbackTrack, effectivePlaybackCursorMs)
        : null,
    [effectivePlaybackCursorMs, playbackActive, playbackTrack],
  );
  const progress =
    playbackBounds && effectivePlaybackCursorMs !== null
      ? ((effectivePlaybackCursorMs - playbackBounds.startMs) /
          Math.max(1, playbackBounds.endMs - playbackBounds.startMs)) *
        100
      : 0;

  useEffect(() => {
    if (!playing || reducedMotion || !playbackBounds) {
      previousAnimationTimeRef.current = null;
      return;
    }

    let animationFrameId = 0;
    const animate = (animationTime: number) => {
      const previousAnimationTime = previousAnimationTimeRef.current ?? animationTime;
      previousAnimationTimeRef.current = animationTime;
      const elapsedMs = Math.max(0, animationTime - previousAnimationTime);

      setPlaybackCursorMs((currentCursorMs) => {
        const nextCursorMs = Math.min(
          playbackBounds.endMs,
          (currentCursorMs ?? playbackBounds.startMs) + elapsedMs * playbackSpeed,
        );
        if (nextCursorMs >= playbackBounds.endMs) setPlaying(false);
        return nextCursorMs;
      });

      animationFrameId = window.requestAnimationFrame(animate);
    };

    animationFrameId = window.requestAnimationFrame(animate);
    return () => {
      window.cancelAnimationFrame(animationFrameId);
      previousAnimationTimeRef.current = null;
    };
  }, [playbackBounds, playbackSpeed, playing, reducedMotion]);

  const resetTrackState = () => {
    setTrackDate('');
    setTrackPeriod('day');
    setPlaybackTripId(null);
    setPlaybackCursorMs(null);
    setPlaying(false);
    setSelectedEventId(null);
    setPreviewedEventId(null);
    setPreviewedSegmentId(null);
    setSelectedActivityId(null);
    setMobilePanelCollapsed(false);
  };

  const clearVehicleSelection = () => {
    setSelectedVehicleId(null);
    resetTrackState();
  };

  const applyFilter = (nextQuery: string, nextFilter: OnlineMapFilter) => {
    const nextVehicles = filterOnlineMapVehicles(liveVehicles, nextQuery, nextFilter);

    if (!nextVehicles.some((vehicle) => vehicle.id === selectedVehicleId)) {
      clearVehicleSelection();
    }
  };

  const handleQueryChange = (nextQuery: string) => {
    setQuery(nextQuery);
    applyFilter(nextQuery, activeFilter);
  };

  const handleFilterChange = (nextFilter: OnlineMapFilter) => {
    setActiveFilter(nextFilter);
    applyFilter(query, nextFilter);
  };

  const handleVehicleSelect = (vehicle: OnlineMapVehicle) => {
    const dates = historyProvider?.(vehicle.id).availableDates ?? [];
    setSelectedVehicleId(vehicle.id);
    setTrackDate(dates[0] ?? getMoscowDate(new Date()));
    setTrackPeriod('day');
    setMobileFleetOpen(false);
    setPlaybackTripId(null);
    setPlaybackCursorMs(null);
    setPlaying(false);
    setSelectedEventId(null);
    setPreviewedEventId(null);
    setPreviewedSegmentId(null);
    setSelectedActivityId(null);
    setMobilePanelCollapsed(false);
  };

  const handleTrackDateChange = (date: string) => {
    setTrackDate(date);
    setPlaybackTripId(null);
    setPlaybackCursorMs(null);
    setPlaying(false);
    setSelectedEventId(null);
    setPreviewedEventId(null);
    setPreviewedSegmentId(null);
    setSelectedActivityId(null);
  };

  const handleTrackPeriodChange = (period: TrackPeriodMode) => {
    setTrackPeriod(period);
    if (period === 'seven-days') setTrackDate(trackDates[0] ?? '');
    setPlaybackTripId(null);
    setPlaybackCursorMs(null);
    setPlaying(false);
    setSelectedEventId(null);
    setPreviewedEventId(null);
    setPreviewedSegmentId(null);
    setSelectedActivityId(null);
  };

  const handleProgressChange = (nextProgress: number) => {
    if (playbackBounds) {
      const boundedProgress = Math.min(100, Math.max(0, nextProgress));
      setPlaybackCursorMs(
        playbackBounds.startMs +
          ((playbackBounds.endMs - playbackBounds.startMs) * boundedProgress) / 100,
      );
    }
    setPlaying(false);
    setSelectedEventId(null);
    setSelectedActivityId(null);
  };

  const handlePlayingChange = (nextPlaying: boolean) => {
    if (reducedMotion) return;
    if (nextPlaying && playbackBounds && progress >= 100) {
      setPlaybackCursorMs(playbackBounds.startMs);
    }
    setPlaying(nextPlaying);
  };

  const handleTrackEventSelect = (event: VehicleTrackEventView) => {
    setSelectedEventId(event.id);
    setPreviewedEventId(event.id);
    setPreviewedSegmentId(null);
    setSelectedActivityId(null);
    setPlaying(false);
    const eventTrack = periodTracks.find((track) => track.date === event.tripId);
    if (!eventTrack) return;
    setPlaybackTripId(event.tripId);

    const eventCursorMs = getTrackPointCursorMs(eventTrack, event.pointId);
    if (eventCursorMs !== null) setPlaybackCursorMs(eventCursorMs);
  };

  const handleTrackEventPreview = (event: VehicleTrackEventView | null) => {
    setPreviewedEventId(event?.id ?? null);
    if (event) setPreviewedSegmentId(null);
  };

  const handleTrackSegmentPreview = (segment: VehicleTrackSegment | null) => {
    setPreviewedSegmentId(segment?.id ?? null);
    if (segment) setPreviewedEventId(null);
  };

  const handleTrackActivitySelect = (activity: VehicleTrackActivitySection | null) => {
    setSelectedActivityId(activity?.id ?? null);
    setSelectedEventId(null);
    setPreviewedEventId(null);
    setPlaying(false);

    if (!activity) {
      setPreviewedSegmentId(null);
      return;
    }

    const representative =
      activity.kind === 'speeding'
        ? activity.segments.reduce((fastest, segment) =>
            segment.speedKph > fastest.speedKph ? segment : fastest,
          )
        : activity.segments[0];
    setPreviewedSegmentId(representative.id);
    setPlaybackTripId(activity.tripId);

    const activityTrack = periodTracks.find((track) => track.date === activity.tripId);
    if (!activityTrack) return;
    const activityCursorMs = getTrackPointCursorMs(activityTrack, activity.from.id);
    if (activityCursorMs !== null) setPlaybackCursorMs(activityCursorMs);
  };

  const handleEndpointActivate = (tripId: string, endpoint: 'start' | 'finish') => {
    if (!periodTracks.some((track) => track.date === tripId)) return;
    const endpointTrack = periodTracks.find((track) => track.date === tripId);
    if (!endpointTrack) return;
    setPlaybackTripId(tripId);
    const endpointBounds = getTrackBounds(endpointTrack);
    setPlaybackCursorMs(endpoint === 'start' ? endpointBounds.startMs : endpointBounds.endMs);
    setPlaying(false);
    setSelectedEventId(null);
    setPreviewedEventId(null);
    setPreviewedSegmentId(null);
    setSelectedActivityId(null);
  };

  const resetFilters = () => {
    setQuery('');
    setActiveFilter('all');
    clearVehicleSelection();
  };

  return (
    <section
      aria-label="Онлайн-карта транспорта"
      className="@container relative h-[calc(100dvh-var(--header-height)-var(--mobile-dock-space,0px)-var(--mobile-shell-extra,0px))] min-h-0 overflow-hidden bg-[var(--color-canvas)] [@media(max-height:42rem)]:[&_.maplibregl-ctrl-group]:hidden"
    >
      <FleetVehicleRail
        vehicles={liveVehicles}
        selectedVehicleId={effectiveSelectedVehicleId}
        query={query}
        filter={activeFilter}
        collapsed={railCollapsed}
        selectedDayDistanceKm={selectedDayDistanceKm}
        selectedDayDistanceLoading={!historyProvider && remoteHistory.loading}
        onSelect={handleVehicleSelect}
        onQueryChange={handleQueryChange}
        onFilterChange={handleFilterChange}
        onCollapsedChange={setRailCollapsed}
        className="absolute top-4 bottom-4 left-4 z-30 hidden @min-[48rem]:flex"
      />

      <button
        type="button"
        aria-label="Открыть список автомобилей"
        aria-expanded={mobileFleetOpen}
        onClick={() => setMobileFleetOpen(true)}
        className={`absolute left-3 z-30 min-h-11 rounded-full bg-[var(--color-primary)] px-4 text-sm font-semibold text-white shadow-[var(--shadow-floating)] @min-[48rem]:hidden ${selectedVehicle ? 'top-3' : 'bottom-3'}`}
      >
        Автопарк {filteredVehicles.length}
      </button>

      {mobileFleetOpen ? (
        <div className="absolute inset-0 z-40 bg-[color-mix(in_srgb,var(--color-navigation)_35%,transparent)] @min-[48rem]:hidden">
          <button
            type="button"
            aria-label="Закрыть список автомобилей"
            onClick={() => setMobileFleetOpen(false)}
            className="absolute inset-0"
          />
          <FleetVehicleRail
            vehicles={liveVehicles}
            selectedVehicleId={effectiveSelectedVehicleId}
            query={query}
            filter={activeFilter}
            collapsed={false}
            selectedDayDistanceKm={selectedDayDistanceKm}
            selectedDayDistanceLoading={!historyProvider && remoteHistory.loading}
            onSelect={handleVehicleSelect}
            onQueryChange={handleQueryChange}
            onFilterChange={handleFilterChange}
            onCollapsedChange={() => setMobileFleetOpen(false)}
            className="absolute right-0 bottom-0 left-0 z-10 max-h-[72dvh] min-h-[52dvh] [width:100%] rounded-b-none pb-[env(safe-area-inset-bottom)]"
          />
        </div>
      ) : null}

      {filteredVehicles.length === 0 ? (
        <div className="absolute top-4 left-[5.25rem] z-30 hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm shadow-[var(--shadow-card)] @min-[48rem]:block">
          Машины не найдены.{' '}
          <Button size="sm" variant="ghost" onClick={resetFilters}>
            Сбросить
          </Button>
        </div>
      ) : null}

      <div className="absolute inset-0">
        {filteredVehicles.length > 0 ? (
          <MapComponent
            vehicles={filteredVehicles}
            selectedVehicleId={effectiveSelectedVehicleId}
            trackViewModel={trackViewModel}
            playbackPoint={playbackPoint}
            playbackHeading={playbackHeading}
            playbackTrail={playbackTrail}
            playbackActive={playbackActive}
            selectedEventId={selectedEventId}
            previewedEventId={previewedEventId}
            previewedSegmentId={previewedSegmentId}
            onVehicleSelect={handleVehicleSelect}
            onEventPreview={handleTrackEventPreview}
            onEventActivate={handleTrackEventSelect}
            onSegmentPreview={handleTrackSegmentPreview}
          />
        ) : (
          <div className="h-full bg-[var(--color-canvas)]" aria-label="Карта без автомобилей" />
        )}
      </div>

      {selectedVehicle ? (
        <SelectedVehiclePanel
          key={selectedVehicle.id}
          vehicle={selectedVehicle}
          onClose={clearVehicleSelection}
          mobileCollapsed={mobilePanelCollapsed}
          onMobileCollapsedChange={setMobilePanelCollapsed}
          trackControls={
            <div className="grid gap-3">
              <TrackDateControls
                dates={trackDates}
                value={trackDate}
                period={trackPeriod}
                onChange={handleTrackDateChange}
                onPeriodChange={handleTrackPeriodChange}
              />
              {!historyProvider && remoteHistory.loading ? (
                <p className="text-sm text-[var(--color-text-secondary)]">Загружаем маршрут…</p>
              ) : null}
              {!historyProvider && remoteHistory.error ? (
                <div className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] bg-[var(--color-danger-soft)] p-3 text-sm text-[var(--color-danger)]">
                  <span>{remoteHistory.error}</span>
                  <Button size="sm" variant="secondary" onClick={remoteHistory.retry}>
                    Повторить
                  </Button>
                </div>
              ) : null}
            </div>
          }
          trackSummary={
            <div className="grid gap-3">
              <TrackDaySummary model={trackViewModel} />
              {trackViewModel ? <TrackSpeedLegend /> : null}
            </div>
          }
          trackSegments={
            trackViewModel ? (
              <TrackSegmentList
                model={trackViewModel}
                previewedSegmentId={previewedSegmentId}
                selectedActivityId={selectedActivityId}
                onPreview={handleTrackSegmentPreview}
                onActivate={handleTrackActivitySelect}
                onEndpointActivate={handleEndpointActivate}
              />
            ) : null
          }
          trackEvents={
            <div className="grid gap-4">
              {trackViewModel ? (
                <>
                  <TrackEventSummary model={trackViewModel} />
                  <TrackEventList
                    model={trackViewModel}
                    previewedEventId={previewedEventId}
                    selectedEventId={selectedEventId}
                    onPreview={handleTrackEventPreview}
                    onActivate={handleTrackEventSelect}
                  />
                </>
              ) : null}
              {history?.fines.length ? <TrackFineList fines={history.fines} /> : null}
            </div>
          }
          className={`absolute right-0 bottom-0 left-0 z-20 max-h-[38dvh] rounded-t-[var(--radius-panel)] pb-[max(1rem,env(safe-area-inset-bottom))] @min-[48rem]:top-4 @min-[48rem]:right-4 @min-[48rem]:bottom-4 @min-[48rem]:left-auto @min-[48rem]:max-h-none @min-[48rem]:w-[25rem] @min-[48rem]:rounded-[var(--radius-panel)] @min-[48rem]:pb-4 ${mobilePanelCollapsed ? 'max-h-[5.5rem]' : ''}`}
        />
      ) : null}

      {selectedVehicle && trackViewModel ? (
        <div
          data-testid="track-playback-dock"
          className="absolute bottom-4 left-1/2 z-40 hidden w-[min(34rem,calc(100%-2rem))] -translate-x-1/2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-surface)_96%,transparent)] px-2.5 py-2 text-[var(--color-text)] shadow-[var(--shadow-floating)] backdrop-blur-xl @min-[48rem]:block"
        >
          {trackPeriod === 'seven-days' ? (
            <p className="px-2 pb-1 text-xs font-medium text-[var(--color-text-secondary)]">
              Воспроизводится поездка:{' '}
              {(playbackTrack?.date ?? trackViewModel.activeTrip.date)
                .split('-')
                .reverse()
                .join('.')}
            </p>
          ) : null}
          <TrackPlayback
            progress={progress}
            playing={playing && !reducedMotion}
            reducedMotion={reducedMotion}
            startTimestamp={playbackTrack?.points[0]?.timestamp}
            finishTimestamp={playbackTrack?.points.at(-1)?.timestamp}
            onProgressChange={handleProgressChange}
            onPlayingChange={handlePlayingChange}
            playbackSpeed={playbackSpeed}
            onPlaybackSpeedChange={setPlaybackSpeed}
          />
        </div>
      ) : null}
    </section>
  );
}

function isOnlineMapVehicle(value: unknown): value is OnlineMapVehicle {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string' &&
    'name' in value &&
    typeof value.name === 'string' &&
    'plate' in value &&
    typeof value.plate === 'string' &&
    'speedKph' in value &&
    typeof value.speedKph === 'number' &&
    Number.isFinite(value.speedKph) &&
    'gpsStatus' in value &&
    typeof value.gpsStatus === 'object' &&
    value.gpsStatus !== null
  );
}

function getMoscowDate(value: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Moscow',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(value)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function addCalendarDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}
