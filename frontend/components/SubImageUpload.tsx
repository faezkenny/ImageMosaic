"use client";
import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useMosaicStore } from "@/store/useMosaicStore";

const MIN_TILES_RECOMMENDED = 30;

export default function SubImageUpload() {
    const { subImageFiles, subImagePreviews, addSubImageFiles, clearSubImages, isAnalyzing } =
        useMosaicStore();

    const onDrop = useCallback(
        (accepted: File[]) => {
            const images = accepted.filter((f) => f.type.startsWith("image/"));
            if (images.length === 0) return;
            addSubImageFiles(images);
        },
        [addSubImageFiles]
    );

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { "image/*": [] },
        multiple: true,
        disabled: isAnalyzing,
    });

    const tooFewTiles =
        subImageFiles.length > 0 && subImageFiles.length < MIN_TILES_RECOMMENDED;

    return (
        <div className="flex flex-col gap-3">
            {/* Drop / click area */}
            <div
                {...getRootProps()}
                className={`drop-zone flex flex-col items-center justify-center gap-3 p-5 min-h-[140px] ${
                    isDragActive ? "active" : ""
                } ${isAnalyzing ? "pointer-events-none opacity-60" : ""}`}
                id="sub-images-dropzone"
            >
                <input {...getInputProps()} />
                <div className="w-12 h-12 rounded-xl bg-[var(--color-surface-2)] flex items-center justify-center border border-[var(--color-border)]">
                    <svg className="w-6 h-6 text-[var(--color-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M4 6a2 2 0 012-2h2.5M20 6a2 2 0 00-2-2h-2.5M4 18a2 2 0 002 2h2.5M20 18a2 2 0 01-2 2h-2.5M9 3h6M9 21h6M3 9v6M21 9v6" />
                    </svg>
                </div>
                <div className="text-center">
                    <p className="text-sm font-medium text-[var(--color-text)]">
                        {isDragActive
                            ? "Drop images here!"
                            : subImageFiles.length > 0
                                ? `${subImageFiles.length} image${subImageFiles.length === 1 ? "" : "s"} selected — click or drop to add more`
                                : "Select source tile images"}
                    </p>
                    <p className="text-xs text-[var(--color-muted)] mt-1">
                        50–500+ images recommended. These become the mosaic tiles.
                    </p>
                </div>
            </div>

            {/* Low tile count warning */}
            {tooFewTiles && (
                <div className="flex items-start gap-2 rounded-xl border border-yellow-500/30 bg-yellow-950/30 px-3 py-2.5 text-xs text-yellow-300">
                    <svg className="w-3.5 h-3.5 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span>
                        Only {subImageFiles.length} tile{subImageFiles.length === 1 ? "" : "s"} — add at least {MIN_TILES_RECOMMENDED} for a good mosaic. Fewer tiles means more repetition.
                    </span>
                </div>
            )}

            {/* Thumbnail grid */}
            {subImagePreviews.length > 0 && (
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-[var(--color-muted)]">
                            Showing {Math.min(subImagePreviews.length, 200)} of {subImageFiles.length} thumbnails
                        </span>
                        <button
                            onClick={(e) => { e.stopPropagation(); clearSubImages(); }}
                            className="text-xs text-red-400 hover:text-red-300 transition-colors"
                            id="clear-sub-images-btn"
                        >
                            Clear all
                        </button>
                    </div>
                    <div className="thumb-grid">
                        {subImagePreviews.slice(0, 200).map((url, i) => (
                            <div key={i} className="thumb-item">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={url} alt={`tile-${i}`} loading="lazy" />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
