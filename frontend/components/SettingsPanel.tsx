"use client";
import { useMosaicStore, Style } from "@/store/useMosaicStore";

const STYLES: { id: Style; label: string; desc: string; icon: string }[] = [
    {
        id: "A",
        label: "Pure",
        desc: "Raw sub-images only. Authentic tile look.",
        icon: "🖼️",
    },
    {
        id: "B",
        label: "Color Corrected",
        desc: "Sub-images tinted to match target colors precisely.",
        icon: "🎨",
    },
    {
        id: "C",
        label: "Overlay Ghost",
        desc: "Original image ghosted at 25% opacity over tiles.",
        icon: "👁️",
    },
];

export default function SettingsPanel({
    onGenerate,
    onPreview,
    canGenerate,
}: {
    onGenerate: () => void;
    onPreview: () => void;
    canGenerate: boolean;
}) {
    const {
        tileSize, setTileSize,
        style, setStyle,
        allowRepeats, setAllowRepeats,
        overlayOpacity, setOverlayOpacity,
        shuffleSources, setShuffleSources,
        a4Output, setA4Output,
        isGenerating,
        isAnalyzing,
        isPreviewLoading,
        palette,
    } = useMosaicStore();

    const busy = isGenerating || isAnalyzing || isPreviewLoading;
    const hasPalette = palette.length > 0;

    return (
        <div className="flex flex-col gap-6">
            {/* Tile Size */}
            <div>
                <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-semibold text-[var(--color-text)]">
                        Tile Size
                    </label>
                    <span className="text-sm font-mono text-[var(--color-accent-from)] bg-[var(--color-surface-2)] px-2 py-0.5 rounded-md">
                        {tileSize}px
                    </span>
                </div>
                <input
                    type="range"
                    id="tile-size-slider"
                    min={10}
                    max={100}
                    step={5}
                    value={tileSize}
                    onChange={(e) => setTileSize(Number(e.target.value))}
                    disabled={busy}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer bg-[var(--color-surface-2)] accent-[var(--color-accent-from)] disabled:opacity-50"
                />
                <div className="flex justify-between text-xs text-[var(--color-muted)] mt-1">
                    <span>10px (fine)</span>
                    <span>100px (coarse)</span>
                </div>
            </div>

            {/* Blending Style */}
            <div>
                <label className="block text-sm font-semibold text-[var(--color-text)] mb-3">
                    Blending Style
                </label>
                <div className="grid grid-cols-3 gap-2">
                    {STYLES.map((s) => (
                        <button
                            key={s.id}
                            id={`style-${s.id}-btn`}
                            onClick={() => setStyle(s.id)}
                            disabled={busy}
                            className={`style-card text-left transition-all disabled:opacity-50 ${style === s.id ? "selected" : ""
                                }`}
                        >
                            <div className="text-xl mb-1">{s.icon}</div>
                            <div className="text-xs font-bold text-[var(--color-text)]">{s.label}</div>
                            <div className="text-[10px] text-[var(--color-muted)] mt-1 leading-relaxed">
                                {s.desc}
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Overlay Opacity (only for style C) */}
            {style === "C" && (
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <label className="text-sm font-semibold text-[var(--color-text)]">
                            Ghost Opacity
                        </label>
                        <span className="text-sm font-mono text-[var(--color-accent-from)] bg-[var(--color-surface-2)] px-2 py-0.5 rounded-md">
                            {Math.round(overlayOpacity * 100)}%
                        </span>
                    </div>
                    <input
                        type="range"
                        id="overlay-opacity-slider"
                        min={0.05}
                        max={0.6}
                        step={0.05}
                        value={overlayOpacity}
                        onChange={(e) => setOverlayOpacity(Number(e.target.value))}
                        disabled={busy}
                        className="w-full h-2 rounded-full appearance-none cursor-pointer bg-[var(--color-surface-2)] accent-[var(--color-accent-from)] disabled:opacity-50"
                    />
                </div>
            )}

            {/* Repetition Rule */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)]">
                <div>
                    <p className="text-sm font-semibold text-[var(--color-text)]">Allow Repeats</p>
                    <p className="text-xs text-[var(--color-muted)]">
                        {allowRepeats
                            ? "Same tile may appear multiple times"
                            : "Each tile used at most once (may fall back if tiles run out)"}
                    </p>
                </div>
                <button
                    id="allow-repeats-toggle"
                    onClick={() => setAllowRepeats(!allowRepeats)}
                    disabled={busy}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${allowRepeats ? "bg-[var(--color-accent-from)]" : "bg-[var(--color-border)]"
                        }`}
                >
                    <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${allowRepeats ? "translate-x-6" : "translate-x-1"
                            }`}
                    />
                </button>
            </div>

            {/* Shuffle Sources */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)]">
                <div>
                    <p className="text-sm font-semibold text-[var(--color-text)]">🔀 Shuffle Tiles</p>
                    <p className="text-xs text-[var(--color-muted)]">
                        {shuffleSources
                            ? "Tile order randomized — different result each run"
                            : "Tiles matched in palette order (deterministic)"}
                    </p>
                </div>
                <button
                    id="shuffle-sources-toggle"
                    onClick={() => setShuffleSources(!shuffleSources)}
                    disabled={busy}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${shuffleSources ? "bg-[var(--color-accent-from)]" : "bg-[var(--color-border)]"
                        }`}
                >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${shuffleSources ? "translate-x-6" : "translate-x-1"
                        }`} />
                </button>
            </div>

            {/* A4 Output */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)]">
                <div>
                    <p className="text-sm font-semibold text-[var(--color-text)]">📄 Optimize for A4</p>
                    <p className="text-xs text-[var(--color-muted)]">
                        {a4Output
                            ? "Output: 2480×3508 px @ 300 DPI — print ready"
                            : "Output matches input image resolution"}
                    </p>
                </div>
                <button
                    id="a4-output-toggle"
                    onClick={() => setA4Output(!a4Output)}
                    disabled={busy}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${a4Output ? "bg-[var(--color-accent-from)]" : "bg-[var(--color-border)]"
                        }`}
                >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${a4Output ? "translate-x-6" : "translate-x-1"
                        }`} />
                </button>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2">
                {hasPalette && (
                    <button
                        id="preview-btn"
                        onClick={onPreview}
                        disabled={busy || !canGenerate}
                        className="w-full py-2.5 rounded-xl border border-[var(--color-border)] text-sm font-semibold text-[var(--color-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-accent-from)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {isPreviewLoading ? "Loading preview…" : "🔍 Low-Res Preview"}
                    </button>
                )}
                <button
                    id="generate-btn"
                    onClick={onGenerate}
                    disabled={busy || !canGenerate}
                    className="w-full py-3 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                        background: busy || !canGenerate
                            ? "var(--color-surface-2)"
                            : "linear-gradient(135deg, var(--color-accent-from), var(--color-accent-to))",
                    }}
                >
                    {isAnalyzing
                        ? "Analyzing tiles…"
                        : isGenerating
                            ? "Generating mosaic…"
                            : !hasPalette
                                ? "↑ Upload sources first"
                                : "✨ Generate Mosaic"}
                </button>
            </div>
        </div>
    );
}
