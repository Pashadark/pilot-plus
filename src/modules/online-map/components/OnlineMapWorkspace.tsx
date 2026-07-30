'use client';

import { useEffect, useMemo, useState, type ComponentType, type ChangeEvent } from 'react';
import { useReducedMotion } from 'framer-motion';

import { Button, EmptyState, FilterChip, SearchInput } from '@/shared/ui';

import { onlineMapVehicles } from '../fixtures';
import { filterOnlineMapVehicles } from '../filter-vehicles';
import {
  buildTrackPeriodViewModel,
  getPlaybackPosition,
  getVehicleTrack,
  getVehicleTrackDates,
  getVehicleTracks,
} from '../track-model';
import type { TrackPeriodMode, VehicleTrackEventView, VehicleTrackSegment } from '../track-types';
import type { OnlineMapFilter, OnlineMapVehicle } from '../types';
import type { OnlineFleetMapProps } from './OnlineFleetMap';
import { OnlineFleetMapClient } from './OnlineFleetMapClient';
import { SelectedVehiclePanel } from './SelectedVehiclePanel';
import { TrackDateControls } from './TrackDateControls';
import { TrackDaySummary } from './TrackDaySummary';
import { TrackEventList } from './TrackEventList';
import { TrackPlayback } from './TrackPlayback';
import { TrackSegmentList } from './TrackSegmentList';

const filters: readonly { value: OnlineMapFilter; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'moving', label: 'В движении' },
  { value: 'idle', label: 'На стоянке' },
  { value: 'offline', label: 'Нет связи' },
];

export interface OnlineMapWorkspaceProps {
  mapComponent?: ComponentType<OnlineFleetMapProps>;
}

