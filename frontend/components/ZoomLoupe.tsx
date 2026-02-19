"use client";
import { useRef, useState, useCallback } from "react";

interface ZoomLoupeProps {
    src: string;
    alt?: string;
    magnification?: number;
    loupeSize?: number;
}

export default function ZoomLoupe({
    src,
    alt = "Mosaic result",
    magnification = 4,
    loupeSize = 160,
}: ZoomLoupeProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);
    const loupeRef = useRef<HTMLDivElement>(null);
    const [visible, setVisible] = useState(false);

    const handleMouseMove = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            const container = containerRef.current;
            const img = imgRef.current;
            const loupe = loupeRef.current;
            if (!container || !img || !loupe) return;

            const rect = container.getBoundingClientRect();
            const cx = e.clientX - rect.left;
            const cy = e.clientY - rect.top;

            // Position loupe — keep it inside container bounds
            const halfLoupe = loupeSize / 2;
            const lx = Math.max(0, Math.min(cx - halfLoupe, rect.width - loupeSize));
            const ly = Math.max(0, Math.min(cy - halfLoupe, rect.height - loupeSize));

            loupe.style.left = `${lx}px`;
            loupe.style.top = `${ly}px`;

            // Background offset for magnifying glass
            const scaleX = img.naturalWidth / img.offsetWidth;
            const scaleY = img.naturalHeight / img.offsetHeight;

            const bgX = -(cx * scaleX * magnification - halfLoupe);
            const bgY = -(cy * scaleY * magnification - halfLoupe);

            loupe.style.backgroundImage = `url(${src})`;
            loupe.style.backgroundSize = `${img.offsetWidth * magnification}px ${img.offsetHeight * magnification}px`;
            loupe.style.backgroundPosition = `${bgX}px ${bgY}px`;
        },
        [src, magnification, loupeSize]
    );

    return (
        <div
            ref={containerRef}
            className="relative select-none"
            style={{ display: "inline-block", maxWidth: "100%" }}
            onMouseMove={handleMouseMove}
            onMouseEnter={() => setVisible(true)}
            onMouseLeave={() => setVisible(false)}
        >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                ref={imgRef}
                src={src}
                alt={alt}
                className="w-full rounded-xl block"
                draggable={false}
            />

            {/* Loupe */}
            <div
                ref={loupeRef}
                className="absolute pointer-events-none rounded-full border-2 border-[var(--color-accent-from)] shadow-2xl"
                style={{
                    width: loupeSize,
                    height: loupeSize,
                    backgroundRepeat: "no-repeat",
                    display: visible ? "block" : "none",
                    zIndex: 20,
                    boxShadow: "0 0 0 2px rgba(124,58,237,0.4), 0 8px 32px rgba(0,0,0,0.7)",
                }}
            />
            {visible && (
                <div
                    className="absolute bottom-2 right-2 text-[10px] text-white bg-black/50 px-2 py-0.5 rounded-md pointer-events-none"
                    style={{ zIndex: 21 }}
                >
                    {magnification}× zoom
                </div>
            )}
        </div>
    );
}
