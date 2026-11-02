import { Auth } from './supabase.js';

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
