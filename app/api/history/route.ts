const BASE = process.env.BB_BASE_URL!
const KEY  = process.env.BB_API_KEY!

export async function GET() {
  const headers = { 'Authorization': `Bearer ${KEY}` }

  // Fetch recent succeeded jobs
  const jobsRes = await fetch(`${BASE}/jobs?status=eq.succeeded&limit=8`, { headers })
  if (!jobsRes.ok) return Response.json([])
  const jobsData = await jobsRes.json()
  const jobs: any[] = jobsData.data ?? jobsData ?? []

  // Fetch each listing in parallel
  const entries = await Promise.all(
    jobs.map(async (job: any) => {
      if (!job.listing_id) return null
      try {
        const lRes = await fetch(`${BASE}/listings/${job.listing_id}`, { headers })
        if (!lRes.ok) return null
        const lData = await lRes.json()
        const l = lData.data ?? lData
        return {
          jobId:   job.id,
          address: l.address ?? '',
          price:   l.price,
          beds:    l.beds,
          baths:   l.baths,
          createdAt: job.created_at,
        }
      } catch { return null }
    })
  )

  return Response.json(entries.filter(Boolean))
}
