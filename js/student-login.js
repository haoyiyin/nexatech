/**
 * Student Login Modal
 * Shows a modal on the static site that authenticates directly against the mail app.
 * Lightweight integration - no framework dependencies.
 */
(function () {
  var MAILBOX_URL = 'https://www.nexatech.edu.kg/mail';

  function init() {
    var triggers = document.querySelectorAll('.student-login');
    for (var i = 0; i < triggers.length; i++) {
      triggers[i].addEventListener('click', function (e) {
        e.preventDefault();
        showModal();
      });
    }
  }

  function showModal() {
    if (document.getElementById('studentLoginModal')) return;

    var overlay = document.createElement('div');
    overlay.id = 'studentLoginModal';
    overlay.className = 'sl-overlay';
    overlay.onclick = function (e) {
      if (e.target === overlay) hideModal();
    };

    overlay.innerHTML =
      '<div class="sl-modal">' +
        '<div class="sl-modal-header">' +
          '<h3>Nexatech Student Mail</h3>' +
          '<button class="sl-close" aria-label="Close">&times;</button>' +
        '</div>' +
        '<div class="sl-modal-body">' +
          '<form id="slForm">' +
            '<div class="sl-field">' +
              '<label for="slEmailPrefix">Student Username</label>' +
              '<div class="sl-email-input">' +
                '<input type="text" id="slEmailPrefix" placeholder="student" required />' +
                '<span class="sl-email-suffix">@nexatech.edu.kg</span>' +
              '</div>' +
            '</div>' +
            '<div class="sl-field">' +
              '<label for="slPassword">Password</label>' +
              '<input type="password" id="slPassword" placeholder="Enter your password" required />' +
            '</div>' +
            '<div id="slError" class="sl-error" style="display:none;" aria-live="polite"></div>' +
            '<button type="submit" class="sl-submit">Sign In</button>' +
          '</form>' +
          '<p class="sl-footer-text">Contact IT support if you forgot your credentials</p>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);
    document.body.classList.add('sl-modal-open');

    var closeButton = overlay.querySelector('.sl-close');
    var form = document.getElementById('slForm');
    var emailPrefixInput = document.getElementById('slEmailPrefix');
    var passwordInput = document.getElementById('slPassword');
    var errorEl = document.getElementById('slError');
    var submitButton = form.querySelector('.sl-submit');

    closeButton.onclick = hideModal;
    document.addEventListener('keydown', escHandler);

    form.onsubmit = async function (e) {
      e.preventDefault();

      var emailPrefix = emailPrefixInput.value.trim().toLowerCase();
      var email = emailPrefix ? emailPrefix + '@nexatech.edu.kg' : '';
      var password = passwordInput.value;

      hideError(errorEl);

      if (!emailPrefix || !/^[a-z0-9._-]+$/i.test(emailPrefix)) {
        showError(errorEl, 'Please enter a valid student username.');
        emailPrefixInput.focus();
        return;
      }

      if (!password) {
        showError(errorEl, 'Please enter your password.');
        passwordInput.focus();
        return;
      }

      setSubmittingState(emailPrefixInput, passwordInput, submitButton, true);

      try {
        var response = await fetch(MAILBOX_URL + '/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'same-origin',
          body: JSON.stringify({
            email: email,
            password: password
          })
        });

        var result = await response.json().catch(function () {
          return null;
        });

        if (!response.ok || !result || !result.success) {
          showError(
            errorEl,
            (result && result.error) || 'Unable to sign in right now. Please try again.'
          );
          passwordInput.value = '';
          passwordInput.focus();
          return;
        }

        submitButton.textContent = 'Opening mailbox...';
        window.location.href = MAILBOX_URL;
      } catch (_) {
        showError(errorEl, 'Unable to sign in right now. Please try again.');
        passwordInput.value = '';
        passwordInput.focus();
      } finally {
        setSubmittingState(emailPrefixInput, passwordInput, submitButton, false);
      }
    };

    setTimeout(function () {
      emailPrefixInput.focus();
    }, 100);
  }

  function shouldAutoOpenModal() {
    return new URLSearchParams(window.location.search).get('mail_login') === '1';
  }

  function updateFooterYear() {
    var years = document.querySelectorAll('.current-year');
    var currentYear = String(new Date().getFullYear());
    for (var i = 0; i < years.length; i++) {
      years[i].textContent = currentYear;
    }
  }

  function setSubmittingState(emailPrefixInput, passwordInput, submitButton, isSubmitting) {
    emailPrefixInput.disabled = isSubmitting;
    passwordInput.disabled = isSubmitting;
    submitButton.disabled = isSubmitting;
    submitButton.textContent = isSubmitting ? 'Signing in...' : 'Sign In';
  }

  function showError(errorEl, message) {
    errorEl.textContent = message;
    errorEl.style.display = 'block';
  }

  function hideError(errorEl) {
    errorEl.textContent = '';
    errorEl.style.display = 'none';
  }

  function hideModal() {
    var modal = document.getElementById('studentLoginModal');
    if (modal) {
      modal.remove();
      document.body.classList.remove('sl-modal-open');
      document.removeEventListener('keydown', escHandler);
    }
  }

  function escHandler(e) {
    if (e.key === 'Escape') hideModal();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      init();
      updateFooterYear();
      if (shouldAutoOpenModal()) {
        showModal();
      }
    });
  } else {
    init();
    updateFooterYear();
    if (shouldAutoOpenModal()) {
      showModal();
    }
  }
})();
