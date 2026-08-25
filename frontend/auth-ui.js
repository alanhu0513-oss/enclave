(function () {
  'use strict';

  var loginOverlay     = document.getElementById('login-overlay');
  var loginForm        = document.getElementById('login-form');
  var registerForm     = document.getElementById('register-form');
  var forgotForm       = document.getElementById('forgot-form');
  var loginEmail       = document.getElementById('login-email');
  var loginPassword    = document.getElementById('login-password');
  var btnLogin         = document.getElementById('btn-login');
  var btnGoogleLogin   = document.getElementById('btn-google-login');
  var btnGoogleReg     = document.getElementById('btn-google-register');
  var regName          = document.getElementById('reg-email-name');
  var regEmail         = document.getElementById('reg-email-addr');
  var regPassword      = document.getElementById('reg-email-password');
  var btnRegister      = document.getElementById('btn-register');
  var linkShowReg      = document.getElementById('link-show-register');
  var linkShowLogin    = document.getElementById('link-show-login');
  var linkForgotPass   = document.getElementById('link-forgot-password');
  var linkBackToLogin  = document.getElementById('link-back-to-login');
  var forgotEmail      = document.getElementById('forgot-email');
  var btnForgotSend    = document.getElementById('btn-forgot-send');
  var forgotCodeArea   = document.getElementById('forgot-code-area');
  var forgotCode       = document.getElementById('forgot-code');
  var forgotNewPass    = document.getElementById('forgot-new-password');
  var btnForgotReset   = document.getElementById('btn-forgot-reset');
  var loginStatus      = document.getElementById('login-status');
  var linkApiConfig    = document.getElementById('link-api-config');
  var apiConfigArea    = document.getElementById('api-config-area');
  var apiUrlInput      = document.getElementById('api-url-input');
  var btnApiApply      = document.getElementById('btn-api-apply');

  var onAuthenticated = null;
  var forgotEmailValue = '';

  function showLogin() { loginForm.classList.add('active'); registerForm.classList.remove('active'); forgotForm.classList.remove('active'); clearStatus(); }
  function showRegister() { registerForm.classList.add('active'); loginForm.classList.remove('active'); forgotForm.classList.remove('active'); clearStatus(); }
  function showForgot() { forgotForm.classList.add('active'); loginForm.classList.remove('active'); registerForm.classList.remove('active'); clearStatus(); forgotCodeArea.classList.add('hidden'); }

  function setStatus(msg, isError) {
    loginStatus.textContent = msg;
    loginStatus.className = 'auth-status ' + (isError ? 'failure' : 'success');
  }

  function clearStatus() { loginStatus.textContent = ''; loginStatus.className = 'auth-status'; }

  linkShowReg.addEventListener('click', function (e) { e.preventDefault(); showRegister(); });
  linkShowLogin.addEventListener('click', function (e) { e.preventDefault(); showLogin(); });
  linkForgotPass.addEventListener('click', function (e) { e.preventDefault(); showForgot(); });
  linkBackToLogin.addEventListener('click', function (e) { e.preventDefault(); showLogin(); });

  if (linkApiConfig) {
    linkApiConfig.addEventListener('click', function (e) {
      e.preventDefault();
      apiConfigArea.classList.toggle('hidden');
      apiUrlInput.value = window.EnclaveAPI.getBaseUrl();
    });
  }

  if (btnApiApply) {
    btnApiApply.addEventListener('click', function () {
      var url = apiUrlInput.value.trim();
      if (url) { window.EnclaveAPI.setBaseUrl(url); setStatus('Server URL updated', false); }
    });
  }

  btnLogin.addEventListener('click', async function () {
    var email = loginEmail.value.trim();
    var password = loginPassword.value;
    if (!email || !password) { setStatus('Email and password required', true); return; }
    btnLogin.disabled = true;
    btnLogin.textContent = 'Signing in...';
    try {
      var result = await window.EnclaveAPI.login(email, password);
      if (result && result.data && result.data.token) {
        window.EnclaveAPI.setToken(result.data.token);
      } else if (result && result.token) {
        window.EnclaveAPI.setToken(result.token);
      } else {
        throw new Error('No token in response');
      }
      setStatus('Signed in successfully', false);
      if (onAuthenticated) onAuthenticated(result.data ? result.data.user : result.user);
    } catch (e) {
      setStatus(e.message, true);
    } finally {
      btnLogin.disabled = false;
      btnLogin.textContent = 'Sign In';
    }
  });

  btnRegister.addEventListener('click', async function () {
    var name = regName.value.trim();
    var email = regEmail.value.trim();
    var password = regPassword.value;
    if (!name || !email || !password) { setStatus('All fields required', true); return; }
    if (password.length < 8) { setStatus('Password must be at least 8 characters', true); return; }
    // IKEA Effect: read shield preferences before account creation
    var shieldPrefs = {
      camera: !!document.getElementById('pref-camera')?.checked,
      voice: !!document.getElementById('pref-voice')?.checked,
      crawler: !!document.getElementById('pref-crawler')?.checked,
      ml: !!document.getElementById('pref-ml')?.checked
    };
    btnRegister.disabled = true;
    btnRegister.textContent = 'Creating account...';
    try {
      var result = await window.EnclaveAPI.register(email, password, name);
      if (result && result.data && result.data.token) {
        window.EnclaveAPI.setToken(result.data.token);
      } else if (result && result.token) {
        window.EnclaveAPI.setToken(result.token);
      } else {
        throw new Error('No token in response');
      }
      // IKEA Effect: persist user's shield preferences (they designed these!)
      localStorage.setItem('enclave_shield_prefs', JSON.stringify(shieldPrefs));
      // Goal Gradient: animate progress to 100% after account created
      var fill = document.querySelector('.onboarding-progress-fill');
      var ptext = document.querySelector('.onboarding-progress-text');
      if (fill) fill.style.width = '100%';
      if (ptext) ptext.textContent = 'Step 3 of 3 — 100% complete';
      setStatus('Account created successfully', false);
      if (onAuthenticated) onAuthenticated(result.data ? result.data.user : result.user);
    } catch (e) {
      setStatus(e.message, true);
    } finally {
      btnRegister.disabled = false;
      btnRegister.textContent = 'Create Account';
    }
  });

  /* ─── Google Sign-In ─── */
  function getGoogleClientId() {
    var meta = document.querySelector('meta[name="google-client-id"]');
    return meta ? meta.getAttribute('content') : '';
  }

  async function handleGoogleCredential(credential) {
    try {
      setStatus('Signing in with Google...', false);
      var result = await window.EnclaveAPI.googleAuth(credential);
      if (result && result.data && result.data.token) {
        window.EnclaveAPI.setToken(result.data.token);
      } else if (result && result.token) {
        window.EnclaveAPI.setToken(result.token);
      } else {
        throw new Error('No token in response');
      }
      setStatus('Signed in with Google', false);
      if (onAuthenticated) onAuthenticated(result.data ? result.data.user : result.user);
    } catch (e) {
      setStatus(e.message || 'Google sign-in failed', true);
    }
  }

  function initGoogleSignIn() {
    var clientId = getGoogleClientId();
    if (!clientId || clientId === 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com') return;
    if (typeof google === 'undefined' || !google.accounts) return;

    google.accounts.id.initialize({
      client_id: clientId,
      callback: function (response) {
        if (response.credential) handleGoogleCredential(response.credential);
      },
      auto_select: false
    });

    if (btnGoogleLogin) {
      btnGoogleLogin.addEventListener('click', function () {
        google.accounts.id.prompt(function (notification) {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            google.accounts.id.renderButton(btnGoogleLogin.parentElement, {
              theme: 'outline', size: 'large', width: btnGoogleLogin.offsetWidth || 320, type: 'standard',
              text: 'continue_with', shape: 'rectangular'
            });
          }
        });
      });
    }

    if (btnGoogleReg) {
      btnGoogleReg.addEventListener('click', function () {
        google.accounts.id.prompt();
      });
    }
  }

  if (btnGoogleLogin) {
    btnGoogleLogin.addEventListener('click', function () {
      if (!getGoogleClientId() || getGoogleClientId() === 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com') {
        setStatus('Google Sign-In: set GOOGLE_CLIENT_ID in index.html meta tag', true);
        return;
      }
      if (typeof google === 'undefined' || !google.accounts) {
        setStatus('Google Identity Services not loaded. Check your connection.', true);
        return;
      }
    });
  }
  if (btnGoogleReg) {
    btnGoogleReg.addEventListener('click', function () {
      if (!getGoogleClientId() || getGoogleClientId() === 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com') {
        setStatus('Google Sign-In: set GOOGLE_CLIENT_ID in index.html meta tag', true);
        return;
      }
      if (typeof google === 'undefined' || !google.accounts) {
        setStatus('Google Identity Services not loaded. Check your connection.', true);
        return;
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGoogleSignIn);
  } else {
    setTimeout(initGoogleSignIn, 100);
  }

  /* ─── Forgot Password (Email Code) ─── */
  btnForgotSend.addEventListener('click', async function () {
    var email = forgotEmail.value.trim();
    if (!email) { setStatus('Enter your email address', true); return; }
    forgotEmailValue = email;
    btnForgotSend.disabled = true;
    btnForgotSend.textContent = 'Sending code...';
    try {
      await window.EnclaveAPI.forgotPassword(email);
      setStatus('Reset code sent to ' + email + '. Check your inbox.', false);
      forgotCodeArea.classList.remove('hidden');
    } catch (e) {
      if (e.message && e.message.includes('not found')) {
        setStatus('If that email is registered, a reset code has been sent.', false);
        forgotCodeArea.classList.remove('hidden');
      } else {
        setStatus(e.message || 'Failed to send reset code. Try again.', true);
      }
    } finally {
      btnForgotSend.disabled = false;
      btnForgotSend.textContent = 'Send Reset Code';
    }
  });

  btnForgotReset.addEventListener('click', async function () {
    var code = forgotCode.value.trim();
    var newPass = forgotNewPass.value;
    if (!code) { setStatus('Enter the reset code', true); return; }
    if (!newPass || newPass.length < 8) { setStatus('Password must be at least 8 characters', true); return; }
    btnForgotReset.disabled = true;
    btnForgotReset.textContent = 'Resetting...';
    try {
      await window.EnclaveAPI.resetPassword(forgotEmailValue, code, newPass);
      setStatus('Password reset successfully. Sign in with your new password.', false);
      forgotCodeArea.classList.add('hidden');
      setTimeout(showLogin, 1500);
    } catch (e) {
      setStatus(e.message || 'Reset failed — check your code and try again.', true);
    } finally {
      btnForgotReset.disabled = false;
      btnForgotReset.textContent = 'Reset Password';
    }
  });

  window.EnclaveAuthUI = {
    show: function () { loginOverlay.classList.remove('hidden'); showLogin(); },
    hide: function () { loginOverlay.classList.add('hidden'); },
    setStatus: setStatus,
    onAuthenticated: function (cb) { onAuthenticated = cb; }
  };
})();
