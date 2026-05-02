import { getJob, getListing } from '@/lib/butterbase'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const job = await getJob(id)
  const listing = job.listing_id ? await getListing(job.listing_id) : null

  return Response.json({
    status:      job.status,
    error:       job.error,
    video_url:   listing?.video_url,
    address:     listing?.address,
    price:       listing?.price,
    beds:        listing?.beds,
    baths:       listing?.baths,
    sqft:        listing?.sqft,
    lot_size:    listing?.lot_size,
    year_built:  listing?.year_built,
    description: listing?.description,
    highlights:  listing?.highlights,
    url:         listing?.url,
  })
}
