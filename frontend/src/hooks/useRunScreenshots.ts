import { useEffect, useRef, useState } from 'react';
import { apiClient } from '../api/client';
import type { HealEvent } from '../types';

export function useRunScreenshots(selectedRunId: string | null) {
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [selectedShotFile, setSelectedShotFile] = useState<string | null>(null);
  const [shotCache, setShotCache] = useState<Record<string, string>>({});
  const shotCacheRef = useRef<Record<string, string>>({});
  const screenshotsContainerRef = useRef<HTMLDivElement>(null);
  const [comparingHealEvent, setComparingHealEvent] = useState<HealEvent | null>(null);
  const [compareImages, setCompareImages] = useState<{ before: string | null; after: string | null }>({ before: null, after: null });
  const [compareImagesLoading, setCompareImagesLoading] = useState(false);

  useEffect(() => {
    shotCacheRef.current = shotCache;
  }, [shotCache]);

  const resetScreenshots = () => {
    setScreenshot(null);
    setSelectedShotFile(null);
  };

  const loadScreenshotFile = async (runId: string, file: string) => {
    const cacheKey = `${runId}/${file}`;
    if (shotCacheRef.current[cacheKey]) return shotCacheRef.current[cacheKey];
    const imgRes = await apiClient.get(`/api/runs/${runId}/screenshots/${file}`);
    const b64 = imgRes.data?.data || '';
    if (b64) {
      setShotCache((prev) => {
        const next = { ...prev, [cacheKey]: b64 };
        shotCacheRef.current = next;
        return next;
      });
    }
    return b64;
  };

  const prefetchScreenshots = async (runId: string, screenshots: { file: string }[]) => {
    const concurrency = 4;
    for (let i = 0; i < screenshots.length; i += concurrency) {
      const batch = screenshots.slice(i, i + concurrency);
      await Promise.all(batch.map((shot) => loadScreenshotFile(runId, shot.file)));
    }
  };

  const loadLatestScreenshot = async (runId: string, screenshots: Array<{ file: string; ts: number }> | undefined) => {
    const last = screenshots && screenshots.length > 0 ? screenshots[screenshots.length - 1] : null;
    if (!last?.file) {
      resetScreenshots();
      return;
    }
    setSelectedShotFile(last.file);
    const b64 = await loadScreenshotFile(runId, last.file);
    setScreenshot(b64 || null);
  };

  const handleOpenHealCompare = async (event: HealEvent) => {
    if (!selectedRunId) return;
    setComparingHealEvent(event);
    setCompareImagesLoading(true);
    setCompareImages({ before: null, after: null });
    try {
      const beforeB64 = event.before_file ? await loadScreenshotFile(selectedRunId, event.before_file) : null;
      const afterB64 = event.after_file ? await loadScreenshotFile(selectedRunId, event.after_file) : null;
      setCompareImages({ before: beforeB64, after: afterB64 });
    } catch (err) {
      console.error('加载对比截图失败', err);
    } finally {
      setCompareImagesLoading(false);
    }
  };

  const openRunScreenshot = async (file: string) => {
    if (!selectedRunId) return;
    const b64 = await loadScreenshotFile(selectedRunId, file);
    if (b64) {
      setSelectedShotFile(file);
      setScreenshot(b64);
    }
  };

  const closeHealCompare = () => {
    setComparingHealEvent(null);
    setCompareImages({ before: null, after: null });
  };

  return {
    screenshot,
    setScreenshot,
    selectedShotFile,
    setSelectedShotFile,
    shotCache,
    screenshotsContainerRef,
    comparingHealEvent,
    compareImages,
    compareImagesLoading,
    resetScreenshots,
    loadScreenshotFile,
    prefetchScreenshots,
    loadLatestScreenshot,
    handleOpenHealCompare,
    openRunScreenshot,
    closeHealCompare,
  };
}
