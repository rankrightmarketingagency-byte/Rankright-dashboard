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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers })
  if (req.method !== 'POST') return fail('Use POST for this request.', 'METHOD_NOT_ALLOWED', 405)

  try {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (!token) return fail('Sign in to view team totals.', 'AUTH_REQUIRED', 401)
    const { data: authData, error: authError } = await admin.auth.getUser(token)
    const user = authData.user
    if (authError || !user) return fail('Sign in again to view team totals.', 'AUTH_REQUIRED', 401)

    const { data: membership, error: memberError } = await admin.from('workspace_members')
      .select('role,approval_status,account_status')
      .eq('user_id', user.id).maybeSingle()
    if (memberError) throw memberError
    if (!membership || membership.approval_status !== 'approved' || membership.account_status !== 'active') {
      return fail('An active workspace membership is required.', 'ACCOUNT_INACTIVE', 403)
    }

    const [activeResult, joinedResult, activeTeamResult] = await Promise.all([
      admin.from('workspace_members').select('user_id', { count: 'exact', head: true })
        .eq('approval_status', 'approved').eq('account_status', 'active'),
      admin.from('workspace_members').select('user_id', { count: 'exact', head: true })
        .eq('role', 'team_member').eq('approval_status', 'approved'),
      admin.from('workspace_members').select('full_name')
        .eq('role', 'team_member').eq('approval_status', 'approved').eq('account_status', 'active')
        .order('full_name', { ascending: true }),
    ])
    if (activeResult.error) throw activeResult.error
    if (joinedResult.error) throw joinedResult.error
    if (activeTeamResult.error) throw activeTeamResult.error

    return reply({
      ok: true,
      active_members: activeResult.count ?? 0,
      total_members: joinedResult.count ?? 0,
      active_team_members: (activeTeamResult.data ?? []).map((row) => row.full_name),
    })
  } catch (error) {
    console.error('workspace-team-summary failed', error)
    return fail('Team totals could not be loaded.', 'SUMMARY_FAILED', 500)
  }
})

