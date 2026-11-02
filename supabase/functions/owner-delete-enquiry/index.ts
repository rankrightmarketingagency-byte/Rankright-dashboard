import { createClient } from 'npm:@supabase/supabase-js@2'

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}
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
    if (body.action !== 'delete') return fail('Unknown enquiry action.', 'UNKNOWN_ACTION')

    const user = await signedInUser(req)
    if (!user) return fail('Sign in again before deleting an enquiry.', 'AUTH_REQUIRED', 401)

    const { data: owner, error: ownerError } = await admin.from('workspace_members')
      .select('id')
      .eq('user_id', user.id)
      .eq('role', 'owner')
      .eq('approval_status', 'approved')
      .eq('account_status', 'active')
      .maybeSingle()
    if (ownerError) throw ownerError
    if (!owner) return fail('Only an active Rank Right owner can delete website enquiries.', 'OWNER_REQUIRED', 403)

    const id = String(body.id ?? '').trim()
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      return fail('Select a valid enquiry and try again.', 'INVALID_ID')
    }

    const { data: deleted, error: deleteError } = await admin.from('contact_enquiries')
      .delete().eq('id', id).select('id').maybeSingle()
    if (deleteError) throw deleteError
    if (!deleted) return fail('This enquiry was already removed or is no longer available.', 'NOT_FOUND', 404)
    return reply({ ok: true, deleted_id: deleted.id })
  } catch (error) {
    console.error('owner-delete-enquiry failed', error)
    return fail('The enquiry could not be deleted. Please refresh and try again.', 'DELETE_FAILED', 500)
  }
})

