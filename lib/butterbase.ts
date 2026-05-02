import type { Listing } from './apify'

const BASE = process.env.BB_BASE_URL!   // https://api.butterbase.ai/v1/app_qwo14r7s847j
const KEY  = process.env.BB_API_KEY!

const authHeaders = () => ({
  'Authorization': `Bearer ${KEY}`,
  'Content-Type': 'application/json',
})

async function bb(path: string, method = 'GET', body?: object) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Butterbase ${method} ${path} → ${res.status}: ${text}`)
  }
  return res.json()
}

// ── Listings ──────────────────────────────────────────────────────────────────

export async function createListing(listing: Listing, url: string): Promise<string> {
  const data = await bb('/listings', 'POST', {
    url,
    address:     listing.address,
    price:       listing.price,
    beds:        listing.beds,
    baths:       listing.baths,
    sqft:        listing.sqft,
    lot_size:    listing.lotSize,
    year_built:  listing.yearBuilt,
    description: listing.description,
    highlights:  listing.highlights,
  })
  return data.id ?? data.data?.id
}

export async function updateListing(listingId: string, patch: Record<string, unknown>) {
  await bb(`/listings/${listingId}`, 'PATCH', patch)
}

export async function getListing(listingId: string) {
  const data = await bb(`/listings/${listingId}`)
  return data.data ?? data
}

// ── Jobs ──────────────────────────────────────────────────────────────────────

export async function createJob(listingId: string): Promise<string> {
  const data = await bb('/jobs', 'POST', {
    listing_id: listingId,
    status: 'pending',
  })
  return data.id ?? data.data?.id
}

export async function updateJob(jobId: string, patch: Record<string, unknown>) {
  await bb(`/jobs/${jobId}`, 'PATCH', { ...patch, updated_at: new Date().toISOString() })
}

export async function getJob(jobId: string) {
  const data = await bb(`/jobs/${jobId}`)
  return data.data ?? data
}

// ── Storage ───────────────────────────────────────────────────────────────────

export async function uploadImage(buffer: ArrayBuffer, filename: string): Promise<string> {
  const res = await fetch(`${BASE}/storage/${filename}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${KEY}`,
      'Content-Type': 'image/jpeg',
    },
    body: buffer,
  })
  if (!res.ok) throw new Error(`Storage upload failed: ${res.status} ${await res.text()}`)
  const data = await res.json()
  return data.publicUrl ?? data.url ?? data.data?.publicUrl
}
