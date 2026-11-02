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

async function activeMember(userId: string) {
  const { data, error } = await admin.from('workspace_members')
    .select('user_id,role,approval_status,account_status')
    .eq('user_id', userId).maybeSingle()
  if (error) throw error
  return data && data.approval_status === 'approved' && data.account_status === 'active' ? data : null
}

async function deleteById(table: string, id: string) {
  const { data, error } = await admin.from(table).delete().eq('id', id).select('id').maybeSingle()
  if (error) throw error
  return data?.id || null
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers })
  if (req.method !== 'POST') return fail('Use POST for this action.', 'METHOD_NOT_ALLOWED', 405)

  try {
    const user = await signedInUser(req)
    if (!user) return fail('Sign in again before deleting this record.', 'AUTH_REQUIRED', 401)
    const member = await activeMember(user.id)
    if (!member) return fail('An active workspace account is required.', 'ACCOUNT_INACTIVE', 403)

    const body = await req.json()
    const id = String(body.id ?? '').trim()
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      return fail('Select a valid record and try again.', 'INVALID_ID')
    }

    if (body.action === 'delete_access_request') {
      if (member.role !== 'owner') return fail('Only the owner can delete access requests.', 'OWNER_REQUIRED', 403)
      const deletedId = await deleteById('workspace_access_requests', id)
      if (!deletedId) return fail('This access request was already removed or is no longer available.', 'NOT_FOUND', 404)
      return reply({ ok: true, deleted_id: deletedId })
    }

    if (body.action === 'delete_notification') {
      const { data: notice, error } = await admin.from('notifications').select('id,user_id').eq('id', id).maybeSingle()
      if (error) throw error
      if (!notice) return fail('This notification is no longer available.', 'NOT_FOUND', 404)
      if (member.role !== 'owner' && notice.user_id !== user.id) return fail('You can only delete your own notification.', 'FORBIDDEN', 403)
      const deletedId = await deleteById('notifications', id)
      if (!deletedId) return fail('This notification was already removed.', 'NOT_FOUND', 404)
      return reply({ ok: true, deleted_id: deletedId })
    }

    if (body.action === 'delete_own_submission') {
      if (member.role !== 'team_member') return fail('This action is only for team member submissions.', 'TEAM_MEMBER_REQUIRED', 403)
      const { data: submission, error } = await admin.from('project_submissions')
        .select('id,submitted_by,status').eq('id', id).maybeSingle()
      if (error) throw error
      if (!submission || submission.submitted_by !== user.id) return fail('You can only delete your own submission.', 'FORBIDDEN', 403)
      if (submission.status !== 'pending_review') return fail('Only a pending submission can be deleted.', 'SUBMISSION_REVIEWED', 409)

      const [reviews, approvals] = await Promise.all([
        admin.from('project_reviews').select('id').eq('submission_id', id).limit(1),
        admin.from('client_approval_requests').select('id').eq('submission_id', id).limit(1),
      ])
      if (reviews.error) throw reviews.error
      if (approvals.error) throw approvals.error
      if (reviews.data?.length || approvals.data?.length) return fail('This submission has review or approval history and cannot be deleted.', 'HAS_REVIEW_HISTORY', 409)

      const deletedId = await deleteById('project_submissions', id)
      if (!deletedId) return fail('This submission was already removed.', 'NOT_FOUND', 404)
      return reply({ ok: true, deleted_id: deletedId })
    }

    return fail('Unknown delete action.', 'UNKNOWN_ACTION')
  } catch (error) {
    console.error('workspace-delete-record failed', error)
    return fail('The record could not be deleted. Refresh and try again.', 'DELETE_FAILED', 500)
  }
})

