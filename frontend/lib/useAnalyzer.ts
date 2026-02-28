"use client";
import { useMosaicStore } from "@/store/useMosaicStore";

const CHUNK_BYTES = 5 * 1024 * 1024; // 5MB chunk per batch POST

export function useAnalyzer() {
    const {
        sessionId, subImageFiles,
        setIsAnalyzing, setAnalyzeProgress, setPalette,
    } = useMosaicStore();

    const analyze = async () => {
        if (subImageFiles.length === 0) return;
        setIsAnalyzing(true);
        setAnalyzeProgress(0);

        // Split files into batches by cumulative byte size
        const batches: File[][] = [];
        let current: File[] = [];
        let size = 0;
        for (const f of subImageFiles) {
            current.push(f);
            size += f.size;
            if (size >= CHUNK_BYTES) {
                batches.push(current);
                current = [];
                size = 0;
            }
        }
        if (current.length) batches.push(current);

        let latestPalette: { index: number; r: number; g: number; b: number }[] = [];

        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];
            const fd = new FormData();
            fd.append("session_id", sessionId);
            for (const f of batch) fd.append("files", f);

            const res = await fetch("/api/analyze", { method: "POST", body: fd });
            if (!res.ok) throw new Error(`Analyze failed: ${await res.text()}`);
            const json = await res.json();

            // Backend now returns the full merged palette for the session,
            // with correct indices already applied server-side.
            latestPalette = json.palette;

            setAnalyzeProgress(Math.round(((i + 1) / batches.length) * 100));
        }

        setPalette(latestPalette);
        setIsAnalyzing(false);
    };

    return { analyze };
}
