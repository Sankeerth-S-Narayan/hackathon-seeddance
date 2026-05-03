import { getListing } from '@/lib/butterbase'

const BASE = process.env.BB_BASE_URL!
const KEY  = process.env.BB_API_KEY!

/**
 * Returns the newest succeeded job + listing for the hero demo.
 * Picks latest by job created_at among matches (e.g. two runs for same address → newest wins).
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const match = (searchParams.get('address') ?? '17 Zelma Dr').toLowerCase()

  const headers = { 'Authorization': `Bearer ${KEY}` }
  const jobsRes = await fetch(`${BASE}/jobs?status=eq.succeeded&limit=40`, { headers })
  if (!jobsRes.ok) return Response.json(null, { status: 502 })

  const jobsData = await jobsRes.json()
  const jobs: any[] = jobsData.data ?? jobsData ?? []

  const enriched = await Promise.all(
    jobs.map(async (job: any) => {
      if (!job.listing_id) return null
      try {
        const listing = await getListing(job.listing_id)
        const addr = (listing?.address ?? '').toLowerCase()
        if (!addr.includes(match)) return null
        if (!listing?.video_url) return null
        return { jobId: job.id as string }
      } catch {
        return null
      }
    })
  )

  const candidates = enriched.filter(Boolean) as NonNullable<(typeof enriched)[number]>[]
  if (!candidates.length) return Response.json(null)

  candidates.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  const hero = candidates[0]

  return Response.json(hero)
}
