"use client";
import { useEffect, useRef } from "react";
import { useMosaicStore, PreviewData } from "@/store/useMosaicStore";

interface Props {
    data: PreviewData;
}

export default function MosaicPreviewCanvas({ data }: Props) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const BLOCK = 8; // preview block size in px (fixed, low-res feel)
        canvas.width = data.cols * BLOCK;
        canvas.height = data.rows * BLOCK;

        data.blocks.forEach(({ x, y, srcR, srcG, srcB }) => {
            ctx.fillStyle = `rgb(${srcR},${srcG},${srcB})`;
            ctx.fillRect(x * BLOCK, y * BLOCK, BLOCK, BLOCK);
        });
    }, [data]);

    return (
        <div className="relative">
            <div className="absolute top-2 left-2 text-[10px] text-white bg-black/60 px-2 py-0.5 rounded-md z-10">
                Low-res preview
            </div>
            <canvas
                ref={canvasRef}
                className="w-full rounded-xl block"
                style={{ imageRendering: "pixelated" }}
            />
        </div>
    );
}
