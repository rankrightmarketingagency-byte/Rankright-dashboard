/* Generated from config.js, supabase.js, auth.js, and portal.js. Rebuild with node build-file-dashboard.mjs. */

(function(){
const SUPABASE_URL = 'https://bbcmzzjicuhlmulvcpgu.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_L_vYdel_8bykJQv49TNiLA_1JGaf0CC';
const PROJECT_REF = 'bbcmzzjicuhlmulvcpgu';

globalThis.RankRightConfig={SUPABASE_URL:SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY:SUPABASE_PUBLISHABLE_KEY,PROJECT_REF:PROJECT_REF};
})();

(function(){
const SUPABASE_URL=globalThis.RankRightConfig.SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY=globalThis.RankRightConfig.SUPABASE_PUBLISHABLE_KEY;

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
const Auth = {
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
const DB = {
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
const WorkspaceFiles = {
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

globalThis.RankRightAuth=Auth;
globalThis.RankRightDB=DB;
globalThis.RankRightFiles=WorkspaceFiles;
})();

if(document.querySelector('#auth-form')){(function(){
const Auth=globalThis.RankRightAuth;

const form = document.querySelector('#auth-form');
const recoveryForm = document.querySelector('#recovery-form');
const status = document.querySelector('#auth-status');
const submit = document.querySelector('#auth-submit');
const toggle = document.querySelector('#auth-mode-toggle');
const nameField = document.querySelector('#name-field');
const passwordLabel = document.querySelector('#password-field');
const emailField = form.querySelector('[name="email"]');
const passwordField = form.querySelector('[name="password"]');
const passwordVisibility = document.querySelector('#password-visibility');
const newPassword = document.querySelector('#new-password');
const confirmPassword = document.querySelector('#confirm-password');
const recoverySubmit = document.querySelector('#recovery-submit');
const introTitle = document.querySelector('.auth-intro h1');
const introCopy = document.querySelector('.auth-intro>p:last-child');
const ownerEmail = 'rank.right.marketing.agency@gmail.com';
const legacyTeamFlow = document.body.dataset.authFlow === 'team-legacy';
let mode = 'signin';
let recoveryAccessToken = null;

function setStatus(message, error = false) {
  status.textContent = message;
  status.classList.toggle('is-error', error);
}
function routeForRole(role) {
  return role === 'owner' ? 'owner.html' : 'team.html';
}
function setMode(nextMode) {
  mode = nextMode;
  const requestMode = mode === 'request';
  const approvedSignupMode = mode === 'approved-signup';
  nameField.hidden = false;
  nameField.querySelector('input').required = requestMode;
  passwordLabel.hidden = false;
  passwordField.required = !(legacyTeamFlow && requestMode);
  passwordField.autocomplete = (legacyTeamFlow && requestMode) || approvedSignupMode ? 'new-password' : 'current-password';
  passwordLabel.firstChild.textContent = requestMode && !legacyTeamFlow ? 'Workspace password' : 'Password';
  submit.innerHTML = requestMode ? 'Request access <span>→</span>' : approvedSignupMode ? 'Create team login <span>→</span>' : 'Sign in <span>→</span>';
  toggle.textContent = requestMode || approvedSignupMode ? 'Back to sign in' : 'Request team access';
  setStatus(requestMode && !legacyTeamFlow ? 'Use your Rank Right workspace password. Gmail account passwords are not checked or shared.' : '');
}
toggle.addEventListener('click', () => setMode(mode === 'signin' ? 'request' : 'signin'));
function bindPasswordVisibility(button, input) {
  button.addEventListener('click', () => {
    const visible = input.type === 'password';
    input.type = visible ? 'text' : 'password';
    button.textContent = visible ? 'Hide' : 'Show';
    button.setAttribute('aria-pressed', String(visible));
  });
}
bindPasswordVisibility(passwordVisibility, passwordField);
bindPasswordVisibility(document.querySelector('#new-password-visibility'), newPassword);
bindPasswordVisibility(document.querySelector('#confirm-password-visibility'), confirmPassword);

recoveryForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!recoveryAccessToken) {
    setStatus('This reset link is no longer available. Request a fresh password reset link.', true);
    return;
  }
  const password = newPassword.value;
  if (password !== confirmPassword.value) {
    setStatus('The passwords do not match.', true);
    confirmPassword.focus();
    return;
  }
  recoverySubmit.disabled = true;
  recoverySubmit.textContent = 'Updating password…';
  setStatus('Updating your password securely…');
  try {
    const updatedUser = await Auth.updatePassword(recoveryAccessToken, password);
    recoveryAccessToken = null;
    newPassword.value = '';
    confirmPassword.value = '';
    recoveryForm.hidden = true;
    form.hidden = false;
    toggle.hidden = false;
    setMode('signin');
    const email = String(updatedUser && updatedUser.email || '').trim().toLowerCase();
    if (!email) {
      setStatus('Password updated. Sign in with your new password.');
      return;
    }
    emailField.value = email;
    passwordField.value = password;
    setStatus('Password updated. Signing you in…');
    form.requestSubmit();
    passwordField.value = '';
  } catch (error) {
    setStatus(error.message || 'Unable to update the password. Request a fresh reset link and try again.', true);
  } finally {
    recoverySubmit.disabled = false;
    recoverySubmit.innerHTML = 'Update password <span>→</span>';
  }
});

function handleRecoveryRedirect() {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const accessToken = params.get('access_token');
  const error = params.get('error_description') || params.get('error');
  if (params.get('type') === 'recovery' && accessToken) {
    recoveryAccessToken = accessToken;
    window.history.replaceState(null, document.title, window.location.pathname + window.location.search);
    form.hidden = true;
    recoveryForm.hidden = false;
    toggle.hidden = true;
    introTitle.textContent = 'Set a new password';
    introCopy.textContent = 'Choose a new password for your Rank Right account.';
    setStatus('Enter and confirm your new password.');
  } else if (error) {
    window.history.replaceState(null, document.title, window.location.pathname + window.location.search);
    setStatus('That reset link is invalid or expired. Sign in and request a fresh password reset link.', true);
  }
}
handleRecoveryRedirect();

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const values = new FormData(form);
  const email = String(values.get('email') || '').trim().toLowerCase();
  const password = String(values.get('password') || '');
  const fullName = String(values.get('full_name') || '').trim();
  submit.disabled = true;
  submit.textContent = mode === 'request' ? 'Sending request…' : mode === 'approved-signup' ? 'Creating account…' : 'Signing in…';
  setStatus(mode === 'request' ? 'Sending your request to the owner…' : mode === 'approved-signup' ? 'Creating your approved team account…' : 'Checking your secure workspace access…');
  try {
    if (mode === 'request') {
      if (!legacyTeamFlow) {
        try {
          await Auth.signIn(email, password);
        } catch (error) {
          if (/invalid login credentials|invalid_credentials/i.test(String(error && error.message || ''))) {
            setStatus('Please enter your correct password.', true);
            passwordField.focus();
            return;
          }
          throw error;
        }
        const verifiedUser = await Auth.currentUser();
        if (!verifiedUser || String(verifiedUser.email || '').toLowerCase() !== email) {
          try { await Auth.signOut(); } catch {}
          setStatus('Please enter your correct password.', true);
          passwordField.focus();
          return;
        }
      }
      const result = await Auth.submitAccessRequest(email, fullName, String(values.get('company_url') || ''));
      if (result.status === 'approved') {
        if (legacyTeamFlow) {
          setMode('approved-signup');
          setStatus('Your request is approved. Create your team login now.');
        } else {
          const member = await Auth.completeApprovedAccess();
          window.location.assign(routeForRole(member.role));
        }
      } else {
        if (!legacyTeamFlow) try { await Auth.signOut(); } catch {}
        form.reset();
        emailField.value = '';
        setMode('signin');
        setStatus(legacyTeamFlow
          ? 'Your request is now in the owner dashboard. You do not need to confirm email to submit it.'
          : 'Your request is now in the owner dashboard. The password was verified securely and was not shared.');
      }
      return;
    }

    if (mode === 'approved-signup') {
      try {
        const result = await Auth.signUp(email, password, fullName);
        if (!result || !result.access_token) {
          setMode('signin');
          setStatus('Team account created. Confirm the email, then sign in to finish joining the approved workspace.');
          return;
        }
        const member = await Auth.completeApprovedAccess();
        window.location.assign(routeForRole(member.role));
        return;
      } catch (signupError) {
        if (/already registered|already exists|user exists/i.test(String(signupError.message || ''))) {
          setMode('signin');
          setStatus('An account already exists for this email. Sign in to finish joining the approved workspace.');
          return;
        }
        throw signupError;
      }
    }

    await Auth.signIn(email, password);
    const user = await Auth.currentUser();
    if (!user) throw new Error('Your session could not be verified. Please sign in again.');
    let member = await Auth.membership(user.id);
    if (user.email.toLowerCase() === ownerEmail && (!member || member.role !== 'owner')) {
      member = await Auth.claimOwnerAccount();
    } else if (!member || member.role !== 'owner' && member.approval_status !== 'approved') {
      try {
        member = await Auth.completeApprovedAccess();
      } catch (accessError) {
        await Auth.signOut();
        const accessCode = String(accessError.code || '');
        if (accessCode === 'ACCESS_PENDING') setStatus('Your access request is waiting for owner approval.');
        else if (accessCode === 'NO_ACCESS_REQUEST') setStatus('No team request was found for this email. Choose “Request team access” first.');
        else if (accessCode === 'ACCESS_REJECTED') setStatus('The owner declined this access request.', true);
        else throw accessError;
        return;
      }
    }
    if (!member || member.approval_status !== 'approved' || member.account_status !== 'active') {
      await Auth.signOut();
      setStatus('This account is not active for workspace access. Contact the Rank Right owner.', true);
      return;
    }
    window.location.assign(routeForRole(member.role));
  } catch (error) {
    const message = String(error && error.message || 'Unable to complete this request.');
    if (/workspace_members|workspace_access_requests|schema cache|does not exist|not found|PGRST/i.test(message)) {
      setStatus('The dashboard access setup is incomplete. Refresh the page and try again.', true);
    } else {
      setStatus(message, true);
    }
  } finally {
    submit.disabled = false;
    if (mode === 'request') submit.innerHTML = 'Request access <span>→</span>';
    else if (mode === 'approved-signup') submit.innerHTML = 'Create team login <span>→</span>';
    else submit.innerHTML = 'Sign in <span>→</span>';
  }
});

})();}

