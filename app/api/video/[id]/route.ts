import { getJob, getListing } from '@/lib/butterbase'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const job = await getJob(id)
    const listing = job.listing_id ? await getListing(job.listing_id) : null
    const videoUrl = listing?.video_url
    if (!videoUrl) return new Response('Video not ready', { status: 404 })

    const upstream = await fetch(videoUrl)
    if (!upstream.ok) return new Response('Upstream fetch failed', { status: 502 })

    return new Response(upstream.body, {
      headers: {
        'Content-Type': 'video/mp4',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (e: any) {
    return new Response(e.message, { status: 500 })
  }
}
