import { getJob, getListing, updateJob, updateListing } from '@/lib/butterbase'
import { checkAtlasOnce } from '@/lib/atlascloud'

export const maxDuration = 15

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const job = await getJob(id)
  const listing = job.listing_id ? await getListing(job.listing_id) : null

  // When in generating_video state, advance Atlas progress on each client poll
  // so no long-running loop is needed in generate route
  if (job.status === 'generating_video' && job.atlas_id) {
    try {
      const videoUrl = await checkAtlasOnce(job.atlas_id)
      if (videoUrl) {
        await updateListing(job.listing_id, { video_url: videoUrl })
        await updateJob(id, { status: 'succeeded' })
        return Response.json({
          status:      'succeeded',
          video_url:   videoUrl,
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
    } catch (e: any) {
      // Atlas reported a hard failure
      await updateJob(id, { status: 'failed', error: `Atlas: ${e.message}` }).catch(() => {})
      return Response.json({ status: 'failed', error: `Atlas: ${e.message}` })
    }
  }

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
