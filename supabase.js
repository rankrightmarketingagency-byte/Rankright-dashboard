import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';

const SESSION_KEY = 'rank-right-dashboard-session-v1';
const REQUEST_TIMEOUT_MS = 12000;

async function requestWithTimeout(url, options, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error && error.name === 'AbortError') {
      throw new Error('The request timed out. Check your connection and try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function readSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); }
  catch { return null; }
}
function writeSession(session) {
  if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else sessionStorage.removeItem(SESSION_KEY);
}
async function parseResponse(response) {
  if (response.status === 204 || response.status === 205) return null;
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}
async function authFetch(path, options) {
  const response = await requestWithTimeout(SUPABASE_URL + '/auth/v1/' + path, {
    ...options,
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json', ...(options && options.headers || {}) }
  });
  const payload = await parseResponse(response);
  if (!response.ok) throw new Error((payload && (payload.msg || payload.message || payload.error_description)) || 'Authentication request failed.');
  return payload;
}
async function accessFunction(body, functionName = 'team-access-requests') {
  const session = await refreshIfNeeded();
  const headers = { apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' };
  if (session && session.access_token) headers.Authorization = 'Bearer ' + session.access_token;
  const response = await requestWithTimeout(SUPABASE_URL + '/functions/v1/' + functionName, {
    method: 'POST', headers, body: JSON.stringify(body)
  });
  const payload = await parseResponse(response);
  if (!response.ok || payload && payload.ok === false) {
    const error = new Error((payload && payload.message) || 'Unable to complete the access request.');
    error.code = payload && payload.code;
    error.status = response.status;
    throw error;
  }
  return payload || {};
}
async function refreshIfNeeded() {
  let session = readSession();
  if (!session) return null;
  if (session.expires_at && Date.now() < (session.expires_at - 45) * 1000) return session;
  if (!session.refresh_token) { writeSession(null); return null; }
  try {
    const refreshed = await authFetch('token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: session.refresh_token }) });
    session = { ...refreshed, expires_at: Math.floor(Date.now() / 1000) + Number(refreshed.expires_in || 3600) };
    writeSession(session);
    return session;
  } catch {
    writeSession(null);
    return null;
  }
}
async function restFetch(path, options = {}, retry = true) {
  const session = await refreshIfNeeded();
  const headers = {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: 'Bearer ' + ((session && session.access_token) || SUPABASE_PUBLISHABLE_KEY),
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {})
  };
  const response = await requestWithTimeout(SUPABASE_URL + '/rest/v1/' + path, { ...options, headers });
  if (response.status === 401 && retry && session && session.refresh_token) {
    writeSession({ ...session, expires_at: 0 });
    await refreshIfNeeded();
    return restFetch(path, options, false);
  }
  const payload = await parseResponse(response);
  if (!response.ok) {
    const error = new Error((payload && (payload.message || payload.details || payload.hint)) || 'Database request failed.');
    error.code = payload && payload.code;
    error.status = response.status;
    throw error;
  }
  return { data: payload, response };
}
async function storageFetch(path, options = {}) {
  const session = await refreshIfNeeded();
  if (!session || !session.access_token) throw new Error('Sign in again before accessing workspace files.');
  const response = await requestWithTimeout(SUPABASE_URL + '/storage/v1/' + path, {
    ...options,
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: 'Bearer ' + session.access_token,
      ...(options.headers || {})
    }
  }, options.method === 'POST' || options.method === 'DELETE' ? 120000 : 30000);
  if (!response.ok) {
    const payload = await parseResponse(response);
    throw new Error((payload && (payload.message || payload.error || payload.error_description)) || 'File storage request failed.');
  }
  return response;
}
export const Auth = {
  getSession: refreshIfNeeded,
  async requestPasswordReset(email, redirectTo) {
    const path = 'recover?redirect_to=' + encodeURIComponent(redirectTo);
    return authFetch(path, { method: 'POST', body: JSON.stringify({ email: String(email).trim().toLowerCase() }) });
  },
  async updatePassword(accessToken, password) {
    return authFetch('user', { method: 'PUT', headers: { Authorization: 'Bearer ' + accessToken }, body: JSON.stringify({ password }) });
  },
  async changePassword(password) {
    const session = await refreshIfNeeded();
    if (!session) throw new Error('Your session expired. Sign in again before changing your password.');
    return this.updatePassword(session.access_token, password);
  },
  async signIn(email, password) {
    const payload = await authFetch('token?grant_type=password', { method: 'POST', body: JSON.stringify({ email, password }) });
    const session = { ...payload, expires_at: Math.floor(Date.now() / 1000) + Number(payload.expires_in || 3600) };
    writeSession(session);
    return session;
  },
  async signUp(email, password, fullName) {
    const payload = await authFetch('signup', { method: 'POST', body: JSON.stringify({ email, password, data: { full_name: fullName } }) });
    if (payload && payload.access_token) {
      writeSession({ ...payload, expires_at: Math.floor(Date.now() / 1000) + Number(payload.expires_in || 3600) });
    }
    return payload;
  },
  async submitAccessRequest(email, fullName, companyUrl = '') {
    return accessFunction({ action: 'request', email: String(email).trim().toLowerCase(), full_name: String(fullName).trim(), company_url: companyUrl }, 'team-access-intake');
  },
  async deleteEnquiry(id) {
    return accessFunction({ action: 'delete', id: String(id) }, 'owner-delete-enquiry');
  },
  async deleteWorkspaceRecord(action, id) {
    return accessFunction({ action, id: String(id) }, 'workspace-delete-record');
  },
  async updateProfileName(fullName) {
    return accessFunction({ action: 'update_name', full_name: String(fullName).trim() }, 'workspace-account-settings');
  },
  async teamSummary() {
    return accessFunction({ action: 'summary' }, 'workspace-team-summary');
  },
  async completeApprovedAccess() {
    const result = await accessFunction({ action: 'complete' });
    return result.membership;
  },
  async claimOwnerAccount() {
    return accessFunction({ action: 'claim_owner' });
  },
  async currentUser() {
    const session = await refreshIfNeeded();
    if (!session) return null;
    return authFetch('user', { method: 'GET', headers: { Authorization: 'Bearer ' + session.access_token } });
  },
  async signOut() {
    const session = await refreshIfNeeded();
    try {
      if (session) await authFetch('logout', { method: 'POST', headers: { Authorization: 'Bearer ' + session.access_token } });
    } finally { writeSession(null); }
  },
  async membership(userId) {
    const query = 'workspace_members?select=user_id,full_name,email,role,approval_status,account_status,created_at&user_id=eq.' + encodeURIComponent(userId) + '&limit=1';
    const result = await restFetch(query);
    return result.data && result.data[0] || null;
  },
};
export const DB = {
  async select(table, params = {}) {
    const query = new URLSearchParams({ select: '*', ...params }).toString();
    const result = await restFetch(encodeURIComponent(table) + '?' + query);
    return result.data || [];
  },
  async insert(table, row) {
    const result = await restFetch(encodeURIComponent(table), { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(row) });
    return result.data || [];
  },
  async update(table, filters, patch) {
    const query = new URLSearchParams(filters).toString();
    const result = await restFetch(encodeURIComponent(table) + '?' + query, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(patch) });
    return result.data || [];
  },
  async remove(table, filters) {
    const query = new URLSearchParams(filters).toString();
    const result = await restFetch(encodeURIComponent(table) + '?' + query, { method: 'DELETE', headers: { Prefer: 'return=representation' } });
    return result.data || [];
  },
  async count(table, filters = {}) {
    const query = new URLSearchParams({ select: 'id', ...filters }).toString();
    const result = await restFetch(encodeURIComponent(table) + '?' + query, { method: 'HEAD', headers: { Prefer: 'count=exact', Range: '0-0' } });
    const range = result.response.headers.get('content-range') || '*/0';
    return Number(range.split('/').pop()) || 0;
  }
};
export const WorkspaceFiles = {
  async upload(projectId, userId, file) {
    const cleanName = String(file.name || 'upload').replace(/[\/:*?"<>|\u0000-\u001f]/g, '_').replace(/\\/g, '_').replace(/\s+/g, ' ').slice(0, 180) || 'upload';
    const path = projectId + '/' + userId + '/' + crypto.randomUUID() + '-' + cleanName;
    const segments = path.split('/').map(encodeURIComponent).join('/');
    await storageFetch('object/team-deliverables/' + segments, {
      method: 'POST',
      headers: { 'Content-Type': file.type || 'application/octet-stream', 'x-upsert': 'false' },
      body: file
    });
    return { name: cleanName, path, size: file.size, type: file.type || 'application/octet-stream' };
  },
  async download(path, fileName) {
    const segments = String(path).split('/').map(encodeURIComponent).join('/');
    const response = await storageFetch('object/authenticated/team-deliverables/' + segments, { method: 'GET' });
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName || String(path).split('/').pop() || 'workspace-file';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  },
  async remove(paths) {
    if (!paths || !paths.length) return;
    await storageFetch('object/team-deliverables', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefixes: paths })
    });
  }
};
