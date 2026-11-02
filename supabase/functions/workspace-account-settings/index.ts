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
    const user = await signedInUser(req)
    if (!user) return fail('Sign in again before changing account settings.', 'AUTH_REQUIRED', 401)
    const body = await req.json()
    if (body.action !== 'update_name') return fail('Unknown account settings action.', 'UNKNOWN_ACTION')

    const fullName = String(body.full_name ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
    if (!fullName || fullName.length > 120) return fail('Enter a name between 1 and 120 characters.', 'INVALID_NAME')

    const { data: member, error: lookupError } = await admin.from('workspace_members')
      .select('id,role,approval_status,account_status')
      .eq('user_id', user.id).maybeSingle()
    if (lookupError) throw lookupError
    if (!member || member.approval_status !== 'approved' || member.account_status !== 'active') {
      return fail('An active workspace account is required.', 'ACCOUNT_INACTIVE', 403)
    }

    const { data: updated, error: updateError } = await admin.from('workspace_members')
      .update({ full_name: fullName })
      .eq('id', member.id)
      .select('full_name')
      .single()
    if (updateError) throw updateError
    return reply({ ok: true, full_name: updated.full_name })
  } catch (error) {
    console.error('workspace-account-settings failed', error)
    return fail('The account setting could not be saved. Please try again.', 'UPDATE_FAILED', 500)
  }
})