export function OnlineMapWorkspace({
  mapComponent: MapComponent = OnlineFleetMapClient,
}: OnlineMapWorkspaceProps) {
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<OnlineMapFilter>('all');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [trackDate, setTrackDate] = useState('');
  const [trackPeriod, setTrackPeriod] = useState<TrackPeriodMode>('day');
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [previewedEventId, setPreviewedEventId] = useState<string | null>(null);
  const [previewedSegmentId, setPreviewedSegmentId] = useState<string | null>(null);
  const reducedMotion = useReducedMotion() ?? false;

  const filteredVehicles = useMemo(
    () => filterOnlineMapVehicles(onlineMapVehicles, query, activeFilter),
    [activeFilter, query],
  );
  const selectedVehicle =
    filteredVehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? null;
  const effectiveSelectedVehicleId = selectedVehicle?.id ?? null;
  const trackDates = useMemo(
    () => (selectedVehicle ? getVehicleTrackDates(selectedVehicle.id) : []),
    [selectedVehicle],
  );
  const dayTrack = useMemo(
    () => (selectedVehicle && trackDate ? getVehicleTrack(selectedVehicle.id, trackDate) : null),
    [selectedVehicle, trackDate],
  );
  const periodTracks = useMemo(() => {
    if (!selectedVehicle) return [];
    if (trackPeriod === 'seven-days') return getVehicleTracks(selectedVehicle.id, trackDates);
    return dayTrack ? [dayTrack] : [];
  }, [dayTrack, selectedVehicle, trackDates, trackPeriod]);
  const trackViewModel = useMemo(
    () => (periodTracks.length > 0 ? buildTrackPeriodViewModel(periodTracks, trackPeriod) : null),
    [periodTracks, trackPeriod],
  );
  const selectedTrack = trackPeriod === 'seven-days' ? (periodTracks[0] ?? null) : dayTrack;
  const playbackPoint = useMemo(
    () => (selectedTrack ? getPlaybackPosition(selectedTrack, progress) : null),
    [progress, selectedTrack],
  );

  useEffect(() => {
    if (!playing || reducedMotion || !selectedTrack) return;

    const timer = window.setInterval(() => {
      setProgress((currentProgress) => {
        const nextProgress = Math.min(100, currentProgress + 2);

        if (nextProgress === 100) {
          window.clearInterval(timer);
          setPlaying(false);
        }

        return nextProgress;
      });
    }, 250);

    return () => window.clearInterval(timer);
  }, [playing, reducedMotion, selectedTrack]);

  const resetTrackState = () => {
    setTrackDate('');
    setTrackPeriod('day');
    setProgress(0);
    setPlaying(false);
    setSelectedEventId(null);
    setPreviewedEventId(null);
    setPreviewedSegmentId(null);
  };

  const clearVehicleSelection = () => {
    setSelectedVehicleId(null);
    resetTrackState();
  };

  const applyFilter = (nextQuery: string, nextFilter: OnlineMapFilter) => {
    const nextVehicles = filterOnlineMapVehicles(onlineMapVehicles, nextQuery, nextFilter);

    if (!nextVehicles.some((vehicle) => vehicle.id === selectedVehicleId)) {
      clearVehicleSelection();
    }
  };

  const handleQueryChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextQuery = event.currentTarget.value;
    setQuery(nextQuery);
    applyFilter(nextQuery, activeFilter);
  };

  const handleFilterChange = (nextFilter: OnlineMapFilter) => {
    setActiveFilter(nextFilter);
    applyFilter(query, nextFilter);
  };

  const handleVehicleSelect = (vehicle: OnlineMapVehicle) => {
    const dates = getVehicleTrackDates(vehicle.id);
    setSelectedVehicleId(vehicle.id);
    setTrackDate(dates[0] ?? '');
    setTrackPeriod('day');
    setProgress(0);
    setPlaying(false);
    setSelectedEventId(null);
    setPreviewedEventId(null);
    setPreviewedSegmentId(null);
  };

  const handleTrackDateChange = (date: string) => {
    setTrackDate(date);
    setProgress(0);
    setPlaying(false);
    setSelectedEventId(null);
    setPreviewedEventId(null);
    setPreviewedSegmentId(null);
  };

  const handleTrackPeriodChange = (period: TrackPeriodMode) => {
    setTrackPeriod(period);
    if (period === 'seven-days') setTrackDate(trackDates[0] ?? '');
    setProgress(0);
    setPlaying(false);
    setSelectedEventId(null);
    setPreviewedEventId(null);
    setPreviewedSegmentId(null);
  };

  const handleProgressChange = (nextProgress: number) => {
    setProgress(Math.min(100, Math.max(0, nextProgress)));
    setPlaying(false);
    setSelectedEventId(null);
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
    setPlaying(false);
    if (!selectedTrack || event.tripId !== selectedTrack.date) return;

    const pointIndex = selectedTrack.points.findIndex((point) => point.id === event.pointId);
    if (pointIndex < 0) return;

    const lastPointIndex = selectedTrack.points.length - 1;
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
      <div
        data-testid="online-map-controls"
        className="absolute top-3 right-3 left-3 z-20 grid gap-2 @min-[48rem]:right-auto @min-[48rem]:left-4 @min-[48rem]:w-[min(25rem,calc(100%-23rem))]"
      >
        <SearchInput
          aria-label="Поиск транспорта"
          placeholder="Поиск по модели или госномеру"
          value={query}
          onChange={handleQueryChange}
          className="shadow-[var(--shadow-card)]"
        />
        <div
          role="group"
          aria-label="Статус автомобилей"
          className="scrollbar-hidden flex gap-2 overflow-x-auto py-1"
        >
          {filters.map((filter) => (
            <FilterChip
              key={filter.value}
              selected={activeFilter === filter.value}
              onClick={() => handleFilterChange(filter.value)}
              className="shrink-0 bg-[var(--color-surface)] shadow-[var(--shadow-card)]"
            >
              {filter.label}
            </FilterChip>
          ))}
        </div>
      </div>

      {filteredVehicles.length === 0 && (
        <div className="absolute top-32 right-3 left-3 z-20 @min-[48rem]:right-auto @min-[48rem]:left-4 @min-[48rem]:w-[min(25rem,calc(100%-23rem))]">
          <EmptyState
            title="По запросу ничего не найдено"
            description="Сбросьте поиск и фильтр, чтобы снова увидеть весь автопарк."
            action={<Button onClick={resetFilters}>Сбросить фильтры</Button>}
          />
        </div>
      )}

      <div className="absolute inset-0">
        {filteredVehicles.length > 0 ? (
          <MapComponent
            vehicles={filteredVehicles}
            selectedVehicleId={effectiveSelectedVehicleId}
            trackViewModel={trackViewModel}
            playbackPoint={playbackPoint}
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
          trackControls={
            <TrackDateControls
              dates={trackDates}
              value={trackDate}
              period={trackPeriod}
              onChange={handleTrackDateChange}
              onPeriodChange={handleTrackPeriodChange}
            />
          }
          trackSummary={<TrackDaySummary model={trackViewModel} />}
          trackSegments={
            trackViewModel ? (
              <TrackSegmentList
                model={trackViewModel}
                previewedSegmentId={previewedSegmentId}
                onPreview={handleTrackSegmentPreview}
              />
            ) : null
          }
          trackEvents={
            trackViewModel ? (
              <TrackEventList
                model={trackViewModel}
                previewedEventId={previewedEventId}
                selectedEventId={selectedEventId}
                onPreview={handleTrackEventPreview}
                onActivate={handleTrackEventSelect}
              />
            ) : null
          }
          trackPlayback={
            <div className="grid gap-2">
              {trackPeriod === 'seven-days' && trackViewModel ? (
                <p className="text-xs font-medium text-[var(--color-text-secondary)]">
                  Воспроизводится последняя поездка:{' '}
                  {trackViewModel.activeTrip.date.split('-').reverse().join('.')}
                </p>
              ) : null}
              <TrackPlayback
                progress={progress}
                playing={playing && !reducedMotion}
                reducedMotion={reducedMotion}
                onProgressChange={handleProgressChange}
                onPlayingChange={handlePlayingChange}
              />
            </div>
          }
          className="absolute right-0 bottom-0 left-0 z-20 max-h-[48dvh] rounded-t-[var(--radius-panel)] pb-[max(1rem,env(safe-area-inset-bottom))] @min-[48rem]:top-4 @min-[48rem]:right-4 @min-[48rem]:bottom-4 @min-[48rem]:left-auto @min-[48rem]:max-h-none @min-[48rem]:w-80 @min-[48rem]:rounded-[var(--radius-panel)] @min-[48rem]:pb-4"
        />
      ) : null}

      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noreferrer"
        className={`absolute left-3 z-30 inline-flex min-h-11 items-center rounded-[var(--radius-sm)] bg-[var(--color-surface)] px-2 text-xs font-medium text-[var(--color-text-secondary)] underline-offset-4 shadow-[var(--shadow-card)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] @min-[48rem]:bottom-2 ${
          selectedVehicle
            ? 'bottom-[calc(48dvh+0.5rem)]'
            : 'bottom-[max(0.5rem,env(safe-area-inset-bottom))]'
        }`}
      >
        © OpenStreetMap
      </a>
    </section>
  );
}
