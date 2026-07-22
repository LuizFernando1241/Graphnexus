import { useState, useEffect } from "react";
import type {
  RadarViewPreferences,
  ColumnSortConfigs,
  AdvancedFilters,
  PipelineStage,
  SortField,
  SortDirection,
} from "@/types/radar";

const PREFERENCES_KEY = "radar-view-preferences";

const DEFAULT_PREFERENCES: RadarViewPreferences = {
  columnSorts: {},
  advancedFilters: {},
};

export function useRadarPreferences() {
  const [preferences, setPreferences] = useState<RadarViewPreferences>(DEFAULT_PREFERENCES);
  const [isLoaded, setIsLoaded] = useState(false);

  // Carregar preferências do localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(PREFERENCES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as RadarViewPreferences;
        setPreferences(parsed);
      }
    } catch (error) {
      console.error("Erro ao carregar preferências do Radar:", error);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Salvar preferências no localStorage quando mudar
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
      } catch (error) {
        console.error("Erro ao salvar preferências do Radar:", error);
      }
    }
  }, [preferences, isLoaded]);

  function setColumnSort(stage: PipelineStage, field: SortField, direction: SortDirection) {
    setPreferences((prev) => ({
      ...prev,
      columnSorts: {
        ...prev.columnSorts,
        [stage]: { field, direction },
      },
    }));
  }

  function removeColumnSort(stage: PipelineStage) {
    setPreferences((prev) => {
      const newSorts = { ...prev.columnSorts };
      delete newSorts[stage];
      return {
        ...prev,
        columnSorts: newSorts,
      };
    });
  }

  function setAdvancedFilters(filters: Partial<AdvancedFilters>) {
    setPreferences((prev) => ({
      ...prev,
      advancedFilters: {
        ...prev.advancedFilters,
        ...filters,
      },
    }));
  }

  function clearAdvancedFilters() {
    setPreferences((prev) => ({
      ...prev,
      advancedFilters: {},
    }));
  }

  function resetAllPreferences() {
    setPreferences(DEFAULT_PREFERENCES);
  }

  return {
    preferences,
    isLoaded,
    setColumnSort,
    removeColumnSort,
    setAdvancedFilters,
    clearAdvancedFilters,
    resetAllPreferences,
  };
}
