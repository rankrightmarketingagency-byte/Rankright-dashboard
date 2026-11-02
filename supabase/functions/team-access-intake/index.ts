import { createClient } from 'npm:@supabase/supabase-js@2'

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}
const ownerEmail = 'rank.right.marketing.agency@gmail.com'
const requestHits = new Map<string, { count: number; resetAt: number }>()
const secrets = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}')
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const adminKey = secrets.default ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const admin = createClient(supabaseUrl, adminKey, { auth: { autoRefreshToken: false, persistSession: false } })

function reply(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers })
}

function fail(message: string, code: string, status = 400) {
  return reply({ ok: false, message, code }, status)
}

function rateLimited(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const now = Date.now()
  const item = requestHits.get(ip)
  if (!item || item.resetAt <= now) {
    requestHits.set(ip, { count: 1, resetAt: now + 10 * 60 * 1000 })
    return false
  }
  item.count += 1
  return item.count > 6
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers })
  if (req.method !== 'POST') return fail('Use POST for this action.', 'METHOD_NOT_ALLOWED', 405)

  try {
    const body = await req.json()
    if (body.action !== 'request') return fail('Unknown access action.', 'UNKNOWN_ACTION')
    if (rateLimited(req)) return fail('Please wait a few minutes before trying again.', 'RATE_LIMITED', 429)
    // Honeypot: quietly accept the submission without storing it.
    if (String(body.company_url ?? '').trim()) return reply({ ok: true, status: 'pending' })

    const fullName = String(body.full_name ?? '').trim().slice(0, 120)
    const email = String(body.email ?? '').trim().toLowerCase()
    if (fullName.length < 1 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) {
      return fail('Enter a valid name and work email.', 'INVALID_REQUEST')
    }
    if (email === ownerEmail) return fail('Use the owner sign-in setup for this email.', 'OWNER_EMAIL')

    const { data: existing, error: lookupError } = await admin
      .from('workspace_access_requests').select('id,status').eq('email', email).maybeSingle()
    if (lookupError) throw lookupError
    if (existing?.status === 'pending') return reply({ ok: true, status: 'pending' })
    if (existing?.status === 'approved') return reply({ ok: true, status: 'approved' })
    if (existing) {
      const { error } = await admin.from('workspace_access_requests').update({
        full_name: fullName, status: 'pending', created_at: new Date().toISOString(), reviewed_at: null, reviewed_by: null,
      }).eq('id', existing.id)
      if (error) throw error
    } else {
      const { error } = await admin.from('workspace_access_requests').insert({ full_name: fullName, email })
      // A concurrent duplicate request is already safely represented by the unique email row.
      if (error && error.code !== '23505') throw error
    }
    return reply({ ok: true, status: 'pending' })
  } catch (error) {
    console.error('team-access-intake failed', error)
    return fail('The access request could not be completed. Please try again.', 'REQUEST_FAILED', 500)
  }
})

