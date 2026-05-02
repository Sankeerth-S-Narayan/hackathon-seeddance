import { ApifyClient } from 'apify-client'

export interface Listing {
  address: string
  price: number
  beds: number
  baths: number
  sqft: number
  lotSize: string
  yearBuilt: number
  description: string
  highlights: string[]
  hasPool: boolean
  hasView: boolean
  hasSpa: boolean
  condition: string
  images: string[]  // Zillow CDN URLs — hotlink protected, must re-host
}

export async function scrapeZillow(url: string): Promise<Listing> {
  const client = new ApifyClient({ token: process.env.APIFY_API_KEY })
  const run = await client.actor('maxcopell/zillow-detail-scraper').call({
    propertyStatus: 'FOR_SALE',
    startUrls: [{ url }],
  })
  const { items } = await client.dataset(run.defaultDatasetId).listItems()
  if (!items.length) throw new Error('No listing data returned from Apify')
  const l = items[0] as any

  // Photos: try multiple fields the actor may use
  const rawPhotos =
    l.responsivePhotos ??
    l.photos ??
    l.originalPhotos ??
    []
  const images = rawPhotos
    .slice(0, 4)
    .map((p: any) => p?.url ?? p?.mixedSources?.jpeg?.[0]?.url ?? p?.src)
    .filter(Boolean)

  const highlights = l.homeInsights?.[0]?.insights?.[0]?.phrases ?? []

  // Price: try several locations the actor may populate
  const price =
    l.price ||
    l.unformattedPrice ||
    l.listPriceLow ||
    l.priceHistory?.[0]?.price ||
    0

  // Sqft: prefer numeric field; fall back to parsing the resoFacts string
  let sqft = l.livingArea ?? l.livingAreaValue ?? 0
  if (!sqft && l.resoFacts?.livingArea) {
    sqft = parseInt(String(l.resoFacts.livingArea).replace(/[^0-9]/g, ''), 10) || 0
  }

  return {
    address:     `${l.address?.streetAddress}, ${l.address?.city}, ${l.address?.state} ${l.address?.zipcode}`,
    price,
    beds:        l.bedrooms  ?? l.resoFacts?.bedrooms  ?? 0,
    baths:       l.bathrooms ?? l.resoFacts?.bathrooms ?? 0,
    sqft,
    lotSize:     l.resoFacts?.lotSize ?? l.resoFacts?.lotSizeDimensions ?? '',
    yearBuilt:   l.yearBuilt ?? l.resoFacts?.yearBuilt ?? 0,
    description: l.description ?? '',
    highlights,
    hasPool:     l.resoFacts?.hasPrivatePool ?? false,
    hasView:     l.resoFacts?.hasView ?? false,
    hasSpa:      l.resoFacts?.hasSpa ?? false,
    condition:   l.resoFacts?.propertyCondition ?? '',
    images,
  }
}
