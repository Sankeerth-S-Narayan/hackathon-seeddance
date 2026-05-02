import type { Listing } from './apify'

export async function generateSeedancePrompt(listing: Listing, imageCount: number): Promise<string> {
  const bullets = [
    listing.price ? `$${listing.price.toLocaleString()}` : null,
    `${listing.beds} Bed · ${listing.baths} Bath`,
    listing.sqft ? `${listing.sqft.toLocaleString()} sqft` : null,
    ...listing.highlights.slice(0, 3),
  ].filter(Boolean).join(' · ')

  const resp = await fetch(`${process.env.EASYROUTER_BASE}/v1/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.EASYROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      system: 'You are a luxury real estate video director writing Seedance 2.0 image-to-video prompts. Return only the prompt string — no explanation, no markdown, no quotes.',
      messages: [{
        role: 'user',
        content: `Write a Seedance 2.0 multi-image-to-video prompt for a 14-second luxury real estate reel using ${imageCount} reference images.

The prompt should:
- Structure the 14 seconds across all ${imageCount} images — roughly 3-4 seconds each — with a distinct cinematic camera move for each image (e.g. slow dolly forward on @Image1, gentle pan on @Image2, smooth push-in on @Image3, aerial pull-back on @Image4)
- Reference each image as @Image1, @Image2 … @Image${imageCount} in order
- Include smooth dissolve or cut transitions between each image
- Show bold white on-screen text overlay: "${bullets}"
- Include a warm, professional voiceover narration describing the home in 2-3 sentences timed to the full 14 seconds
- Use warm golden-hour lighting, luxury real estate marketing style, 16:9, cinematic color grading

Property: ${listing.address}
Features: ${listing.highlights.slice(0, 5).join(', ')}
Description: ${listing.description?.slice(0, 200)}

Write only the prompt string now — no explanation, no markdown, no quotes:`,
      }],
    }),
  })

  if (!resp.ok) throw new Error(`EasyRouter error: ${resp.status} ${await resp.text()}`)
  const data = await resp.json()
  return data.content[0].text.trim()
}
