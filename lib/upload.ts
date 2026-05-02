const APP_ID = process.env.BB_APP_ID!
const KEY = process.env.BB_API_KEY!
const STORAGE_BASE = () => `https://api.butterbase.ai/storage/${APP_ID}`

export async function uploadImageFromUrl(imageUrl: string, filename: string): Promise<string> {
  const res = await fetch(imageUrl)
  if (!res.ok) throw new Error(`Failed to fetch image: ${imageUrl}`)
  const buffer = await res.arrayBuffer()

  // Step 1: request presigned upload URL
  const presignRes = await fetch(`${STORAGE_BASE()}/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      filename,
      contentType: 'image/jpeg',
      sizeBytes: buffer.byteLength,
      public: true,
    }),
  })
  if (!presignRes.ok) throw new Error(`Butterbase presign failed: ${presignRes.status} ${await presignRes.text()}`)
  const { uploadUrl, objectId } = await presignRes.json()

  // Step 2: upload directly to the presigned S3 URL
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/jpeg' },
    body: buffer,
  })
  if (!uploadRes.ok) throw new Error(`S3 upload failed: ${uploadRes.status}`)

  // Step 3: get a presigned download URL (expires in 1h — enough for AtlasCloud rendering)
  const dlRes = await fetch(`${STORAGE_BASE()}/download/${objectId}`, {
    headers: { 'Authorization': `Bearer ${KEY}` },
  })
  if (!dlRes.ok) throw new Error(`Download URL failed: ${dlRes.status} ${await dlRes.text()}`)
  const { downloadUrl } = await dlRes.json()

  return downloadUrl
}
