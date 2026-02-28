import { create } from "zustand";

export type Style = "A" | "B" | "C";

export interface PaletteEntry {
    index: number;
    r: number;
    g: number;
    b: number;
}

export interface PreviewBlock {
    x: number;
    y: number;
    cellR: number;
    cellG: number;
    cellB: number;
    srcR: number;
    srcG: number;
    srcB: number;
}

export interface PreviewData {
    cols: number;
    rows: number;
    blocks: PreviewBlock[];
}

interface MosaicState {
    // Session
    sessionId: string;

    // Main image
    mainImageFile: File | null;
    mainImagePreviewUrl: string | null;

    // Sub-images
    subImageFiles: File[];
    subImagePreviews: string[]; // object URLs for thumbnails

    // Palette (returned by backend after analysis)
    palette: PaletteEntry[];
    isAnalyzing: boolean;
    analyzeProgress: number; // 0-100

    // Settings
    tileSize: number;
    style: Style;
    allowRepeats: boolean;
    overlayOpacity: number;
    shuffleSources: boolean;
    a4Output: boolean;

    // Preview
    previewData: PreviewData | null;
    isPreviewLoading: boolean;

    // Generation
    isGenerating: boolean;
    resultUrl: string | null;
    resultBlob: Blob | null;

    // Actions
    setMainImageFile: (file: File | null) => void;
    setSubImageFiles: (files: File[]) => void;
    addSubImageFiles: (files: File[]) => void;
    clearSubImages: () => void;
    setPalette: (palette: PaletteEntry[]) => void;
    setIsAnalyzing: (v: boolean) => void;
    setAnalyzeProgress: (v: number) => void;
    setTileSize: (v: number) => void;
    setStyle: (v: Style) => void;
    setAllowRepeats: (v: boolean) => void;
    setOverlayOpacity: (v: number) => void;
    setShuffleSources: (v: boolean) => void;
    setA4Output: (v: boolean) => void;
    setPreviewData: (data: PreviewData | null) => void;
    setIsPreviewLoading: (v: boolean) => void;
    setIsGenerating: (v: boolean) => void;
    setResult: (url: string | null, blob: Blob | null) => void;
    reset: () => void;
}

const makeSessionId = () =>
    Math.random().toString(36).slice(2) + Date.now().toString(36);

/** Revoke a list of object URLs to free browser memory. */
function revokeUrls(urls: string[]) {
    for (const url of urls) {
        try { URL.revokeObjectURL(url); } catch { /* ignore */ }
    }
}

export const useMosaicStore = create<MosaicState>((set, get) => ({
    sessionId: makeSessionId(),

    mainImageFile: null,
    mainImagePreviewUrl: null,
    subImageFiles: [],
    subImagePreviews: [],
    palette: [],
    isAnalyzing: false,
    analyzeProgress: 0,

    tileSize: 40,
    style: "A",
    allowRepeats: true,
    overlayOpacity: 0.25,
    shuffleSources: false,
    a4Output: false,

    previewData: null,
    isPreviewLoading: false,
    isGenerating: false,
    resultUrl: null,
    resultBlob: null,

    setMainImageFile: (file) => {
        const prev = get().mainImagePreviewUrl;
        if (prev) revokeUrls([prev]);
        if (file) {
            const url = URL.createObjectURL(file);
            set({ mainImageFile: file, mainImagePreviewUrl: url, previewData: null, resultUrl: null, resultBlob: null });
        } else {
            set({ mainImageFile: null, mainImagePreviewUrl: null });
        }
    },

    setSubImageFiles: (files) => {
        // Revoke all previous preview URLs
        revokeUrls(get().subImagePreviews);
        const previews = files.slice(0, 200).map((f) => URL.createObjectURL(f));
        set({ subImageFiles: files, subImagePreviews: previews, palette: [], previewData: null, resultUrl: null });
    },

    addSubImageFiles: (newFiles) =>
        set((state) => {
            // Revoke old previews before creating new ones
            revokeUrls(state.subImagePreviews);
            const merged = [...state.subImageFiles, ...newFiles];
            const previews = merged.slice(0, 200).map((f) => URL.createObjectURL(f));
            return { subImageFiles: merged, subImagePreviews: previews, palette: [], previewData: null };
        }),

    clearSubImages: () => {
        revokeUrls(get().subImagePreviews);
        set({ subImageFiles: [], subImagePreviews: [], palette: [], previewData: null });
    },

    setPalette: (palette) => set({ palette }),
    setIsAnalyzing: (v) => set({ isAnalyzing: v }),
    setAnalyzeProgress: (v) => set({ analyzeProgress: v }),
    setTileSize: (v) => set({ tileSize: v }),
    setStyle: (v) => set({ style: v }),
    setAllowRepeats: (v) => set({ allowRepeats: v }),
    setOverlayOpacity: (v) => set({ overlayOpacity: v }),
    setShuffleSources: (v) => set({ shuffleSources: v }),
    setA4Output: (v) => set({ a4Output: v }),
    setPreviewData: (data) => set({ previewData: data }),
    setIsPreviewLoading: (v) => set({ isPreviewLoading: v }),
    setIsGenerating: (v) => set({ isGenerating: v }),

    setResult: (url, blob) => {
        const prev = get().resultUrl;
        if (prev) revokeUrls([prev]);
        set({ resultUrl: url, resultBlob: blob });
    },

    reset: () => {
        const state = get();
        if (state.mainImagePreviewUrl) revokeUrls([state.mainImagePreviewUrl]);
        revokeUrls(state.subImagePreviews);
        if (state.resultUrl) revokeUrls([state.resultUrl]);
        set({
            sessionId: makeSessionId(),
            mainImageFile: null,
            mainImagePreviewUrl: null,
            subImageFiles: [],
            subImagePreviews: [],
            palette: [],
            isAnalyzing: false,
            analyzeProgress: 0,
            previewData: null,
            resultUrl: null,
            resultBlob: null,
        });
    },
}));
