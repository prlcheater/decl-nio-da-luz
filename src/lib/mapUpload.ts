import { supabase } from './supabase'

const BUCKET = 'battle-maps'
const TARGET_W = 1600
const TARGET_H = 900 // 16:9

// Recorta a imagem para 16:9 (corte central) e devolve um Blob JPEG pronto para upload.
export function fileTo16x9Jpeg(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const targetRatio = TARGET_W / TARGET_H
      const srcRatio = img.width / img.height
      let sw = img.width
      let sh = img.height
      if (srcRatio > targetRatio) sw = Math.round(img.height * targetRatio)
      else sh = Math.round(img.width / targetRatio)
      const sx = Math.max(0, Math.round((img.width - sw) / 2))
      const sy = Math.max(0, Math.round((img.height - sh) / 2))
      const canvas = document.createElement('canvas')
      canvas.width = TARGET_W
      canvas.height = TARGET_H
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('Canvas indisponivel.')); return }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, TARGET_W, TARGET_H)
      canvas.toBlob((blob) => { if (blob) resolve(blob); else reject(new Error('Falha ao processar a imagem.')) }, 'image/jpeg', 0.9)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Arquivo de imagem invalido.')) }
    img.src = url
  })
}

// Envia o mapa (ja recortado em 16:9) e devolve a URL publica.
export async function uploadBattleMap(file: File): Promise<string> {
  const blob = await fileTo16x9Jpeg(file)
  const path = crypto.randomUUID() + '.jpg'
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg' })
  if (error) throw new Error('Falha ao enviar o mapa: ' + error.message)
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}