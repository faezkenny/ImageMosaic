"use client";

import { useCallback, useState } from "react";
import MainImageUpload from "@/components/MainImageUpload";
import SubImageUpload from "@/components/SubImageUpload";
import SettingsPanel from "@/components/SettingsPanel";
import ZoomLoupe from "@/components/ZoomLoupe";
import MosaicPreviewCanvas from "@/components/MosaicPreviewCanvas";
import { useMosaicStore } from "@/store/useMosaicStore";
import { useAnalyzer } from "@/lib/useAnalyzer";

export default function HomePage() {
  const {
    sessionId,
    mainImageFile,
    subImageFiles,
    palette,
    tileSize,
    style,
    allowRepeats,
    overlayOpacity,
    shuffleSources,
    a4Output,
    isAnalyzing,
    analyzeProgress,
    isGenerating, setIsGenerating,
    isPreviewLoading, setIsPreviewLoading,
    previewData, setPreviewData,
    resultUrl, setResult,
    resultBlob,
  } = useMosaicStore();

  const { analyze } = useAnalyzer();
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"preview" | "result">("preview");

  const canGenerate = !!mainImageFile && subImageFiles.length > 0;

  // ----- Analyze + possibly generate -------------------------------------
  const handleGenerate = useCallback(async () => {
    if (!mainImageFile || subImageFiles.length === 0) return;
    setError(null);

    try {
      // Step 1: analyze if palette not ready
      if (palette.length === 0) {
        await analyze();
      }

      // Step 2: generate
      setIsGenerating(true);
      const fd = new FormData();
      fd.append("session_id", sessionId);
      fd.append("main_image", mainImageFile);
      fd.append("tile_size", String(tileSize));
      fd.append("style", style);
      fd.append("allow_repeats", String(allowRepeats));
      fd.append("overlay_opacity", String(overlayOpacity));
      fd.append("shuffle_sources", String(shuffleSources));
      fd.append("a4_output", String(a4Output));

      const res = await fetch("/api/generate", { method: "POST", body: fd });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setResult(url, blob);
      setActiveTab("result");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setIsGenerating(false);
    }
  }, [
    mainImageFile, subImageFiles, palette, analyze,
    sessionId, tileSize, style, allowRepeats, overlayOpacity,
    shuffleSources, a4Output,
    setIsGenerating, setResult,
  ]);

  // ----- Preview (low-res) -----------------------------------------------
  const handlePreview = useCallback(async () => {
    if (!mainImageFile || palette.length === 0) return;
    setError(null);
    setIsPreviewLoading(true);
    try {
      const fd = new FormData();
      fd.append("session_id", sessionId);
      fd.append("main_image", mainImageFile);
      fd.append("tile_size", String(tileSize));
      const res = await fetch("/api/preview", { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setPreviewData(data);
      setActiveTab("preview");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setIsPreviewLoading(false);
    }
  }, [mainImageFile, palette, sessionId, tileSize, setIsPreviewLoading, setPreviewData]);

  const handleDownload = () => {
    if (!resultBlob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(resultBlob);
    a.download = `mosaic-${style}-${tileSize}px.png`;
    a.click();
  };

  const busy = isAnalyzing || isGenerating || isPreviewLoading;

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: "var(--color-bg)" }}>
      {/* ---- Header ---- */}
      <header className="border-b border-[var(--color-border)] px-6 py-4 flex items-center justify-between sticky top-0 z-30"
        style={{ background: "rgba(8,12,20,0.85)", backdropFilter: "blur(12px)" }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
            style={{ background: "linear-gradient(135deg, var(--color-accent-from), var(--color-accent-to))" }}>
            M
          </div>
          <div>
            <h1 className="text-sm font-bold text-[var(--color-text)]">Photo Mosaic Generator</h1>
            <p className="text-[10px] text-[var(--color-muted)]">Recreate images from thousands of tiles</p>
          </div>
        </div>
        <a href="https://github.com" target="_blank" rel="noreferrer"
          className="text-xs text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors">
          Docs
        </a>
      </header>

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-0">
        {/* ====== LEFT PANEL ====== */}
        <aside className="border-r border-[var(--color-border)] p-6 flex flex-col gap-6 overflow-y-auto"
          style={{ maxHeight: "calc(100dvh - 61px)" }}>

          {/* Main image */}
          <section className="glass-card p-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--color-muted)] mb-3">
              01 — Main Image
            </h2>
            <MainImageUpload />
          </section>

          {/* Sub-images */}
          <section className="glass-card p-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--color-muted)] mb-3">
              02 — Source Tiles
            </h2>
            <SubImageUpload />

            {/* Analysis progress */}
            {isAnalyzing && (
              <div className="mt-3">
                <div className="flex justify-between text-xs text-[var(--color-muted)] mb-1">
                  <span>Analyzing colors…</span>
                  <span>{analyzeProgress}%</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-bar-fill" style={{ width: `${analyzeProgress}%` }} />
                </div>
              </div>
            )}
            {palette.length > 0 && !isAnalyzing && (
              <div className="mt-3 flex items-center gap-2 text-xs text-emerald-400">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {palette.length} tiles analyzed
              </div>
            )}
          </section>

          {/* Settings */}
          <section className="glass-card p-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--color-muted)] mb-3">
              03 — Settings &amp; Generate
            </h2>
            <SettingsPanel
              onGenerate={handleGenerate}
              onPreview={handlePreview}
              canGenerate={canGenerate}
            />
          </section>

          {/* Error */}
          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-xs text-red-300">
              <span className="font-bold">Error:</span> {error}
            </div>
          )}
        </aside>

        {/* ====== RIGHT PANEL — RESULT ====== */}
        <section className="p-6 overflow-y-auto flex flex-col gap-4"
          style={{ maxHeight: "calc(100dvh - 61px)" }}>

          {/* Tab bar */}
          {(previewData || resultUrl) && (
            <div className="flex gap-2 border-b border-[var(--color-border)] pb-3">
              {previewData && (
                <button
                  onClick={() => setActiveTab("preview")}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${activeTab === "preview"
                    ? "bg-[var(--color-surface-2)] text-[var(--color-text)]"
                    : "text-[var(--color-muted)] hover:text-[var(--color-text)]"
                    }`}
                >
                  🔍 Preview
                </button>
              )}
              {resultUrl && (
                <button
                  onClick={() => setActiveTab("result")}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${activeTab === "result"
                    ? "bg-[var(--color-surface-2)] text-[var(--color-text)]"
                    : "text-[var(--color-muted)] hover:text-[var(--color-text)]"
                    }`}
                >
                  ✨ Full Result
                </button>
              )}
            </div>
          )}

          {/* Generate-in-progress spinner */}
          {busy && !resultUrl && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
              <div className="relative w-16 h-16">
                <div
                  className="absolute inset-0 rounded-full border-4 border-transparent animate-spin-slow"
                  style={{
                    borderTopColor: "var(--color-accent-from)",
                    borderRightColor: "var(--color-accent-to)",
                  }}
                />
                <div className="absolute inset-3 rounded-full"
                  style={{ background: "linear-gradient(135deg, var(--color-accent-from), var(--color-accent-to))", opacity: 0.3 }} />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--color-text)]">
                  {isAnalyzing ? "Analyzing tile palette…" : "Generating your mosaic…"}
                </p>
                <p className="text-xs text-[var(--color-muted)] mt-1">
                  This may take a moment for large images
                </p>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!busy && !resultUrl && !previewData && (
            <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center px-8">
              {/* Decorative mosaic grid illustration */}
              <div className="grid grid-cols-6 gap-1 opacity-30">
                {Array.from({ length: 36 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-10 h-10 rounded-md"
                    style={{
                      background: `hsl(${(i * 37) % 360}deg, 60%, 40%)`,
                    }}
                  />
                ))}
              </div>
              <div>
                <h2 className="text-xl font-bold gradient-text mb-2">Your Mosaic awaits</h2>
                <p className="text-sm text-[var(--color-muted)] max-w-sm">
                  Upload a main image and source tiles, adjust the settings, then hit{" "}
                  <strong className="text-[var(--color-text)]">Generate Mosaic</strong>.
                </p>
              </div>
              <div className="flex flex-wrap gap-4 justify-center text-xs text-[var(--color-muted)]">
                <span className="flex items-center gap-1.5"><span className="text-base">🖼️</span> Pure tiles</span>
                <span className="flex items-center gap-1.5"><span className="text-base">🎨</span> Color tuned</span>
                <span className="flex items-center gap-1.5"><span className="text-base">👁️</span> Ghost overlay</span>
                <span className="flex items-center gap-1.5"><span className="text-base">🔍</span> Zoom loupe</span>
              </div>
            </div>
          )}

          {/* Low-res preview */}
          {activeTab === "preview" && previewData && !busy && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-[var(--color-muted)]">
                  {previewData.cols} × {previewData.rows} tiles — avg color approximation
                </p>
              </div>
              <MosaicPreviewCanvas data={previewData} />
            </div>
          )}

          {/* Full result */}
          {activeTab === "result" && resultUrl && !busy && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-[var(--color-muted)]">
                  Hover to zoom · Style: <strong className="text-[var(--color-text)]">{style === "A" ? "Pure" : style === "B" ? "Color Corrected" : "Overlay Ghost"}</strong>
                </p>
                <button
                  id="download-btn"
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold text-white transition-all hover:scale-105 active:scale-95"
                  style={{ background: "linear-gradient(135deg, var(--color-accent-from), var(--color-accent-to))" }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download PNG
                </button>
              </div>
              <ZoomLoupe src={resultUrl} magnification={4} loupeSize={180} />
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
