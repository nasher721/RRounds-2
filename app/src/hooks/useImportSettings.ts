import { useState, useEffect } from 'react';
import { safeLocalStorage } from '@/utils/safeStorage';

export interface ImportSettings {
    ocrEnabled: boolean;
    forceOcr: boolean;
    imageScale: number;
    pageLimit: number;
}

export const DEFAULT_IMPORT_SETTINGS: ImportSettings = {
    ocrEnabled: true,
    forceOcr: false,
    imageScale: 2.0,
    pageLimit: 10,
};

const STORAGE_KEY = 'import-settings-prefs';

export const useImportSettings = () => {
    const [settings, setSettings] = useState<ImportSettings>(DEFAULT_IMPORT_SETTINGS);

    useEffect(() => {
        const saved = safeLocalStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                setSettings({ ...DEFAULT_IMPORT_SETTINGS, ...JSON.parse(saved) });
            } catch (e) {
                console.error('Failed to parse import settings', e);
            }
        }
    }, []);

    const updateSettings = (newSettings: Partial<ImportSettings>) => {
        setSettings((prev) => {
            const updated = { ...prev, ...newSettings };
            safeLocalStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
            return updated;
        });
    };

    const resetSettings = () => {
        setSettings(DEFAULT_IMPORT_SETTINGS);
        safeLocalStorage.removeItem(STORAGE_KEY);
    };

    return {
        settings,
        updateSettings,
        resetSettings,
    };
};