if(document.body.dataset.dashboardRole){(function(){
const Auth=globalThis.RankRightAuth;
const DB=globalThis.RankRightDB;
const WorkspaceFiles=globalThis.RankRightFiles;
const PROJECT_REF=globalThis.RankRightConfig.PROJECT_REF;

const role=document.body.dataset.dashboardRole;
const owner=role==='owner';
const root=document.querySelector('#main-content');
const dialog=document.querySelector('#app-dialog');
const dialogBody=document.querySelector('#dialog-body');
const dialogTitle=document.querySelector('#dialog-title');
const dialogSubmit=document.querySelector('#dialog-submit');
const views=owner?{
  overview:['Owner overview','YOUR AGENCY AT A GLANCE','A live view of work, reviews, and deadlines.'],
  requests:['Access requests','MEMBERSHIP CONTROL','Review new requests and see previous access decisions.'],
  team:['Team directory','PEOPLE & PERMISSIONS','Manage approved members and account access.'],
  enquiries:['Website enquiries','INCOMING LEADS','Review enquiries submitted through the Rank Right website.'],
  clients:['Clients','CLIENT RELATIONSHIPS','Business records authorized for the workspace.'],
  services:['Service lines','ACTIVE SERVICE WORKSPACES','Manage Rank Right’s configured services.'],
  projects:['Projects','DELIVER THE WORK','Projects, clients, service lines, and deadlines.'],
  reviews:['Review centre','SUBMISSIONS & FEEDBACK','Review submitted work once across every service.'],
  tasks:['Tasks','WORKLOAD','Assignments, priorities, and due dates.'],
  calendar:['Calendar','PLAN AHEAD','Events and task deadlines permitted to your role.'],
  templates:['Project templates','REPEAT WHAT WORKS','Reusable project structure and checklists.'],
  recurrence:['Recurring work','AUTOMATE ROUTINES','Rules are stored here; scheduled generation needs server setup.'],
  approvals:['Client approvals','CLIENT FEEDBACK','Track secure client approval decisions.'],
  reports:['Reports & export','REAL WORKSPACE DATA','Exports contain only records authorized for your role.'],
  activity:['Activity log','ACCOUNTABILITY','Recorded activity for the workspace.'],
  notifications:['Notifications','WORKSPACE UPDATES','Review your alerts.'],
  settings:['Settings','WORKSPACE CONTROL','Project and account access.']
}:{
  overview:['My overview','MY WORK AT A GLANCE','Assigned projects, tasks, and feedback.'],
  projects:['Assigned projects','MY PROJECTS','Projects assigned to your account.'],
  services:['My services','SERVICE WORKSPACES','Services approved for your account.'],
  tasks:['My tasks','MY WORKLOAD','Update progress on your assigned tasks.'],
  submissions:['Submit work','DELIVERABLES','Send work to the owner review queue.'],
  feedback:['Review feedback','OWNER FEEDBACK','Decisions and requested changes on your submissions.'],
  calendar:['My calendar','PLAN YOUR WORK','Deadlines and events you may access.'],
  notifications:['Notifications','YOUR UPDATES','Assignments, feedback, and deadline changes.'],
  templates:['Available templates','START WITH A TEMPLATE','Use templates permitted for your services.'],
  activity:['My activity','YOUR WORK HISTORY','Relevant activity on your assigned work.'],
  reports:['My reports','MY WORKSPACE DATA','Review and export records available to your account.'],
  settings:['Settings','ACCOUNT & ACCESS','Your Rank Right workspace account.']
};
const serviceList=[['s001','Website Design & Development'],['s002','SEO'],['s003','Social Media Marketing'],['s004','Google Ads'],['s005','Meta Ads'],['s006','Content Marketing'],['s007','Graphic Design'],['s008','Email Marketing'],['s009','Branding'],['s010','E-commerce Marketing']];
const specs={
  requests:['workspace_access_requests',{select:'id,full_name,email,status,created_at',order:'created_at.desc'},[['full_name','Name'],['email','Email'],['created_at','Requested'],['status','Status']]],
  team:['workspace_members',{select:'id,user_id,full_name,email,role,approval_status,account_status,created_at',order:'created_at.desc'},[['full_name','Name'],['email','Email'],['role','Role'],['approval_status','Approval'],['account_status','Account'],['created_at','Joined']]],
  enquiries:['contact_enquiries',{select:'id,created_at,name,email,business_name,service_name,phone_number,message',order:'created_at.desc',limit:'500'},[['name','Name'],['business_name','Business'],['email','Email'],['phone_number','Phone'],['service_name','Service'],['message','Message'],['created_at','Received']]],
  clients:['clients',{select:'id,name,business_name,email,phone,notes,status,created_at',order:'created_at.desc'},[['business_name','Business'],['name','Contact'],['email','Email'],['phone','Phone'],['status','Status']]],
  services:['services',{select:'id,name,description,active,sort_order',order:'sort_order.asc'},[['name','Service'],['description','Description'],['active','Active']]],
  projects:['projects',{select:'id,title,description,service_id,client_id,status,priority,due_at,progress,created_at',order:'created_at.desc'},[['title','Project'],['service_name','Service'],['status','Status'],['priority','Priority'],['due_at','Deadline']]],
  reviews:['project_submissions',{select:'id,project_id,submitted_by,title,work_description,status,version,submitted_at,preview_url,preview_links',order:'submitted_at.desc'},[['title','Submission'],['project_name','Project'],['submitter_name','Submitted by'],['status','Review status'],['version','Version'],['attachment_count','Files'],['submitted_at','Submitted']]],
  tasks:['tasks',{select:'id,title,project_id,assignee_id,status,priority,due_at,created_at',order:'due_at.asc'},[['title','Task'],['project_name','Project'],['assignee_name','Assigned to'],['status','Status'],['priority','Priority'],['due_at','Due']]],
  calendar:['calendar_events',{select:'id,title,description,starts_at,ends_at,project_id,assigned_to',order:'starts_at.asc'},[['title','Event'],['starts_at','Starts'],['project_name','Project'],['assignee_name','Assigned to']]],
  templates:['project_templates',{select:'id,name,description,service_id,active,created_at',order:'created_at.desc'},[['name','Template'],['service_name','Service'],['description','Description'],['active','Active']]],
  recurrence:['recurring_task_rules',{select:'id,task_title,description,frequency,interval_count,service_id,project_id,assigned_to,next_run_at,active',order:'next_run_at.asc'},[['task_title','Task'],['frequency','Frequency'],['service_name','Service'],['assignee_name','Assigned to'],['next_run_at','Next run'],['active','Active']]],
  approvals:['client_approval_requests',{select:'id,project_id,submission_id,client_id,status,due_at,decided_at',order:'created_at.desc'},[['project_name','Project'],['submission_id','Submission'],['client_name','Client'],['status','Status'],['due_at','Due']]],
  activity:['activity_log',{select:'id,actor_id,event_type,entity_type,project_id,created_at',order:'created_at.desc',limit:'100'},[['event_type','Activity'],['actor_id','By'],['entity_type','Record'],['project_id','Project'],['created_at','When']]],
  notifications:['notifications',{select:'id,title,message,kind,read_at,created_at',order:'created_at.desc',limit:'100'},[['title','Notification'],['message','Details'],['kind','Type'],['read_at','Read'],['created_at','When']]],
  feedback:['project_reviews',{select:'id,submission_id,reviewer_id,decision,feedback,created_at',order:'created_at.desc'},[['submission_id','Submission'],['decision','Decision'],['feedback','Feedback'],['created_at','Reviewed']]]
};
const forms={
  clients:[['name','Contact name','text'],['business_name','Business name','text'],['email','Email','email'],['phone','Phone','tel'],['notes','Internal notes','textarea']],
  services:[['name','Service name','text'],['description','Description','textarea']],
  projects:[['title','Project title','text'],['description','Description','textarea'],['client_id','Client','clients'],['service_id','Service','services'],['status','Project status','project-status'],['priority','Priority','priority'],['due_at','Deadline','date']],
  tasks:[['title','Task title','text'],['description','Description','textarea'],['project_id','Project','projects'],['assignee_id','Assign to','members'],['priority','Priority','priority'],['due_at','Deadline','date']],
  calendar:[['title','Event title','text'],['description','Description','textarea'],['starts_at','Starts at','datetime-local'],['ends_at','Ends at','datetime-local'],['project_id','Project','projects'],['assigned_to','Visible to member','members']],
  templates:[['name','Template name','text'],['description','Description','textarea'],['service_id','Service','services']],
  recurrence:[['task_title','Task title','text'],['description','Description','textarea'],['frequency','Repeat','frequency'],['interval_count','Every (interval)','number'],['service_id','Service','services'],['project_id','Project','projects'],['assigned_to','Assign to','members'],['next_run_at','First run','date']],
  submissions:[['project_id','Assigned project','projects'],['title','Submission title','text'],['work_description','Work completed','textarea'],['preview_url','Preview link','url'],['preview_links','Additional links (one per line)','textarea']]
};let user=null,member=null,currentView='overview',currentRows=[],searchTimer;
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function val(v){if(v==null||v==='')return '—';if(typeof v==='boolean')return v?'Yes':'No';if(typeof v==='object')return JSON.stringify(v);return String(v).length>95?String(v).slice(0,92)+'…':String(v);}
function toast(message,error){let n=document.querySelector('.toast');if(!n){n=document.createElement('div');n.className='toast';document.body.append(n);}n.textContent=message;n.classList.toggle('is-error',!!error);clearTimeout(n.timer);n.timer=setTimeout(()=>n.remove(),4000);}
function heading(title,kicker,description,action){return '<div class="page-heading"><div><p class="eyebrow"><span class="eyebrow-dot"></span>'+esc(kicker)+'</p><h1>'+esc(title)+'</h1><p class="page-description">'+esc(description)+'</p></div>'+(action||'')+'</div>';}
function chip(v){const s=val(v),c=/approved|active|complete|done|read/i.test(s)?'green':/pending|review|requested|progress|unread/i.test(s)?'amber':/reject|inactive|overdue/i.test(s)?'red':'blue';return '<span class="status-chip status-chip-'+c+'">'+esc(s.replace(/_/g,' '))+'</span>';}
function stat(label,value,icon,color){return '<article class="stat-card"><div class="stat-top"><span class="stat-icon '+color+'">'+icon+'</span><span class="stat-label">'+esc(label)+'</span><span class="stat-menu">···</span></div><div class="stat-value">'+esc(value==null?'—':value)+'</div><div class="stat-foot">'+(value==null?'Awaiting verified data':'Based on authorized records')+'</div></article>';}
function empty(title,copy){return '<section class="panel data-panel"><div class="empty-card"><span class="empty-illustration">✓</span><strong>'+esc(title)+'</strong><p>'+esc(copy)+'</p></div></section>';}
function btn(label,action){return '<button class="button button-primary" type="button" data-action="'+esc(action)+'">'+label+'</button>';}
function small(label,action,id){return '<button class="small-button'+(action==='delete-record'?' small-button-danger':'')+'" type="button" data-action="'+esc(action)+'" data-id="'+esc(id)+'">'+esc(label)+'</button>';}
function actions(row,view){
  if(owner&&view==='requests')return '<div class="table-actions">'+(row.status==='pending'?small('Approve','approve-access-request',row.id)+small('Reject','reject-access-request',row.id):'')+small('Delete','delete-record',row.id)+'</div>';
  if(owner&&view==='team')return '<div class="table-actions">'+small('Services','member-services',row.user_id)+' '+small(row.account_status==='active'?'Deactivate':'Activate','toggle-member',row.id)+'</div>';
  if(owner&&view==='enquiries')return small('Delete','delete-record',row.id);
  if(owner&&view==='clients')return '<div class="table-actions">'+small('Edit','edit-row',row.id)+small('Delete','delete-record',row.id)+'</div>';
  if(owner&&view==='projects')return '<div class="table-actions">'+small('Edit','edit-row',row.id)+small('Manage members','assign-project',row.id)+small('Delete','delete-record',row.id)+'</div>';
  if(owner&&['calendar','templates','recurrence'].includes(view))return '<div class="table-actions">'+small('Edit','edit-row',row.id)+(view==='templates'?small('Add checklist item','template-task',row.id):'')+small('Delete','delete-record',row.id)+'</div>';
  if(owner&&view==='tasks')return small('Delete','delete-record',row.id);

  if(owner&&view==='reviews')return '<div class="table-actions">'+small('View details','view-submission',row.id)+(/pending|changes_requested/i.test(row.status||'')?small('Approve','approve-review',row.id)+small('Request changes','changes-review',row.id)+small('Reject','reject-review',row.id):'')+small('Delete','delete-record',row.id)+'</div>';
  if(owner&&view==='approvals')return small('Delete','delete-record',row.id);
  if(view==='notifications'&&owner)return small('Delete','delete-record',row.id);
  if(!owner&&view==='submissions'&&row.submitted_by===user.id&&row.status==='pending_review')return small('Delete','delete-record',row.id);
  if(!owner&&view==='notifications')return '<div class="table-actions">'+(!row.read_at?small('Mark read','mark-read',row.id):'')+small('Delete','delete-record',row.id)+'</div>';
  if(owner&&view==='templates')return small('Add checklist item','template-task',row.id);
  if(!owner&&view==='tasks'&&row.assignee_id===user.id)return small('Update progress','task-update',row.id);
  if(!owner&&view==='notifications'&&!row.read_at)return small('Mark read','mark-read',row.id);
  if(!owner&&view==='projects')return small('Upload files','upload-project-files',row.id);
  return '—';
}
function table(rows,view){
  const spec=specs[owner?view:({submissions:'reviews',feedback:'feedback'}[view]||view)];if(!rows.length)return empty('No records yet',view==='requests'?'New team access requests will appear here when someone submits one.':'This section will show real records allowed by your account. No sample data is displayed.');
  const heads=spec[2].map(c=>'<th>'+esc(c[1])+'</th>').join('');
  const body=rows.map(row=>'<tr>'+spec[2].map((c,i)=>'<td><span class="'+(i?'cell-sub':'cell-title')+'">'+(/status|active|decision|priority/.test(c[0])?chip(row[c[0]]):esc(val(row[c[0]])))+'</span></td>').join('')+'<td>'+actions(row,view)+'</td></tr>').join('');
  return '<section class="panel data-panel"><div class="data-table-wrap"><table class="data-table"><thead><tr>'+heads+'<th>Actions</th></tr></thead><tbody>'+body+'</tbody></table></div></section>';
}
async function rowsFor(view){
  const key=owner?view:({submissions:'reviews'}[view]||view),spec=specs[key];if(!spec)return [];
  const params={...spec[1]};
  if(!owner&&view==='submissions')params.submitted_by='eq.'+user.id;
  if(!owner&&view==='notifications')params.user_id='eq.'+user.id;
  if(!owner&&view==='activity')params.actor_id='eq.'+user.id;
  if(!owner&&view==='services')params.active='eq.true';
  const rows=await DB.select(spec[0],params);
  if(owner&&view==='requests')rows.sort((a,b)=>(a.status==='pending'?0:1)-(b.status==='pending'?0:1)||Date.parse(b.created_at||0)-Date.parse(a.created_at||0));
  if(!rows.length)return rows;
  const idsFor=field=>[...new Set(rows.map(r=>r[field]).filter(Boolean))];
  const serviceIds=idsFor('service_id'),projectIds=idsFor('project_id'),clientIds=idsFor('client_id');
  const memberIds=[...new Set([...idsFor('assignee_id'),...idsFor('assigned_to'),...idsFor('submitted_by')])];
  const [services,projects,clients,members]=await Promise.all([
    serviceIds.length?DB.select('services',{select:'id,name',id:'in.('+serviceIds.join(',')+')'}):Promise.resolve([]),
    projectIds.length?DB.select('projects',{select:'id,title',id:'in.('+projectIds.join(',')+')'}):Promise.resolve([]),
    clientIds.length?DB.select('clients',{select:'id,business_name',id:'in.('+clientIds.join(',')+')'}):Promise.resolve([]),
    memberIds.length?DB.select('workspace_members',{select:'user_id,full_name',user_id:'in.('+memberIds.join(',')+')'}):Promise.resolve([])
  ]);
  const serviceNames=Object.fromEntries(serviceList);Object.assign(serviceNames,Object.fromEntries(services.map(r=>[r.id,r.name])));
  const projectNames=Object.fromEntries(projects.map(r=>[r.id,r.title]));
  const clientNames=Object.fromEntries(clients.map(r=>[r.id,r.business_name]));
  const memberNames=Object.fromEntries(members.map(r=>[r.user_id,r.full_name]));
  return rows.map(r=>({...r,
    service_name:serviceNames[r.service_id]||r.service_id||'—',
    project_name:projectNames[r.project_id]||r.project_id||'—',
    client_name:clientNames[r.client_id]||r.client_id||'—',
    assignee_name:memberNames[r.assignee_id||r.assigned_to]||(r.assignee_id===user.id||r.assigned_to===user.id?member.full_name:'—'),
    submitter_name:memberNames[r.submitted_by]||'Team member',
    attachment_count:(Array.isArray(r.preview_links)?r.preview_links:[]).filter(x=>x&&typeof x==='object'&&x.path).length
  }));
}
function serviceCards(rows){
  if(!rows.length)return empty('No services assigned','Your owner can assign service workspaces when setting up your account.');
  return '<div class="service-grid">'+rows.map((record,i)=>'<article class="service-card"><span class="service-index">'+String(i+1).padStart(2,'0')+'</span><span class="service-icon">↗</span><h2>'+esc(record.name)+'</h2><p>'+esc(record.description||'Projects, submissions, and deadlines for this service.')+'</p><span class="service-status">'+(record.active?'ACTIVE':'INACTIVE')+'</span>'+(owner?'<div class="table-actions">'+small('Edit','edit-row',record.id)+' '+small(record.active?'Deactivate':'Activate','toggle-service',record.id)+' '+small('Delete','delete-record',record.id)+'</div>':'')+'</article>').join('')+'</div>';
}
async function count(tableName,filters){try{return await DB.count(tableName,filters||{});}catch{return null;}}
async function overview(){
  let teamSummary=null;try{teamSummary=await Auth.teamSummary();}catch{}
  const labels=owner
    ?await Promise.all([count('projects'),count('project_submissions',{status:'eq.pending_review'}),Promise.resolve(teamSummary?.active_members??null),count('tasks',{due_at:'gte.'+new Date().toISOString(),status:'not.in.(completed,cancelled)'})]).then(n=>[['ACTIVE PROJECTS',n[0],'▤','stat-green'],['PENDING REVIEWS',n[1],'◉','stat-amber'],['ACTIVE TEAM',n[2],'♧','stat-blue'],['UPCOMING DEADLINES',n[3],'◷','stat-red'],['TEAM MEMBERS JOINED',teamSummary?.total_members??null,'♧','stat-blue']])
    :await Promise.all([count('projects'),count('tasks',{status:'eq.in_progress'}),count('project_submissions',{submitted_by:'eq.'+user.id}),count('notifications',{user_id:'eq.'+user.id,read_at:'is.null'})]).then(n=>[['MY PROJECTS',n[0],'▤','stat-green'],['TASKS IN PROGRESS',n[1],'☷','stat-blue'],['MY SUBMISSIONS',n[2],'↑','stat-amber'],['UNREAD NOTICES',n[3],'♧','stat-red'],['ACTIVE TEAM',teamSummary?.active_members??null,'♧','stat-blue'],['TEAM MEMBERS JOINED',teamSummary?.total_members??null,'♧','stat-green']]);
  const view=owner?'projects':'tasks',rows=await rowsFor(view).catch(()=>[]);
  const activeNames=Array.isArray(teamSummary?.active_team_members)?teamSummary.active_team_members:[];
  const teamPanel=owner?'':'<section class="panel active-team-roster"><div class="panel-heading"><div><p class="panel-kicker">ACTIVE TEAM MEMBERS</p></div><span class="status-chip status-chip-green">'+activeNames.length+' TEAM MEMBERS ACTIVE</span></div>'+(activeNames.length?'<ul class="active-team-member-list">'+activeNames.map(name=>'<li><strong>'+esc(name)+' is active</strong></li>').join('')+'</ul>':'<p class="settings-copy">Active team member names are unavailable right now.</p>')+'<div class="team-overview-actions">'+btn('Upload files','open-upload')+'<button class="text-button" data-view="submissions">Open submissions →</button></div></section>';
  return '<div class="stat-grid dashboard-overview-stats">'+labels.map(s=>stat(s[0],s[1],s[2],s[3])).join('')+'</div>'+teamPanel+'<div class="panel-heading"><div><p class="panel-kicker">'+(owner?'LATEST WORK':'UP NEXT')+'</p><h2>'+(owner?'Recent projects':'My tasks')+'</h2></div><button class="text-button" data-view="'+view+'">Open list →</button></div>'+table(rows.slice(0,8),view);
}
async function taskProgressPanel(){
  const [updates,tasks,members]=await Promise.all([
    DB.select('task_updates',{select:'task_id,user_id,status,note,created_at',order:'created_at.desc',limit:'40'}),
    DB.select('tasks',{select:'id,title'}),
    DB.select('workspace_members',{select:'user_id,full_name'})
  ]);
  if(!updates.length)return empty('No progress updates yet','Updates submitted by team members will appear here.');
  const taskNames=Object.fromEntries(tasks.map(r=>[r.id,r.title])),memberNames=Object.fromEntries(members.map(r=>[r.user_id,r.full_name]));
  const body=updates.map(r=>'<tr><td>'+esc(taskNames[r.task_id]||'Task')+'</td><td>'+esc(memberNames[r.user_id]||'Team member')+'</td><td>'+chip(r.status)+'</td><td>'+esc(val(r.note))+'</td><td>'+esc(val(r.created_at))+'</td></tr>').join('');
  return '<section class="panel data-panel"><div class="panel-heading"><div><p class="panel-kicker">TEAM ACTIVITY</p><h2>Latest progress updates</h2></div></div><div class="data-table-wrap"><table class="data-table"><thead><tr><th>Task</th><th>Team member</th><th>Status</th><th>Note</th><th>Updated</th></tr></thead><tbody>'+body+'</tbody></table></div></section>';
}async function render(view){
  if(!views[view])return;currentView=view;document.title=views[view][0]+' · Rank Right';
  document.querySelector('#breadcrumb-current').textContent=views[view][0];
  document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('is-active',b.dataset.view===view));
  const add=owner&&view==='enquiries'?btn('Export enquiries','export-enquiries'):owner&&forms[view]?btn('＋ Add new','create-'+view):(!owner&&view==='submissions'?'<div class="heading-actions">'+btn('Upload files','open-upload')+btn('＋ Submit work','create-submissions')+'</div>':(!owner&&view==='projects'?btn('Upload files','open-upload'):''));
  root.innerHTML=heading(views[view][0],views[view][1],views[view][2],add)+'<section class="loading-state">Loading authorized records…</section>';
  try{
    if(view==='overview'){root.innerHTML=heading(views[view][0],views[view][1],views[view][2],'')+await overview();return;}
    if(view==='services'){const params={select:'id,name,description,active,sort_order',order:'sort_order.asc',limit:'100'};if(!owner)params.active='eq.true';const r=await DB.select('services',params);currentRows=r;root.innerHTML=heading(views[view][0],views[view][1],views[view][2],owner?btn('＋ Add service','create-services'):'')+serviceCards(r);return;}
    if(view==='settings'){
      const profileName=member.full_name||user.user_metadata&&user.user_metadata.full_name||'Name not set';
      const profileEmail=user.email||member.email||'—';
      root.innerHTML=heading(views[view][0],views[view][1],views[view][2],'')+
        '<div class="settings-grid">'+
        '<section class="panel settings-card"><div class="panel-heading"><div><p class="panel-kicker">ACCOUNT PROFILE</p><h2>Your profile</h2></div><span class="status-chip status-chip-green">ACTIVE</span></div><dl class="connection-details"><div><dt>Work email</dt><dd>'+esc(profileEmail)+'</dd></div><div><dt>Workspace role</dt><dd>'+esc(member.role)+'</dd></div></dl><form id="profile-settings-form" class="settings-form"><label for="profile-full-name">Display name</label><input id="profile-full-name" name="full_name" type="text" value="'+esc(profileName)+'" maxlength="120" required autocomplete="name" /><p class="settings-form-status" id="profile-settings-status" role="status" aria-live="polite"></p><button class="button button-primary" type="submit">Save profile</button></form></section>'+
        '<section class="panel settings-card"><div class="panel-heading"><div><p class="panel-kicker">SIGN-IN SECURITY</p><h2>Change password</h2></div></div><p class="settings-copy">Confirm your current password before choosing a new one.</p><form id="password-settings-form" class="settings-form"><label for="settings-current-password">Current password</label><span class="password-control"><input id="settings-current-password" name="current_password" type="password" autocomplete="current-password" required /><button class="password-visibility" type="button" data-settings-password-toggle="settings-current-password" aria-pressed="false">Show</button></span><label for="settings-new-password">New password</label><span class="password-control"><input id="settings-new-password" name="new_password" type="password" minlength="8" autocomplete="new-password" required /><button class="password-visibility" type="button" data-settings-password-toggle="settings-new-password" aria-pressed="false">Show</button></span><label for="settings-confirm-password">Confirm new password</label><span class="password-control"><input id="settings-confirm-password" name="confirm_password" type="password" minlength="8" autocomplete="new-password" required /><button class="password-visibility" type="button" data-settings-password-toggle="settings-confirm-password" aria-pressed="false">Show</button></span><p class="settings-form-status" id="password-settings-status" role="status" aria-live="polite"></p><button class="button button-primary" type="submit">Update password</button></form></section>'+
        '<section class="panel settings-card"><div class="panel-heading"><div><p class="panel-kicker">CONNECTED PROJECT</p><h2>Supabase</h2></div><span class="status-chip status-chip-green">AUTHENTICATED</span></div><dl class="connection-details"><div><dt>Project reference</dt><dd><code>'+PROJECT_REF+'</code></dd></div><div><dt>Signed-in role</dt><dd>'+esc(member.role)+'</dd></div><div><dt>Account</dt><dd>'+esc(member.account_status)+'</dd></div></dl></section>'+
        '<section class="panel settings-card"><p class="panel-kicker">WORKSPACE ACCESS</p><h2>Role-based protection</h2><p class="settings-copy">Your role controls which workspace records and actions are available to your account.</p></section></div>';return;
    }
    if(view==='reports'){const [p,t,r,m]=await Promise.all([count('projects'),count('tasks'),count('project_submissions'),owner?count('workspace_members',{approval_status:'eq.approved'}):Promise.resolve(null)]);const exports=owner?'<div class="heading-actions">'+btn('Export projects','export-projects')+btn('Export tasks','export-tasks')+btn('Export enquiries','export-enquiries')+'</div>':btn('Export my tasks','export-tasks');root.innerHTML=heading(views[view][0],views[view][1],views[view][2],exports)+'<div class="stat-grid">'+stat('PROJECTS',p,'▤','stat-green')+stat('TASKS',t,'☷','stat-blue')+stat('SUBMISSIONS',r,'◉','stat-amber')+(owner?stat('APPROVED MEMBERS',m,'♧','stat-red'):'')+'</div>';return;}
    const key=owner?view:({submissions:'reviews',feedback:'feedback'}[view]||view);
    if(!specs[key])throw new Error('This dashboard section is not configured.');
    const data=await rowsFor(view);currentRows=data;
    const extra=view==='reviews'&&owner?'<div class="stat-grid">'+stat('PENDING',await count('project_submissions',{status:'eq.pending_review'}),'◉','stat-amber')+stat('APPROVED',await count('project_submissions',{status:'eq.approved'}),'✓','stat-green')+stat('CHANGES REQUESTED',await count('project_submissions',{status:'eq.changes_requested'}),'↻','stat-blue')+stat('TOTAL SUBMISSIONS',await count('project_submissions'),'▤','stat-red')+'</div>':'';
    let note='';
    if(owner&&view==='recurrence')note='<section class="panel settings-card"><strong>Scheduled task generation is not active yet.</strong><p class="settings-copy">A server-side scheduler must be deployed and tested before recurring rules generate tasks.</p></section>';
    if(owner&&view==='approvals')note='<section class="panel settings-card"><strong>Client links are not generated yet.</strong><p class="settings-copy">A secure token endpoint or client accounts are required. No guessable public approval links are created.</p></section>';
    const pageAction=owner&&view==='enquiries'?btn('Export enquiries','export-enquiries'):owner&&forms[view]?btn('＋ Add new','create-'+view):(!owner&&view==='submissions'?'<div class="heading-actions">'+btn('Upload files','open-upload')+btn('＋ Submit work','create-submissions')+'</div>':(!owner&&view==='projects'?btn('Upload files','open-upload'):''));
    const progress=owner&&view==='tasks'?await taskProgressPanel():'';
    root.innerHTML=heading(views[view][0],views[view][1],views[view][2],pageAction)+note+extra+table(data,view)+progress;
  }catch(error){root.innerHTML=heading(views[view][0],views[view][1],views[view][2],'')+'<section class="connection-state-card"><span class="empty-illustration">!</span><h1>Workspace data could not be loaded</h1><p>'+esc(error.message||'A database request failed.')+'</p><p>Check that the approved dashboard schema is installed and this account is authorized.</p><button class="button button-secondary" data-action="reload">Try again</button></section>';}
}
async function optionsFor(type){
  if(type==='priority')return '<option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option>';
  if(type==='frequency')return '<option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option>';
  let tableName='',columns='id,name';
  if(type==='services'){tableName='services';columns='id,name';}
  if(type==='clients'){tableName='clients';columns='id,business_name';}
  if(type==='projects'){tableName='projects';columns='id,title';}
  if(type==='members'){tableName='workspace_members';columns='user_id,full_name';}
  if(!tableName)return '';
  const params={select:columns,limit:'300',order:type==='members'?'full_name.asc':'created_at.desc'};
  if(type==='members'){params.approval_status='eq.approved';params.account_status='eq.active';params.role='eq.team_member';}
  const rows=await DB.select(tableName,params);
  return rows.map(function(r){const id=r.user_id||r.id;const label=r.name||r.business_name||r.title||r.full_name||id;return '<option value="'+esc(id)+'">'+esc(label)+'</option>';}).join('');
}
function formTable(view){return ({submissions:'project_submissions',calendar:'calendar_events',templates:'project_templates',recurrence:'recurring_task_rules'}[view]||view);}
async function openCreate(view,initial){
  delete dialog.dataset.mode;
  const fields=forms[view];if(!fields){toast('This action is not available yet.',true);return;}
  dialogSubmit.hidden=false;
  const cancelButton=dialog.querySelector('button[value="cancel"]');if(cancelButton)cancelButton.textContent='Cancel';
  const recordId=initial&&initial.id||null;
  dialogTitle.textContent=recordId?'Edit '+view.replace(/s$/,''):view==='submissions'?'Submit work for review':'Create '+view.replace(/s$/,'');
  const controls=[];
  for(const item of fields){
    const name=item[0],label=item[1],type=item[2],optional=['description','notes','client_id','due_at','ends_at','assigned_to','project_id','preview_url','preview_links','phone','email'].includes(name),req=!optional;
    const required=req?' required':'';
    if(type==='textarea')controls.push('<div class="field"><label for="f-'+name+'">'+esc(label)+(req?' *':'')+'</label><textarea id="f-'+name+'" name="'+name+'"'+required+'></textarea></div>');
    else if(type==='project-status')controls.push('<div class="field"><label for="f-'+name+'">'+esc(label)+'</label><select id="f-'+name+'" name="'+name+'"><option value="draft">Draft</option><option value="active">Active</option><option value="in_review">In review</option><option value="changes_requested">Changes requested</option><option value="approved">Approved</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></div>');
    else if(['services','clients','projects','members','priority','frequency'].includes(type)){
      const opts=await optionsFor(type);
      controls.push('<div class="field"><label for="f-'+name+'">'+esc(label)+(req?' *':'')+'</label><select id="f-'+name+'" name="'+name+'"'+required+'><option value="">Choose…</option>'+opts+'</select></div>');
    } else controls.push('<div class="field"><label for="f-'+name+'">'+esc(label)+(req?' *':'')+'</label><input id="f-'+name+'" name="'+name+'" type="'+type+'"'+required+(type==='number'?' min="1" step="1"':'')+' /></div>');
  }
  dialogBody.innerHTML='<div class="form-grid">'+controls.join('')+'</div><p class="dialog-error" id="dialog-message" role="status"></p>';
  if(initial)Object.keys(initial).forEach(function(key){const f=dialogBody.querySelector('[name="'+key+'"]');if(f){let value=initial[key];if(f.type==='date'&&value)value=String(value).slice(0,10);if(f.type==='datetime-local'&&value)value=new Date(value).toISOString().slice(0,16);f.value=value==null?'':value;}});
  dialogSubmit.type='button';dialogSubmit.textContent=view==='submissions'?'Submit for review':recordId?'Save changes':'Save record';
  dialog.dataset.formView=view;
  if(recordId)dialog.dataset.recordId=recordId;else delete dialog.dataset.recordId;
  if(!dialog.open)dialog.showModal();
}
function resetDialogMode(){delete dialog.dataset.mode;delete dialog.dataset.formView;delete dialog.dataset.recordId;}
async function openUploadDialog(){
  if(owner)throw new Error('File uploads are available from the team workspace.');
  const projects=await DB.select('projects',{select:'id,title',order:'created_at.desc',limit:'300'});
  if(!projects.length)throw new Error('No assigned projects are available for uploads yet. Ask the owner to assign you to a project.');
  dialogTitle.textContent='Upload files for owner review';
  delete dialog.dataset.formView;delete dialog.dataset.recordId;
  dialogBody.innerHTML='<div class="field"><label for="upload-project">Assigned project</label><select id="upload-project" required><option value="">Choose a project…</option>'+projects.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.title)+'</option>').join('')+'</select></div><div class="upload-file-picker"><input id="upload-files" type="file" multiple hidden /><button class="button button-secondary" type="button" data-action="choose-upload-files">Choose files</button><p id="upload-file-list" class="settings-copy" aria-live="polite">No files selected. Up to 10 files, 50 MB each.</p></div><p class="dialog-error" id="upload-message" role="status"></p>';
  dialog.dataset.mode='upload';
  dialogSubmit.hidden=false;dialogSubmit.type='button';dialogSubmit.textContent='Upload and submit';dialogSubmit.disabled=false;
  const cancel=dialog.querySelector('button[value="cancel"]');if(cancel)cancel.textContent='Cancel';
  if(!dialog.open)dialog.showModal();
}
function chooseFilesForProject(projectId){
  if(owner)throw new Error('Only team members can upload deliverables.');
  const input=document.createElement('input');input.type='file';input.multiple=true;input.hidden=true;document.body.appendChild(input);
  input.addEventListener('change',async()=>{const files=Array.from(input.files||[]);input.remove();if(files.length){try{await uploadProjectFiles(projectId,files);}catch(error){toast(error.message||'Unable to upload these files.',true);}}});
  input.addEventListener('cancel',()=>input.remove());
  input.click();
}
async function uploadProjectFiles(projectId,files){
  if(!projectId)throw new Error('Choose an assigned project first.');
  if(!files.length)throw new Error('Choose at least one file.');
  if(files.length>10)throw new Error('Choose no more than 10 files at a time.');
  if(files.some(file=>file.size>50*1024*1024))throw new Error('Each file must be 50 MB or smaller.');
  const uploadButton=dialogSubmit;
  if(uploadButton){uploadButton.disabled=true;uploadButton.textContent='Uploading…';}
  let uploaded=[];
  try{
    for(const file of files)uploaded.push(await WorkspaceFiles.upload(projectId,user.id,file));
    const rows=await DB.select('projects',{select:'id,title',id:'eq.'+projectId,limit:'1'});
    const title=uploaded.length===1?uploaded[0].name:uploaded.length+' uploaded files';
    const inserted=await DB.insert('project_submissions',{project_id:projectId,submitted_by:user.id,title:title.slice(0,180),work_description:'Files uploaded for owner review: '+uploaded.map(f=>f.name).join(', '),preview_links:uploaded,status:'pending_review',version:1});
    if(!inserted.length)throw new Error('The upload completed but the owner review entry could not be created.');
    if(dialog.open&&dialog.dataset.mode==='upload')dialog.close();
    toast('Files uploaded and sent to the owner review centre'+(rows[0]?' for '+rows[0].title:'')+'.');
    await render(currentView);
  }catch(error){if(uploaded.length)await WorkspaceFiles.remove(uploaded.map(f=>f.path)).catch(()=>{});throw error;}
  finally{if(uploadButton){uploadButton.disabled=false;uploadButton.textContent='Upload and submit';}}
}
function collectPayload(view){
  const payload={},editing=Boolean(dialog.dataset.recordId);
  dialogBody.querySelectorAll('[name]').forEach(function(control){
    if(control.type==='checkbox')payload[control.name]=control.checked;
    else if(control.type==='number')payload[control.name]=control.value?Number(control.value):null;
    else if(control.type==='date')payload[control.name]=control.value?new Date(control.value+'T00:00:00Z').toISOString():null;
    else if(control.type==='datetime-local')payload[control.name]=control.value?new Date(control.value).toISOString():null;
    else if(control.name==='preview_links')payload.preview_links=control.value.split(/\r?\n/).map(function(v){return v.trim();}).filter(Boolean);
    else payload[control.name]=control.value.trim()||null;
  });
  if(view==='clients'&&!editing)payload.created_by=user.id;
  if(view==='projects'&&!editing){payload.created_by=user.id;payload.progress=0;}
  if(view==='tasks'&&!editing){payload.created_by=user.id;payload.status='not_started';}
  if(view==='calendar'&&!editing)payload.created_by=user.id;
  if(view==='templates'&&!editing){payload.created_by=user.id;payload.active=true;}
  if(view==='recurrence'&&!editing){payload.created_by=user.id;payload.active=true;payload.interval_count=payload.interval_count||1;}
  if(view==='submissions'){payload.submitted_by=user.id;payload.status='pending_review';payload.version=1;}
  if(view==='services'&&!editing){payload.id=payload.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');payload.active=true;}
  return payload;
}
async function submitCreate(){
  if(dialog.dataset.mode==='upload'){
    const projectId=dialogBody.querySelector('#upload-project')?.value;
    const files=Array.from(dialogBody.querySelector('#upload-files')?.files||[]);
    const message=dialogBody.querySelector('#upload-message');
    if(!projectId){message.textContent='Choose an assigned project.';return;}
    if(!files.length){message.textContent='Choose one or more files first.';return;}
    try{await uploadProjectFiles(projectId,files);}catch(error){message.textContent=error.message||'Unable to upload these files.';}
    return;
  }
  const controls=Array.from(dialogBody.querySelectorAll('input,select,textarea'));
  const invalid=controls.find(function(el){return !el.checkValidity();});
  if(invalid){invalid.reportValidity();return;}
  dialogSubmit.disabled=true;dialogSubmit.textContent='Saving…';
  try{
    const view=dialog.dataset.formView,recordId=dialog.dataset.recordId,payload=collectPayload(view),tableName=formTable(view);
    if(recordId){
      const result=await DB.update(tableName,{id:'eq.'+recordId},payload);
      if(!result.length)throw new Error('No authorized record was updated. Refresh and try again.');
    }else await DB.insert(tableName,payload);
    dialog.close();toast(view==='submissions'?'Submission sent to the owner review centre.':recordId?'Changes saved.':'Record saved.');
    await render(currentView);
  }catch(error){
    const message=document.querySelector('#dialog-message');if(message)message.textContent=error.message||'Unable to save the record.';
    else toast(error.message||'Unable to save the record.',true);
  }finally{dialogSubmit.disabled=false;}
}
async function notify(userId,title,message,kind){
  if(!userId)return;
  await DB.insert('notifications',{user_id:userId,title:title,message:message,kind:kind||'workspace',read_at:null});
}
function safePreviewLink(value){
  const raw=String(value||'').trim();
  if(!raw)return '';
  try{const url=new URL(raw);if(!['http:','https:'].includes(url.protocol))return '';return '<a href="'+esc(url.href)+'" target="_blank" rel="noopener noreferrer">'+esc(url.href)+'</a>';}catch{return '';}
}
async function openSubmissionDetails(id){
  if(!owner)throw new Error('Only the owner can review submitted work.');
  const row=currentRows.find(r=>String(r.id)===String(id));
  if(!row)throw new Error('Submission not found. Refresh the review centre and try again.');
  const [projectRows,memberRows]=await Promise.all([
    row.project_id?DB.select('projects',{select:'id,title',id:'eq.'+row.project_id,limit:'1'}):Promise.resolve([]),
    DB.select('workspace_members',{select:'user_id,full_name,email',user_id:'eq.'+row.submitted_by,limit:'1'})
  ]);
  const project=projectRows[0],submitter=memberRows[0];
  const previews=Array.isArray(row.preview_links)?row.preview_links:Array.isArray(row.preview_links?.links)?row.preview_links.links:[];
  const attachments=previews.filter(item=>item&&typeof item==='object'&&item.path);
  const links=[row.preview_url,...previews.filter(item=>!(item&&typeof item==='object'&&item.path))].filter(Boolean).map(item=>{
    const url=typeof item==='string'?item:(item.url||item.href||'');
    const label=typeof item==='string'?item:(item.label||url);
    const safe=safePreviewLink(url);
    return safe?'<li><span>'+esc(label)+'</span>'+safe+'</li>':'';
  }).filter(Boolean).join('');
  const attachmentList=attachments.map(file=>'<li><span>'+esc(file.name||'Uploaded file')+' · '+esc(file.size?Math.max(1,Math.round(file.size/1024))+' KB':'')+'</span><button class="small-button" type="button" data-action="download-submission-file" data-file-path="'+esc(file.path)+'" data-file-name="'+esc(file.name||'workspace-file')+'">Download file</button></li>').join('');
  dialogTitle.textContent='Submission details';
  dialogBody.innerHTML='<div class="submission-detail-content"><dl class="submission-detail-meta"><div><dt>Submission</dt><dd>'+esc(row.title||'Untitled submission')+'</dd></div><div><dt>Project</dt><dd>'+esc(project?.title||'Project details unavailable')+'</dd></div><div><dt>Submitted by</dt><dd>'+esc(submitter?.full_name||'Team member')+(submitter?.email?' · '+esc(submitter.email):'')+'</dd></div><div><dt>Status</dt><dd>'+esc(String(row.status||'').replace(/_/g,' '))+'</dd></div><div><dt>Version</dt><dd>'+esc(row.version||'—')+'</dd></div><div><dt>Submitted</dt><dd>'+esc(row.submitted_at||'—')+'</dd></div></dl><section class="submission-detail-block"><h3>Work completed</h3><p class="submission-work-description">'+esc(row.work_description||'No work description was included.')+'</p></section><section class="submission-detail-block"><h3>Uploaded files</h3>'+(attachmentList?'<ul class="submission-preview-links">'+attachmentList+'</ul>':'<p>No uploaded files were included.</p>')+'</section><section class="submission-detail-block"><h3>Preview links</h3>'+(links?'<ul class="submission-preview-links">'+links+'</ul>':'<p>No preview links were included.</p>')+'</section></div>';
  delete dialog.dataset.mode;
  dialogSubmit.hidden=true;
  const cancel=dialog.querySelector('button[value="cancel"]');if(cancel)cancel.textContent='Close';
  if(!dialog.open)dialog.showModal();
}
async function action(actionName,id,filePath,fileName){
  try{
    if(actionName==='open-upload')return await openUploadDialog();
    if(actionName==='upload-project-files')return chooseFilesForProject(id);
    if(actionName==='choose-upload-files'){
      const input=dialogBody.querySelector('#upload-files');
      if(!input)throw new Error('The file picker is unavailable. Close this dialog and try again.');
      input.onchange=()=>{const files=Array.from(input.files||[]);const list=dialogBody.querySelector('#upload-file-list');if(list)list.textContent=files.length?files.map(f=>f.name+' ('+Math.max(1,Math.round(f.size/1024))+' KB)').join(' · '):'No files selected. Up to 10 files, 50 MB each.';};
      input.click();return;
    }
    if(actionName==='download-submission-file')return await WorkspaceFiles.download(filePath,fileName);
    if(actionName==='view-submission')return await openSubmissionDetails(id);
    if(actionName==='delete-record'){
      const row=currentRows.find(r=>String(r.id)===String(id));
      if(!row)throw new Error('This record cannot be deleted from the current view. Refresh and try again.');
      const isTeamOwnedSubmission=!owner&&currentView==='submissions'&&row.submitted_by===user.id&&row.status==='pending_review';
      const isOwnNotification=!owner&&currentView==='notifications';
      if(!owner&&!isTeamOwnedSubmission&&!isOwnNotification)throw new Error('This shared or historical record cannot be deleted by a team member.');
      const targets={
        requests:{table:'workspace_access_requests',label:'access request',impact:'This request and its review status will be permanently removed.'},
        clients:{table:'clients',label:'client',impact:'Linked approval requests will also be deleted. Projects will remain, but their client link will be cleared.'},
        services:{table:'services',label:'service',impact:'Member service assignments will be removed. Deletion is blocked while projects, templates, or recurring rules still use this service.'},
        projects:{table:'projects',label:'project',impact:'Assignments, tasks, submissions, reviews, calendar events, recurring rules, and approvals linked to this project will also be permanently deleted.'},
        reviews:{table:'project_submissions',label:'submission',impact:'Review history and client approval requests linked to this submission will also be permanently deleted.'},
        tasks:{table:'tasks',label:'task',impact:'Progress updates linked to this task will also be deleted.'},
        calendar:{table:'calendar_events',label:'calendar event',impact:'This calendar event will be permanently removed.'},
        templates:{table:'project_templates',label:'template',impact:'Checklist items linked to this template will also be deleted.'},
        recurrence:{table:'recurring_task_rules',label:'recurring rule',impact:'Existing tasks will remain, but will no longer be linked to this recurring rule.'},
        approvals:{table:'client_approval_requests',label:'client approval request',impact:'The selected client approval request and its decision status will be permanently removed.'},
        notifications:{table:'notifications',label:'notification',impact:'Only this notification will be removed.'},
        submissions:{table:'project_submissions',label:'your pending submission',impact:'This submission can only be removed while it is pending and has no review or approval history.'}
      };
      if(currentView==='enquiries')targets.enquiries={table:'contact_enquiries',label:'website enquiry',impact:'The selected enquiry will be permanently removed from the owner workspace.'};
      const target=targets[currentView];
      if(!target||!row)throw new Error('This record cannot be deleted from the current view. Refresh and try again.');
      const title=row.name||row.title||row.business_name||row.task_title||target.label;
      if(!window.confirm('Delete '+target.label+' “'+title+'”?\n\n'+target.impact+'\n\nThis cannot be undone.'))return;
      const protectedDelete=['enquiries','requests','notifications'].includes(currentView)||isTeamOwnedSubmission;
      const deleted=currentView==='enquiries'
        ? await Auth.deleteEnquiry(id)
        : protectedDelete
          ? await Auth.deleteWorkspaceRecord(currentView==='requests'?'delete_access_request':currentView==='notifications'?'delete_notification':'delete_own_submission',id)
          : await DB.remove(target.table,{id:'eq.'+id});
      if(protectedDelete||currentView==='enquiries'?(!deleted||!deleted.deleted_id):!deleted.length)throw new Error('No record was deleted. Refresh the list and try again.');
      toast('Deleted '+target.label+'.');
      return render(currentView);
    }
    if(actionName==='create-clients')return openCreate('clients');
    if(actionName==='create-services')return openCreate('services');
    if(actionName==='create-projects')return openCreate('projects');
    if(actionName==='create-tasks')return openCreate('tasks');
    if(actionName==='create-calendar')return openCreate('calendar');
    if(actionName==='create-templates')return openCreate('templates');
    if(actionName==='create-recurrence')return openCreate('recurrence');
    if(actionName==='create-submissions')return openCreate('submissions');
    if(actionName==='edit-row'){
      const row=currentRows.find(r=>r.id===id);if(!row)throw new Error('Record not found in this view.');
      if(!owner||!forms[currentView]||['tasks','submissions'].includes(currentView))throw new Error('This record cannot be edited from this workspace.');
      return openCreate(currentView,row);
    }
    if(actionName==='toggle-service'){
      const row=currentRows.find(r=>r.id===id);if(!row)throw new Error('Service not found.');
      const changed=await DB.update('services',{id:'eq.'+id},{active:!row.active});
      if(!changed.length)throw new Error('Service was not updated.');
      toast(row.active?'Service deactivated.':'Service activated.');
      return render(currentView);
    }
    if(actionName==='reload')return render(currentView);
    if(actionName==='approve-access-request'||actionName==='reject-access-request'){
      const approved=actionName==='approve-access-request';
      const changed=await DB.update('workspace_access_requests',{id:'eq.'+id,status:'eq.pending'},{status:approved?'approved':'rejected',reviewed_at:new Date().toISOString(),reviewed_by:user.id});
      if(!changed.length)throw new Error('This request has already been reviewed. Refresh the list.');
      toast(approved?'Request approved. The member can finish sign-in after confirming their email.':'Request rejected.');
    }else if(actionName==='toggle-member'){
      const row=currentRows.find(r=>r.id===id),next=row&&row.account_status==='active'?'inactive':'active';
      await DB.update('workspace_members',{id:'eq.'+id},{account_status:next});
      toast('Member access updated.');
    }else if(['approve-review','reject-review','changes-review'].includes(actionName)){
      const decision=actionName==='approve-review'?'approved':actionName==='reject-review'?'rejected':'changes_requested';
      const note=window.prompt(decision==='approved'?'Optional approval note:':'Enter feedback for the team member:','');
      if(note===null)return;
      const row=currentRows.find(r=>r.id===id);
      await DB.insert('project_reviews',{submission_id:id,reviewer_id:user.id,decision:decision,feedback:note.trim()||null});
      const changed=await DB.update('project_submissions',{id:'eq.'+id,status:'in.(pending_review,changes_requested)'},{status:decision});
      if(!changed.length)throw new Error('The submission was already reviewed or is no longer available.');
      if(row)await notify(row.submitted_by,'Submission '+decision.replace(/_/g,' '),note.trim()||'Your submitted work was reviewed.','review');
      toast('Review decision saved.');
    }else if(actionName==='task-update'){
      const status=window.prompt('Set status to one of: in_progress, blocked, completed','in_progress');
      if(!status)return;
      const normalized=status.trim().toLowerCase();
      if(!['in_progress','blocked','completed'].includes(normalized))throw new Error('Choose in_progress, blocked, or completed.');
      const note=window.prompt('Optional progress note:','');
      const changed=await DB.update('tasks',{id:'eq.'+id,assignee_id:'eq.'+user.id},{status:normalized});
      if(!changed.length)throw new Error('This task is not assigned to your account, or it has already been changed.');
      await DB.insert('task_updates',{task_id:id,user_id:user.id,status:normalized,note:note&&note.trim()||null});
      toast('Task status and progress update saved.');
    }else if(actionName==='member-services'){
      const memberRow=currentRows.find(r=>r.user_id===id);
      const [services,assigned]=await Promise.all([DB.select('services',{select:'id,name',active:'eq.true',order:'sort_order.asc'}),DB.select('member_services',{select:'id,service_id',user_id:'eq.'+id})]);
      const menu=services.map((s,i)=>(i+1)+'. '+s.name+(assigned.some(a=>a.service_id===s.id)?' [assigned]':'')).join('\n');
      const choice=window.prompt('Enter a service number to assign or remove for '+(memberRow&&memberRow.full_name||'this member')+':\n'+menu,'1');
      if(!choice)return;
      const service=services[Number(choice)-1];if(!service)throw new Error('Choose a service number from the list.');
      const existing=assigned.find(a=>a.service_id===service.id);
      if(existing)await DB.remove('member_services',{id:'eq.'+existing.id});
      else await DB.insert('member_services',{user_id:id,service_id:service.id,assigned_by:user.id});
      toast((existing?'Removed ':'Assigned ')+service.name+'.');
    }else if(actionName==='mark-read'){
      const changed=await DB.update('notifications',{id:'eq.'+id,user_id:'eq.'+user.id},{read_at:new Date().toISOString()});
      if(!changed.length)throw new Error('Notification was not updated.');
      toast('Notification marked as read.');
    }else if(actionName==='assign-project'){
      const [members,assigned]=await Promise.all([DB.select('workspace_members',{select:'user_id,full_name',approval_status:'eq.approved',account_status:'eq.active',role:'eq.team_member',order:'full_name.asc'}),DB.select('project_members',{select:'id,user_id',project_id:'eq.'+id})]);
      const menu=members.map((m,i)=>(i+1)+'. '+m.full_name+(assigned.some(a=>a.user_id===m.user_id)?' [assigned]':'')).join('\n');
      const selected=window.prompt('Choose a member to assign or remove:\n'+menu,'1');
      if(!selected)return;
      const row=members[Number(selected)-1];if(!row)throw new Error('Choose a member number from the list.');
      const existing=assigned.find(a=>a.user_id===row.user_id);
      if(existing){await DB.remove('project_members',{id:'eq.'+existing.id});toast('Project assignment removed.');}
      else{await DB.insert('project_members',{project_id:id,user_id:row.user_id,assigned_by:user.id});await notify(row.user_id,'Project assigned','A new project has been assigned to you.','assignment');toast('Project assignment saved.');}
    }else if(actionName==='template-task'){
      const title=window.prompt('Checklist item title:','');
      if(!title||!title.trim())return;
      const description=window.prompt('Short description (optional):','')||'';
      const priority=window.prompt('Priority: low, normal, high, urgent','normal')||'normal';
      if(!['low','normal','high','urgent'].includes(priority.trim().toLowerCase()))throw new Error('Choose low, normal, high, or urgent.');
      const offset=Number(window.prompt('Days after project start (0 or more):','0')||'0');
      if(!Number.isInteger(offset)||offset<0)throw new Error('Enter a whole number of days.');
      const existing=await DB.select('project_template_tasks',{select:'sort_order',template_id:'eq.'+id,order:'sort_order.desc',limit:'1'});
      await DB.insert('project_template_tasks',{template_id:id,title:title.trim(),description:description.trim(),priority:priority.trim().toLowerCase(),offset_days:offset,sort_order:(existing[0]&&existing[0].sort_order||0)+1});
      toast('Checklist item added.');
    }else if(actionName==='export-projects')return exportCsv('projects');
    else if(actionName==='export-tasks')return exportCsv('tasks');
    else if(actionName==='export-enquiries')return exportCsv('contact_enquiries');
    else{toast('This action is not available yet.',true);return;}
    await render(currentView);
  }catch(error){
    const message=String(error.message||'The action could not be completed.');
    if(actionName==='delete-record'&&/foreign key|23503|constraint/i.test(message))toast(currentView==='services'?'This service is still used by a project, template, or recurring rule. Reassign or remove those links first.':message,true);
    else toast(message,true);
  }
}
async function exportCsv(tableName){
  const rows=await DB.select(tableName,{select:'*',order:'created_at.desc',limit:'5000'});
  if(!rows.length){toast('No authorized rows to export.');return;}
  const columns=Object.keys(rows[0]),quote=v=>{let value=String(v==null?'':typeof v==='object'?JSON.stringify(v):v);if(/^[=+\-@]/.test(value))value="'"+value;return '"'+value.replace(/"/g,'""')+'"';};
  const csv=[columns.map(quote).join(',')].concat(rows.map(r=>columns.map(c=>quote(r[c])).join(','))).join('\r\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='rank-right-'+tableName+'-'+new Date().toISOString().slice(0,10)+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
async function doSearch(q){
  const term='ilike.*'+q.replace(/[,*()]/g,' ').trim()+'*';
  const targets=owner?['projects','clients','tasks','project_submissions']:['projects','tasks','project_submissions'];
  const tasks=targets.map(function(t){
    const field=t==='clients'?'business_name':'title';
    return DB.select(t,{select:'*',[field]:term,limit:'12'}).then(rows=>rows.map(r=>({...r,_table:t}))).catch(()=>[]);
  });
  const results=(await Promise.all(tasks)).flat();
  const body=results.map(r=>'<tr><td>'+esc(val(r.title||r.business_name||r.name))+'</td><td>'+esc(r._table.replace(/_/g,' '))+'</td><td>'+chip(r.status)+'</td></tr>').join('');
  root.innerHTML=heading('Search results','AUTHORIZED RECORDS','Results for “'+esc(q)+'” are subject to your role.')+(results.length?'<section class="panel data-panel"><div class="data-table-wrap"><table class="data-table"><thead><tr><th>Record</th><th>Type</th><th>Status</th></tr></thead><tbody>'+body+'</tbody></table></div></section>':empty('No matching records','Try another search. Only records permitted to your account are searched.'));
}
function setup(){
  root.addEventListener('submit',async function(event){
    const form=event.target;
    if(form.id==='profile-settings-form'){
      event.preventDefault();
      const button=form.querySelector('button[type="submit"]'),status=form.querySelector('#profile-settings-status'),name=form.elements.full_name.value.trim();
      if(!name){status.textContent='Enter your display name.';status.classList.add('is-error');return;}
      button.disabled=true;button.textContent='Saving…';status.textContent='';status.classList.remove('is-error');
      try{
        const updated=await Auth.updateProfileName(name);member.full_name=updated.full_name||name;
        document.querySelector('#user-name').textContent=member.full_name;
        const initials=member.full_name.split(/\s+/).slice(0,2).map(p=>p[0]).join('').toUpperCase();
        document.querySelector('#user-avatar').textContent=initials;document.querySelector('#top-avatar').textContent=initials;
        status.textContent='Profile saved.';
      }catch(error){status.textContent=error.message||'Unable to save your profile.';status.classList.add('is-error');}
      finally{button.disabled=false;button.textContent='Save profile';}
    }else if(form.id==='password-settings-form'){
      event.preventDefault();
      const button=form.querySelector('button[type="submit"]'),status=form.querySelector('#password-settings-status');
      const currentPassword=form.elements.current_password.value,password=form.elements.new_password.value,confirmation=form.elements.confirm_password.value;
      status.textContent='';status.classList.remove('is-error');
      if(password!==confirmation){status.textContent='The passwords do not match.';status.classList.add('is-error');form.elements.confirm_password.focus();return;}
      button.disabled=true;button.textContent='Updating…';
      try{await Auth.signIn(user.email,currentPassword);await Auth.changePassword(password);form.reset();form.querySelectorAll('[data-settings-password-toggle]').forEach(b=>{const input=document.getElementById(b.dataset.settingsPasswordToggle);if(input)input.type='password';b.textContent='Show';b.setAttribute('aria-pressed','false');});status.textContent='Password updated successfully.';}
      catch(error){status.textContent=error.message||'Unable to update your password.';status.classList.add('is-error');}
      finally{button.disabled=false;button.textContent='Update password';}
    }
  });
  root.addEventListener('click',function(event){
    const toggle=event.target.closest('[data-settings-password-toggle]');if(!toggle)return;
    const input=document.getElementById(toggle.dataset.settingsPasswordToggle);if(!input)return;
    const visible=input.type==='password';input.type=visible?'text':'password';toggle.textContent=visible?'Hide':'Show';toggle.setAttribute('aria-pressed',String(visible));
  });
  document.addEventListener('click',function(event){
    const nav=event.target.closest('[data-view]');if(nav){event.preventDefault();render(nav.dataset.view);document.querySelector('#sidebar').classList.remove('is-open');document.querySelector('#mobile-scrim').classList.remove('is-visible');return;}
    const act=event.target.closest('[data-action]');if(act){action(act.dataset.action,act.dataset.id,act.dataset.filePath,act.dataset.fileName);return;}
    const signOut=event.target.closest('[data-sign-out]');if(signOut){signOut.disabled=true;signOut.querySelectorAll('span')[1].textContent='Signing out…';Auth.signOut().catch(()=>{}).finally(()=>location.assign('index.html'));return;}
    const service=event.target.closest('[data-service]');if(service)toast('Service details load from authorized projects in this service.');
  });
  document.querySelector('#menu-toggle').addEventListener('click',function(){const open=document.querySelector('#sidebar').classList.toggle('is-open');document.querySelector('#mobile-scrim').classList.toggle('is-visible',open);this.setAttribute('aria-expanded',String(open));});
  document.querySelector('#mobile-scrim').addEventListener('click',function(){document.querySelector('#sidebar').classList.remove('is-open');this.classList.remove('is-visible');});
  dialogSubmit.type='button';dialogSubmit.addEventListener('click',submitCreate);
  document.querySelector('#app-dialog').addEventListener('click',function(e){if(e.target===dialog)dialog.close();});
  const search=document.querySelector('#workspace-search');
  search.addEventListener('input',function(){clearTimeout(searchTimer);const q=this.value.trim();if(q.length<2)return;searchTimer=setTimeout(()=>doSearch(q).catch(e=>toast(e.message,true)),350);});
  document.addEventListener('keydown',function(e){if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();search.focus();}});
}
async function boot(){
  try{
    setup();
    const session=await Auth.getSession();if(!session){location.replace('index.html?next='+encodeURIComponent(location.pathname));return;}
    user=await Auth.currentUser();if(!user){location.replace('index.html');return;}
    member=await Auth.membership(user.id);
    if(!member||member.approval_status!=='approved'||member.account_status!=='active'){
      await Auth.signOut();root.innerHTML='<section class="connection-state-card"><span class="empty-illustration">!</span><h1>Workspace access is pending</h1><p>Your account must be approved and active before entering the dashboard.</p><a class="button button-secondary" href="index.html">Return to sign in</a></section>';return;
    }
    const expected=owner?'owner':'team_member';if(member.role!==expected){location.replace(member.role==='owner'?'owner.html':'team.html');return;}
    const name=member.full_name||user.email||'Rank Right member',initials=name.split(/\s+/).slice(0,2).map(p=>p[0]).join('').toUpperCase();
    document.querySelector('#user-name').textContent=name;document.querySelector('#user-avatar').textContent=initials;document.querySelector('#top-avatar').textContent=initials;document.querySelector('#connection-state').textContent='Connected · '+PROJECT_REF;
    await render('overview');
  }catch(error){root.innerHTML='<section class="connection-state-card"><span class="empty-illustration">!</span><h1>Workspace setup is incomplete</h1><p>Secure access requires the approved dashboard schema and owner account bootstrap. No demo authentication or sample records are used.</p><p>'+esc(error.message||'Unable to verify this session.')+'</p><a class="button button-secondary" href="index.html">Return to sign in</a></section>';}
}
boot();

})();}