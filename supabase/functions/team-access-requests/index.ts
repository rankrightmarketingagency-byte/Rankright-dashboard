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

async function signedInUser(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers })
  if (req.method !== 'POST') return fail('Use POST for this action.', 'METHOD_NOT_ALLOWED', 405)

  try {
    const body = await req.json()
    if (body.action === 'request') {
      if (rateLimited(req)) return fail('Please wait a few minutes before trying again.', 'RATE_LIMITED', 429)
      // Honeypot: quietly accept the submission without storing it.
      if (String(body.company_url ?? '').trim()) return reply({ ok: true, status: 'pending' })
      const user = await signedInUser(req)
      if (!user) return fail('Sign in with your Rank Right account before requesting access.', 'AUTH_REQUIRED', 401)
      const fullName = String(body.full_name ?? '').trim().slice(0, 120)
      const email = String(user.email ?? '').trim().toLowerCase()
      const submittedEmail = String(body.email ?? '').trim().toLowerCase()
      if (fullName.length < 1 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) {
        return fail('Enter a valid name and work email.', 'INVALID_REQUEST')
      }
      if (!submittedEmail || submittedEmail !== email) return fail('Sign in with the same email address used for the request.', 'EMAIL_MISMATCH', 403)
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
    }

    if (body.action === 'complete') {
      const user = await signedInUser(req)
      if (!user) return fail('Sign in again to complete team access.', 'AUTH_REQUIRED', 401)
      if (!user.email_confirmed_at) return fail('Confirm this email before signing in.', 'EMAIL_NOT_CONFIRMED', 403)
      const email = String(user.email ?? '').toLowerCase()
      const { data: accessRequest, error: requestError } = await admin
        .from('workspace_access_requests').select('full_name,status').eq('email', email).maybeSingle()
      if (requestError) throw requestError
      if (!accessRequest) return fail('No team request was found for this email.', 'NO_ACCESS_REQUEST', 403)
      if (accessRequest.status === 'rejected') return fail('The owner declined this access request.', 'ACCESS_REJECTED', 403)
      if (accessRequest.status !== 'approved') return fail('Your access request is awaiting owner approval.', 'ACCESS_PENDING', 403)

      const { data: current, error: memberError } = await admin.from('workspace_members')
        .select('id,role,approval_status,account_status,email').eq('user_id', user.id).maybeSingle()
      if (memberError) throw memberError
      if (current?.role === 'owner') return reply({ ok: true, role: 'owner' })
      if (current && (current.email.toLowerCase() !== email || current.account_status !== 'active')) {
        return fail('This account is inactive. Contact the Rank Right owner.', 'ACCOUNT_INACTIVE', 403)
      }
      const member = {
        user_id: user.id,
        full_name: accessRequest.full_name,
        email,
        role: 'team_member',
        approval_status: 'approved',
        account_status: 'active',
        approved_at: new Date().toISOString(),
      }
      const result = current
        ? await admin.from('workspace_members').update(member).eq('id', current.id).select('role,approval_status,account_status').single()
        : await admin.from('workspace_members').insert(member).select('role,approval_status,account_status').single()
      if (result.error) throw result.error
      return reply({ ok: true, membership: result.data })
    }

    if (body.action === 'claim_owner') {
      const user = await signedInUser(req)
      if (!user) return fail('Sign in again to finish owner setup.', 'AUTH_REQUIRED', 401)
      if (String(user.email ?? '').toLowerCase() !== ownerEmail || !user.email_confirmed_at) {
        return fail('Verify the Rank Right owner Gmail before continuing.', 'OWNER_EMAIL_NOT_VERIFIED', 403)
      }
      const { data: owners, error: ownerError } = await admin.from('workspace_members')
        .select('id,user_id,full_name,email').eq('role', 'owner').eq('approval_status', 'approved').eq('account_status', 'active')
      if (ownerError) throw ownerError
      const current = owners?.find((row) => row.user_id === user.id)
      if (current) return reply({ ok: true, role: 'owner' })
      if (owners?.length !== 1) return fail('Owner setup stopped because the project does not have exactly one active owner.', 'OWNER_COUNT', 409)

      const oldOwner = owners[0]
      const { data: existing, error: existingError } = await admin.from('workspace_members')
        .select('id').eq('user_id', user.id).maybeSingle()
      if (existingError) throw existingError
      const { error: demoteError } = await admin.from('workspace_members').update({
        role: 'team_member', approval_status: 'rejected', account_status: 'inactive', approved_at: null,
      }).eq('id', oldOwner.id)
      if (demoteError) throw demoteError

      const member = {
        user_id: user.id,
        full_name: String(user.user_metadata?.full_name ?? '').trim().slice(0, 120) || 'Rank Right Owner',
        email: ownerEmail,
        role: 'owner',
        approval_status: 'approved',
        account_status: 'active',
        approved_at: new Date().toISOString(),
      }
      const result = existing
        ? await admin.from('workspace_members').update(member).eq('id', existing.id).select('role').single()
        : await admin.from('workspace_members').insert(member).select('role').single()
      if (result.error) {
        await admin.from('workspace_members').update({
          role: 'owner', approval_status: 'approved', account_status: 'active', approved_at: new Date().toISOString(),
        }).eq('id', oldOwner.id)
        throw result.error
      }
      return reply({ ok: true, role: 'owner' })
    }

    return fail('Unknown access action.', 'UNKNOWN_ACTION')
  } catch (error) {
    console.error('team-access-requests failed', error)
    return fail('The access request could not be completed. Please try again.', 'REQUEST_FAILED', 500)
  }
})

