import { scrapeZillow } from '@/lib/apify'
import { createListing, createJob, updateJob, updateListing } from '@/lib/butterbase'
import { uploadImageFromUrl } from '@/lib/upload'
import { generateSeedancePrompt } from '@/lib/easyrouter'
import { submitVideoJob, pollVideoJob } from '@/lib/atlascloud'

export const maxDuration = 300  // 5 min max for Butterbase/Vercel

export async function POST(req: Request) {
  const { url } = await req.json()
  if (!url?.includes('zillow.com')) {
    return Response.json({ error: 'Please provide a valid Zillow URL' }, { status: 400 })
  }

  // Step 1: Scrape listing
  let listing
  try {
    listing = await scrapeZillow(url)
  } catch (e: any) {
    return Response.json({ error: `Scraping failed: ${e.message}` }, { status: 500 })
  }

  // Step 2: Create DB rows
  const listingId = await createListing(listing, url)
  const jobId = await createJob(listingId)

  // Step 3: Kick off background pipeline (don't await)
  runPipeline(jobId, listingId, listing).catch(console.error)

  return Response.json({ jobId, listingId, address: listing.address })
}

async function runPipeline(
  jobId: string,
  listingId: string,
  listing: Awaited<ReturnType<typeof scrapeZillow>>
) {
  try {
    await updateJob(jobId, { status: 'uploading' })

    // Step 4: Re-host Zillow images via litterbox (hotlink protection bypass)
    const publicUrls: string[] = []
    for (let i = 0; i < listing.images.length; i++) {
      const url = await uploadImageFromUrl(listing.images[i], `${jobId}_${i}.jpg`)
      publicUrls.push(url)
    }

    await updateJob(jobId, { status: 'generating_prompt' })

    // Step 5: EasyRouter → Seedance prompt
    const prompt = await generateSeedancePrompt(listing, publicUrls.length)
    await updateListing(listingId, { seedance_prompt: prompt })
    await updateJob(jobId, { status: 'generating_video' })

    // Step 6: Atlas Cloud → video
    const atlasId = await submitVideoJob(publicUrls, prompt)
    await updateJob(jobId, { atlas_id: atlasId })

    // Step 7: Poll until done
    const videoUrl = await pollVideoJob(atlasId)
    await updateListing(listingId, { video_url: videoUrl })
    await updateJob(jobId, { status: 'succeeded' })

  } catch (e: any) {
    await updateJob(jobId, { status: 'failed', error: e.message })
  }
}
