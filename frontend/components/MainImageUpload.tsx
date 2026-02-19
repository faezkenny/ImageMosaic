"use client";
import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useMosaicStore } from "@/store/useMosaicStore";

export default function MainImageUpload() {
    const { mainImagePreviewUrl, setMainImageFile } = useMosaicStore();

    const onDrop = useCallback(
        (accepted: File[]) => {
            if (accepted[0]) setMainImageFile(accepted[0]);
        },
        [setMainImageFile]
    );

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { "image/*": [] },
        maxFiles: 1,
    });

    return (
        <div className="flex flex-col gap-3">
            <div
                {...getRootProps()}
                className={`drop-zone flex flex-col items-center justify-center gap-3 p-6 min-h-[200px] transition-all ${isDragActive ? "active" : ""
                    }`}
                id="main-image-dropzone"
            >
                <input {...getInputProps()} />
                {mainImagePreviewUrl ? (
                    <div className="relative w-full">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={mainImagePreviewUrl}
                            alt="Main image preview"
                            className="w-full max-h-48 object-contain rounded-lg"
                        />
                        <div className="mt-2 text-center text-xs text-[var(--color-muted)]">
                            Click or drag to replace
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="w-14 h-14 rounded-xl bg-[var(--color-surface-2)] flex items-center justify-center border border-[var(--color-border)]">
                            <svg
                                className="w-7 h-7 text-[var(--color-muted)]"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={1.5}
                                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                />
                            </svg>
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-medium text-[var(--color-text)]">
                                {isDragActive ? "Drop it here!" : "Drag & drop your main image"}
                            </p>
                            <p className="text-xs text-[var(--color-muted)] mt-1">
                                JPG, PNG, WEBP — this is the image that becomes the mosaic
                            </p>
                        </div>
                        <button
                            type="button"
                            className="text-xs px-4 py-2 rounded-lg border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-accent-from)] transition-colors"
                        >
                            Browse file
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
