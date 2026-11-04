import { useEffect, useRef, useState, type PointerEvent } from 'react'

const FRAME_SIZE = 260
const OUTPUT_SIZE = 480

type Point = { x: number; y: number }

export default function ImageCropModal({
  file,
  onCancel,
  onConfirm,
}: {
  file: File
  onCancel: () => void
  onConfirm: (dataUrl: string) => void
}) {
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pos, setPos] = useState<Point>({ x: 0, y: 0 })
  const dragState = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null)

  useEffect(() => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => setImgEl(img)
    img.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  const naturalW = imgEl?.naturalWidth ?? 1
  const naturalH = imgEl?.naturalHeight ?? 1
  const baseScale = Math.max(FRAME_SIZE / naturalW, FRAME_SIZE / naturalH)
  const scale = baseScale * zoom
  const dispW = naturalW * scale
  const dispH = naturalH * scale

  function clamp(p: Point, w = dispW, h = dispH): Point {
    const minX = Math.min(0, FRAME_SIZE - w)
    const minY = Math.min(0, FRAME_SIZE - h)
    return { x: Math.min(0, Math.max(minX, p.x)), y: Math.min(0, Math.max(minY, p.y)) }
  }

  useEffect(() => {
    if (!imgEl) return
    setPos({ x: (FRAME_SIZE - dispW) / 2, y: (FRAME_SIZE - dispH) / 2 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imgEl])

  useEffect(() => {
    setPos((p) => clamp(p))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom])

  function handlePointerDown(e: PointerEvent<HTMLDivElement>) {
    dragState.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function handlePointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!dragState.current) return
    const dx = e.clientX - dragState.current.startX
    const dy = e.clientY - dragState.current.startY
    setPos(clamp({ x: dragState.current.origX + dx, y: dragState.current.origY + dy }))
  }
  function handlePointerUp() {
    dragState.current = null
  }

  function confirm() {
    if (!imgEl) return
    const canvas = document.createElement('canvas')
    canvas.width = OUTPUT_SIZE
    canvas.height = OUTPUT_SIZE
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const scaleFactor = naturalW / dispW
    const sx = -pos.x * scaleFactor
    const sy = -pos.y * scaleFactor
    const sSize = FRAME_SIZE * scaleFactor
    ctx.drawImage(imgEl, sx, sy, sSize, sSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE)
    onConfirm(canvas.toDataURL('image/jpeg', 0.88))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" onClick={onCancel}>
      <div
        className="w-full max-w-sm rounded-lg border border-neutral-800 bg-neutral-950 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-title font-semibold text-neutral-100">Ajustar recorte</p>
        <p className="mt-1 font-body text-xs text-neutral-500">Arraste pra posicionar, use o zoom pra ajustar.</p>

        <div
          className="relative mx-auto mt-5 touch-none overflow-hidden rounded-full border-2 border-neutral-700 bg-neutral-900"
          style={{ width: FRAME_SIZE, height: FRAME_SIZE, cursor: 'grab' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          {imgEl && (
            <img
              src={imgEl.src}
              alt="Pré-visualização"
              draggable={false}
              className="absolute select-none"
              style={{ width: dispW, height: dispH, left: pos.x, top: pos.y, maxWidth: 'none', maxHeight: 'none' }}
            />
          )}
        </div>

        <div className="mt-4 flex items-center gap-3">
          <span className="font-body text-xs text-neutral-500">Zoom</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full cursor-pointer accent-white"
          />
        </div>

        <div className="mt-6 flex gap-2">
          <button onClick={confirm} className="flex-1 rounded bg-white py-2 font-body text-sm font-semibold text-neutral-950 transition-colors duration-300 hover:bg-neutral-200">
            Usar essa foto
          </button>
          <button onClick={onCancel} className="rounded border border-neutral-700 px-4 py-2 font-body text-sm text-neutral-400 transition-colors duration-300 hover:text-white">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
