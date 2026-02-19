"use client";
import { useRef, useCallback } from "react";
import { useMosaicStore } from "@/store/useMosaicStore";

const BATCH_SIZE = 50; // Process thumbnails 50 at a time via requestIdleCallback

export default function SubImageUpload() {
    const { subImageFiles, subImagePreviews, addSubImageFiles, clearSubImages, isAnalyzing } =
        useMosaicStore();
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFiles = useCallback(
        (files: FileList | File[]) => {
            const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
            if (arr.length === 0) return;
            addSubImageFiles(arr);
        },
        [addSubImageFiles]
    );

    const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) handleFiles(e.target.files);
        // Reset so same files can be added again
        e.target.value = "";
    };

    const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        handleFiles(e.dataTransfer.files);
    };

    return (
        <div className="flex flex-col gap-3">
            {/* Drop / click area */}
            <div
                className={`drop-zone flex flex-col items-center justify-center gap-3 p-5 min-h-[140px] ${isAnalyzing ? "pointer-events-none opacity-60" : ""
                    }`}
                onClick={() => inputRef.current?.click()}
                onDrop={onDrop}
                onDragOver={(e) => e.preventDefault()}
                id="sub-images-dropzone"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
            >
                <input
                    ref={inputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={onInputChange}
                />
                <div className="w-12 h-12 rounded-xl bg-[var(--color-surface-2)] flex items-center justify-center border border-[var(--color-border)]">
                    <svg className="w-6 h-6 text-[var(--color-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M4 6a2 2 0 012-2h2.5M20 6a2 2 0 00-2-2h-2.5M4 18a2 2 0 002 2h2.5M20 18a2 2 0 01-2 2h-2.5M9 3h6M9 21h6M3 9v6M21 9v6" />
                    </svg>
                </div>
                <div className="text-center">
                    <p className="text-sm font-medium text-[var(--color-text)]">
                        {subImageFiles.length > 0
                            ? `${subImageFiles.length} image${subImageFiles.length === 1 ? "" : "s"} selected — click to add more`
                            : "Select source tile images"}
                    </p>
                    <p className="text-xs text-[var(--color-muted)] mt-1">
                        50–500+ images recommended. These become the mosaic tiles.
                    </p>
                </div>
            </div>

            {/* Thumbnail grid */}
            {subImagePreviews.length > 0 && (
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-[var(--color-muted)]">
                            Showing {Math.min(subImagePreviews.length, 200)} of {subImageFiles.length} thumbnails
                        </span>
                        <button
                            onClick={clearSubImages}
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
