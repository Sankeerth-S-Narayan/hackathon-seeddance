const BB_KEY = 'bb_sk_6ef62561a119c9a635c07c9d9dc3ef6fda2c8077'
const BB_BASE = 'https://api.butterbase.ai/v1/app_qwo14r7s847j'

const headers = { 'Authorization': `Bearer ${BB_KEY}`, 'Content-Type': 'application/json' }

async function applySchema() {
  const schema = {
    dry_run: false,
    name: 'initial schema',
    schema: {
      tables: {
        _idempotency_keys: {
          columns: {
            key:          { type: 'text',        primaryKey: true },
            scope:        { type: 'text',        primaryKey: true, default: 'default' },
            processed_at: { type: 'timestamptz', nullable: false,  default: 'now()' },
            expires_at:   { type: 'timestamptz' },
          },
        },
        listings: {
          columns: {
            id:              { type: 'uuid',        primaryKey: true, default: 'gen_random_uuid()' },
            url:             { type: 'text',        nullable: false },
            address:         { type: 'text' },
            price:           { type: 'bigint' },
            beds:            { type: 'integer' },
            baths:           { type: 'real' },
            sqft:            { type: 'integer' },
            lot_size:        { type: 'text' },
            year_built:      { type: 'integer' },
            description:     { type: 'text' },
            highlights:      { type: 'jsonb' },
            image_object_ids:{ type: 'jsonb' },
            seedance_prompt: { type: 'text' },
            video_url:       { type: 'text' },
            created_at:      { type: 'timestamptz', default: 'now()' },
          },
        },
        jobs: {
          columns: {
            id:         { type: 'uuid', primaryKey: true, default: 'gen_random_uuid()' },
            listing_id: { type: 'uuid', references: { table: 'listings', column: 'id', onDelete: 'CASCADE' } },
            atlas_id:   { type: 'text' },
            status:     { type: 'text', nullable: false },
            error:      { type: 'text' },
            created_at: { type: 'timestamptz', default: 'now()' },
            updated_at: { type: 'timestamptz', default: 'now()' },
          },
          indexes: {
            idx_jobs_listing: { columns: ['listing_id'] },
            idx_jobs_status:  { columns: ['status'] },
          },
        },
      },
    },
  }

  console.log('Applying schema...')
  const res = await fetch(`${BB_BASE}/schema/apply`, {
    method: 'POST', headers, body: JSON.stringify(schema),
  })
  const data = await res.json()
  if (!res.ok) { console.error('Schema failed:', JSON.stringify(data, null, 2)); process.exit(1) }
  console.log('Schema applied:', JSON.stringify(data, null, 2))
}

async function enableStorage() {
  console.log('\nEnabling public storage...')
  const res = await fetch(`${BB_BASE}/config/storage`, {
    method: 'PATCH', headers, body: JSON.stringify({ publicReadEnabled: true }),
  })
  const data = await res.json()
  if (!res.ok) { console.error('Storage config failed:', JSON.stringify(data, null, 2)); process.exit(1) }
  console.log('Storage enabled:', JSON.stringify(data, null, 2))
}

async function testInsert() {
  console.log('\nTesting insert into listings...')
  const res = await fetch(`${BB_BASE}/listings`, {
    method: 'POST', headers,
    body: JSON.stringify({ url: 'https://test.zillow.com', address: 'Test', status: 'test' }),
  })
  const data = await res.json()
  console.log('Insert result:', JSON.stringify(data, null, 2))
}

await applySchema()
await enableStorage()
await testInsert()
