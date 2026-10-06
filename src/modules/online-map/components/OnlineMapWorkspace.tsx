'use client';

import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { useReducedMotion } from 'framer-motion';

import { Button } from '@/shared/ui';
import { deriveVehicleGpsStatus } from '@/modules/vehicles/gps-status';
import { useMinuteNow } from '@/modules/vehicles/use-minute-now';

import { filterOnlineMapVehicles } from '../filter-vehicles';
import { attachFinesToTracks } from '../track-history-model';
import {
  buildTrackPeriodViewModel,
  getPlaybackHeading,
  getPlaybackPosition,
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
import { TrackFineList } from './TrackFineList';
import { TrackPlayback } from './TrackPlayback';
import { TrackSpeedLegend } from './TrackSpeedLegend';
import { TrackSegmentList } from './TrackSegmentList';

export interface OnlineMapWorkspaceProps {
  mapComponent?: ComponentType<OnlineFleetMapProps>;
  vehicles?: readonly OnlineMapVehicle[];
  initialSelectedVehicleId?: string | null;
  historyProvider?: (vehicleId: string) => OnlineMapTrackHistoryDto;
}

export function OnlineMapWorkspace({
  mapComponent: MapComponent = OnlineFleetMapClient,
  vehicles = [],
  initialSelectedVehicleId = null,
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
  const [trackDate, setTrackDate] = useState(() => getMoscowDate(new Date()));
  const [trackPeriod, setTrackPeriod] = useState<TrackPeriodMode>('day');
  const [playbackTripId, setPlaybackTripId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 2 | 3>(1);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [previewedEventId, setPreviewedEventId] = useState<string | null>(null);
  const [previewedSegmentId, setPreviewedSegmentId] = useState<string | null>(null);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [mobilePanelCollapsed, setMobilePanelCollapsed] = useState(false);
  const reducedMotion = useReducedMotion() ?? false;
  const minuteNow = useMinuteNow();

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
  const historyTracks = useMemo(
    () => (history ? attachFinesToTracks(history) : []),
    [history],
  );
  const dayTrack = useMemo(
    () => historyTracks.find((track) => track.date === trackDate) ?? null,
    [historyTracks, trackDate],
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
  const playbackPoint = useMemo(
    () => (playbackTrack ? getPlaybackPosition(playbackTrack, progress) : null),
    [playbackTrack, progress],
  );
  const playbackHeading = useMemo(
    () => (playbackTrack ? getPlaybackHeading(playbackTrack, progress) : 0),
    [playbackTrack, progress],
  );

  useEffect(() => {
    if (!playing || reducedMotion || !playbackTrack) return;

    const timer = window.setInterval(() => {
      setProgress((currentProgress) => {
        const nextProgress = Math.min(100, currentProgress + 2 * playbackSpeed);

        if (nextProgress === 100) {
          window.clearInterval(timer);
          setPlaying(false);
        }

        return nextProgress;
      });
    }, 250);

    return () => window.clearInterval(timer);
  }, [playbackSpeed, playbackTrack, playing, reducedMotion]);

  const resetTrackState = () => {
    setTrackDate('');
    setTrackPeriod('day');
    setPlaybackTripId(null);
    setProgress(0);
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
    setProgress(0);
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
    setProgress(0);
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
    setProgress(0);
    setPlaying(false);
    setSelectedEventId(null);
    setPreviewedEventId(null);
    setPreviewedSegmentId(null);
    setSelectedActivityId(null);
  };

  const handleProgressChange = (nextProgress: number) => {
    setProgress(Math.min(100, Math.max(0, nextProgress)));
    setPlaying(false);
    setSelectedEventId(null);
    setSelectedActivityId(null);
  };

  const handlePlayingChange = (nextPlaying: boolean) => {
    if (reducedMotion) return;
    if (nextPlaying && progress >= 100) setProgress(0);
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

    const pointIndex = eventTrack.points.findIndex((point) => point.id === event.pointId);
    if (pointIndex < 0) return;

    const lastPointIndex = eventTrack.points.length - 1;
    setProgress(lastPointIndex > 0 ? (pointIndex / lastPointIndex) * 100 : 0);
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

    const representative = activity.kind === 'speeding'
      ? activity.segments.reduce((fastest, segment) =>
          segment.speedKph > fastest.speedKph ? segment : fastest,
        )
      : activity.segments[0];
    setPreviewedSegmentId(representative.id);
    setPlaybackTripId(activity.tripId);

    const activityTrack = periodTracks.find((track) => track.date === activity.tripId);
    if (!activityTrack) return;
    const pointIndex = activityTrack.points.findIndex((point) => point.id === activity.from.id);
    const lastPointIndex = activityTrack.points.length - 1;
    if (pointIndex >= 0) setProgress(lastPointIndex > 0 ? (pointIndex / lastPointIndex) * 100 : 0);
  };

  const handleEndpointActivate = (tripId: string, endpoint: 'start' | 'finish') => {
    if (!periodTracks.some((track) => track.date === tripId)) return;
    setPlaybackTripId(tripId);
    setProgress(endpoint === 'start' ? 0 : 100);
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
      className="@container relative h-[calc(100dvh-var(--header-height))] min-h-0 overflow-hidden bg-[var(--color-canvas)] [@media(max-height:42rem)]:[&_.maplibregl-ctrl-group]:hidden"
    >
      <FleetVehicleRail
        vehicles={liveVehicles}
        selectedVehicleId={effectiveSelectedVehicleId}
        query={query}
        filter={activeFilter}
        collapsed={railCollapsed}
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
                <TrackEventList
                  model={trackViewModel}
                  previewedEventId={previewedEventId}
                  selectedEventId={selectedEventId}
                  onPreview={handleTrackEventPreview}
                  onActivate={handleTrackEventSelect}
                />
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
          className={`absolute right-3 bottom-[calc(38dvh+0.75rem)] left-3 z-40 hidden rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-[var(--color-text)] shadow-[var(--shadow-floating)] @min-[48rem]:block @min-[48rem]:right-[26rem] @min-[48rem]:bottom-4 ${railCollapsed ? '@min-[48rem]:left-[6.5rem]' : '@min-[48rem]:left-[24rem]'}`}
        >
          {trackPeriod === 'seven-days' ? (
            <p className="mb-1 text-xs font-medium text-[var(--color-text-secondary)]">
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
            onProgressChange={handleProgressChange}
            onPlayingChange={handlePlayingChange}
            playbackSpeed={playbackSpeed}
            onPlaybackSpeedChange={setPlaybackSpeed}
          />
        </div>
      ) : null}

      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noreferrer"
        className={`absolute left-3 z-30 inline-flex min-h-11 items-center rounded-[var(--radius-sm)] bg-[var(--color-surface)] px-2 text-xs font-medium text-[var(--color-text-secondary)] underline-offset-4 shadow-[var(--shadow-card)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] @min-[48rem]:bottom-2 ${
          selectedVehicle
            ? mobilePanelCollapsed
              ? 'bottom-[calc(5.5rem+0.5rem)]'
              : 'bottom-[calc(38dvh+0.5rem)]'
            : 'bottom-[max(0.5rem,env(safe-area-inset-bottom))]'
        }`}
      >
        © OpenStreetMap
      </a>
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
