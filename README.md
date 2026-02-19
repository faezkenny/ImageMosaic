# Photo Mosaic Generator

A full-stack application that transforms a target image into a stunning mosaic using a collection of source images as tiles.

## Features

- **Multi-Style Blending**:
  - **Pure**: Uses raw sub-images for an authentic tile look.
  - **Color Corrected**: Tints sub-images to match target colors precisely using vectorized NumPy operations.
  - **Overlay Ghost**: Layers the original image at 25% opacity over tiles for a "ghosting" effect that preserves fine details.
- **Optimized for Print**: Built-in option to optimize the output for **A4 size at 300 DPI** (2480x3508 px).
- **Intelligent Matching**: Uses a vectorized Euclidean distance matching algorithm for fast and accurate color matching.
- **Variety Controls**: Toggle for **Shuffled Tiles** to ensure the mosaic looks different and organic every time.
- **High Performance**:
  - **Backend**: Python FastAPI with NumPy and Pillow for heavy image processing.
  - **Frontend**: Next.js 14 with Zustand and Tailwind CSS.
- **User Experience**:
  - Drag-and-drop uploads.
  - Low-res canvas preview before full-res generation.
  - High-resolution zoom loupe to inspect individual tiles.
  - Batch upload support for 500+ source images via chunked processing.

## Tech Stack

- **Frontend**: [Next.js](https://nextjs.org/), [Tailwind CSS](https://tailwindcss.com/), [Zustand](https://zustand-demo.pmnd.rs/)
- **Backend**: [FastAPI](https://fastapi.tiangolo.com/), [NumPy](https://numpy.org/), [Pillow](https://python-pillow.org/)

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.10+

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the server:
   ```bash
   uvicorn main:app --reload --port 8000
   ```

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000) to use the application.

## Usage

1. **Upload Main Image**: Drag and drop your target picture.
2. **Upload Source Tiles**: Bulk upload a gallery of small images (recommend 100+ for best results).
3. **Configure**: Adjust tile size, choose a blending style, and toggle A4 optimization or shuffling.
4. **Generate**: View the low-res preview or go straight to the high-res generation.
5. **Download**: Use the zoom loupe to see the details and download your masterpiece.

## License

MIT
