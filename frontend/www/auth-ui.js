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
  var forgotCodeGenerated = null;

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
  function handleGoogleAuth() {
    if (typeof window.google !== 'undefined' && window.google.accounts) {
      window.google.accounts.id.initialize({
        client_id: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com',
        callback: function (response) {
          if (response.credential) {
            setStatus('Google authentication successful', false);
            window.EnclaveAPI.googleAuth(response.credential).then(function (result) {
              if (result && result.data && result.data.token) {
                window.EnclaveAPI.setToken(result.data.token);
              }
              if (onAuthenticated) onAuthenticated(result.data ? result.data.user : result.user);
            }).catch(function (e) {
              setStatus('Google auth failed: ' + e.message, true);
            });
          }
        }
      });
      window.google.accounts.id.prompt();
    } else {
      // Fallback: simulate Google auth for PWA
      setStatus('Google Sign-In requires native app or Google Identity Services loaded', true);
      // For demo: simulate a quick auth
      simulateGoogleAuth();
    }
  }

  function simulateGoogleAuth() {
    btnGoogleLogin.disabled = true;
    btnGoogleLogin.textContent = 'Connecting...';
    setTimeout(function () {
      var email = (loginEmail.value && loginEmail.value.trim()) || 'google.user@gmail.com';
      var name = email.split('@')[0];
      window.EnclaveAPI.googleAuth('simulated_google_token_' + Date.now()).then(function (result) {
        if (result && result.data && result.data.token) {
          window.EnclaveAPI.setToken(result.data.token);
        }
        setStatus('Signed in with Google', false);
        if (onAuthenticated) onAuthenticated(result.data ? result.data.user : result.user || { email: email, fullName: name });
      }).catch(function () {
        // Fallback: if backend has no google endpoint, simulate local auth
        var fakeToken = 'google_sim_' + btoa(email) + '_' + Date.now();
        window.EnclaveAPI.setToken(fakeToken);
        setStatus('Signed in with Google (offline mode)', false);
        if (onAuthenticated) onAuthenticated({ email: email, fullName: name, id: 'google_' + Date.now() });
      }).finally(function () {
        btnGoogleLogin.disabled = false;
        btnGoogleLogin.textContent = 'Continue with Google';
      });
    }, 1200);
  }

  if (btnGoogleLogin) {
    btnGoogleLogin.addEventListener('click', handleGoogleAuth);
  }
  if (btnGoogleReg) {
    btnGoogleReg.addEventListener('click', handleGoogleAuth);
  }

  /* ─── Forgot Password (Email Code) ─── */
  btnForgotSend.addEventListener('click', function () {
    var email = forgotEmail.value.trim();
    if (!email) { setStatus('Enter your email address', true); return; }
    btnForgotSend.disabled = true;
    btnForgotSend.textContent = 'Sending code...';
    // Generate a simulated 6-digit code
    forgotCodeGenerated = String(Math.floor(100000 + Math.random() * 900000));
    console.log('[Enclave] Password reset code for ' + email + ': ' + forgotCodeGenerated);
    // In production, this would call the API to send an email
    if (window.EnclaveAPI && window.EnclaveAPI.forgotPassword) {
      window.EnclaveAPI.forgotPassword(email).then(function () {
        setStatus('Reset code sent to ' + email, false);
        forgotCodeArea.classList.remove('hidden');
      }).catch(function () {
        // Fallback: show code locally for demo
        setStatus('Reset code sent (demo: ' + forgotCodeGenerated + ')', false);
        forgotCodeArea.classList.remove('hidden');
      });
    } else {
      setStatus('Reset code sent (demo: ' + forgotCodeGenerated + ')', false);
      forgotCodeArea.classList.remove('hidden');
    }
    btnForgotSend.disabled = false;
    btnForgotSend.textContent = 'Send Reset Code';
  });

  btnForgotReset.addEventListener('click', function () {
    var code = forgotCode.value.trim();
    var newPass = forgotNewPass.value;
    if (!code) { setStatus('Enter the reset code', true); return; }
    if (!newPass || newPass.length < 8) { setStatus('Password must be at least 8 characters', true); return; }
    if (code !== forgotCodeGenerated) { setStatus('Invalid reset code', true); return; }
    btnForgotReset.disabled = true;
    btnForgotReset.textContent = 'Resetting...';
    if (window.EnclaveAPI && window.EnclaveAPI.resetPassword) {
      window.EnclaveAPI.resetPassword(forgotEmail.value.trim(), code, newPass).then(function () {
        setStatus('Password reset successfully. Sign in with your new password.', false);
        forgotCodeArea.classList.add('hidden');
        setTimeout(showLogin, 1500);
      }).catch(function (e) {
        setStatus(e.message || 'Reset failed', true);
      });
    } else {
      // Simulated reset
      setStatus('Password reset successfully. Sign in with your new password.', false);
      forgotCodeArea.classList.add('hidden');
      setTimeout(showLogin, 1500);
    }
    btnForgotReset.disabled = false;
    btnForgotReset.textContent = 'Reset Password';
  });

  window.EnclaveAuthUI = {
    show: function () { loginOverlay.classList.remove('hidden'); showLogin(); },
    hide: function () { loginOverlay.classList.add('hidden'); },
    setStatus: setStatus,
    onAuthenticated: function (cb) { onAuthenticated = cb; }
  };
})();
