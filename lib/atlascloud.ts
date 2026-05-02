const ATLAS_BASE = 'https://api.atlascloud.ai'
const KEY = () => process.env.ATLAS_API_KEY!

async function uploadToAtlas(imageUrl: string): Promise<string> {
  const imageRes = await fetch(imageUrl)
  if (!imageRes.ok) throw new Error(`Failed to fetch image for Atlas: ${imageRes.status}`)
  const buffer = await imageRes.arrayBuffer()

  const form = new FormData()
  form.append('file', new Blob([buffer], { type: 'image/jpeg' }), 'image.jpg')

  const res = await fetch(`${ATLAS_BASE}/api/v1/model/uploadMedia`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${KEY()}` },
    body: form,
  })
  if (!res.ok) throw new Error(`Atlas media upload failed: ${res.status} ${await res.text()}`)
  const json = await res.json()
  const url = json?.data?.download_url ?? json?.url ?? json?.data?.url
  if (!url) throw new Error(`No URL in Atlas upload response: ${JSON.stringify(json)}`)
  return url
}

async function submitWithImages(atlasUrls: string[], prompt: string): Promise<string> {
  // Try multi-image (Seedance 2.0 native feature)
  const res = await fetch(`${ATLAS_BASE}/api/v1/model/generateVideo`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${KEY()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model:          'bytedance/seedance-2.0',
      prompt,
      images:         atlasUrls,
      aspect_ratio:   '16:9',
      duration:       14,
      generate_audio: true,
      seed:           -1,
    }),
  })
  if (!res.ok) throw new Error(`multi:${res.status} ${await res.text()}`)
  const { data } = await res.json()
  const id = data?.id
  if (!id) throw new Error(`No prediction ID: ${JSON.stringify(data)}`)
  return id
}

async function submitWithSingleImage(atlasUrl: string, prompt: string): Promise<string> {
  const res = await fetch(`${ATLAS_BASE}/api/v1/model/generateVideo`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${KEY()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model:          'bytedance/seedance-2.0/image-to-video',
      prompt,
      image_url:      atlasUrl,
      aspect_ratio:   '16:9',
      duration:       14,
      generate_audio: true,
      seed:           -1,
    }),
  })
  if (!res.ok) throw new Error(`Atlas submit failed: ${res.status} ${await res.text()}`)
  const { data } = await res.json()
  const id = data?.id
  if (!id) throw new Error(`No prediction ID: ${JSON.stringify(data)}`)
  return id
}

export async function submitVideoJob(imageUrls: string[], prompt: string): Promise<string> {
  // Upload up to 4 images to Atlas
  const uploadCount = Math.min(imageUrls.length, 4)
  const atlasUrls: string[] = []
  for (let i = 0; i < uploadCount; i++) {
    atlasUrls.push(await uploadToAtlas(imageUrls[i]))
  }

  // Try multi-image; fall back to single image if the model rejects it
  if (atlasUrls.length > 1) {
    try {
      return await submitWithImages(atlasUrls, prompt)
    } catch (e: any) {
      if (!e.message.startsWith('multi:')) throw e
      // multi-image rejected — fall back to first image
    }
  }
  return submitWithSingleImage(atlasUrls[0], prompt)
}

export async function pollVideoJob(predictionId: string, timeoutMs = 600_000): Promise<string> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const res = await fetch(`${ATLAS_BASE}/api/v1/model/prediction/${predictionId}`, {
      headers: { 'Authorization': `Bearer ${KEY()}` },
    })
    if (!res.ok) throw new Error(`Atlas poll failed: ${res.status}`)
    const { data } = await res.json()
    const status = (data?.status ?? '').toLowerCase()

    if (status === 'completed') {
      const url = data?.outputs?.[0]
      if (!url) throw new Error(`Atlas completed but no video URL: ${JSON.stringify(data)}`)
      return url
    }
    if (['failed', 'error', 'cancelled'].includes(status)) {
      throw new Error(`Atlas job failed: ${data?.error ?? status}`)
    }
    await new Promise(r => setTimeout(r, 5000))
  }
  throw new Error(`Atlas job timed out after ${timeoutMs / 1000}s`)
}
