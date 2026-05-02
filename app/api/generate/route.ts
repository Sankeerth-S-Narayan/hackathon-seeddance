import { scrapeZillow } from '@/lib/apify'
import { createListing, createJob, updateJob, updateListing } from '@/lib/butterbase'
import { uploadImageFromUrl } from '@/lib/upload'
import { generateSeedancePrompt } from '@/lib/easyrouter'
import { submitVideoJob } from '@/lib/atlascloud'

export const maxDuration = 60

export async function POST(req: Request) {
  const { url } = await req.json()
  if (!url?.includes('zillow.com')) {
    return Response.json({ error: 'Please provide a valid Zillow URL' }, { status: 400 })
  }

  // Step 1: Scrape listing (~15-25s)
  let listing
  try {
    listing = await scrapeZillow(url)
  } catch (e: any) {
    return Response.json({ error: `Scraping failed: ${e.message}` }, { status: 500 })
  }

  // Step 2: Create DB rows
  const listingId = await createListing(listing, url)
  const jobId = await createJob(listingId)

  try {
    await updateJob(jobId, { status: 'uploading' })

    // Step 3: Upload images in PARALLEL to keep total time within 60s
    if (!listing.images.length) throw new Error('No photos found for this listing')
    const publicUrls = await Promise.all(
      listing.images.map((img, i) => uploadImageFromUrl(img, `${jobId}_${i}.jpg`))
    )

    await updateJob(jobId, { status: 'generating_prompt' })

    // Step 4: Generate Seedance prompt via EasyRouter/Claude (~3-5s)
    const prompt = await generateSeedancePrompt(listing, publicUrls.length)
    await updateListing(listingId, { seedance_prompt: prompt })

    await updateJob(jobId, { status: 'generating_video' })

    // Step 5: Submit to Atlas (no polling — status route handles that)
    const atlasId = await submitVideoJob(publicUrls, prompt)
    await updateJob(jobId, { atlas_id: atlasId })

  } catch (e: any) {
    await updateJob(jobId, { status: 'failed', error: e.message }).catch(() => {})
  }

  return Response.json({ jobId, listingId, address: listing.address })
}
