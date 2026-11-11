/* Sign-up form handling for the landing page.
   Validates the form, posts it to FIBRE_CONFIG.formAction (if set), then
   sends the person to the thank-you page with their first name. */
(function () {
  "use strict";

  var config = window.FIBRE_CONFIG || {};
  var EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function goToThankYou(firstName) {
    var url = config.thankYouUrl || "thank-you.html";
    var separator = url.indexOf("?") === -1 ? "?" : "&";
    window.location.href = firstName ? url + separator + "name=" + encodeURIComponent(firstName) : url;
  }

  function handleSubmit(event) {
    event.preventDefault();
    var form = event.currentTarget;
    var errorBox = form.querySelector(".form-error");
    var button = form.querySelector("button[type=submit]");
    var firstName = form.elements.first_name.value.trim();
    var email = form.elements.email.value.trim();

    if (!firstName) {
      errorBox.textContent = "Please add your first name.";
      form.elements.first_name.focus();
      return;
    }
    if (!EMAIL_PATTERN.test(email)) {
      errorBox.textContent = "Please check your email address.";
      form.elements.email.focus();
      return;
    }
    errorBox.textContent = "";

    if (!config.formAction) {
      goToThankYou(firstName);
      return;
    }

    button.setAttribute("aria-disabled", "true");
    button.textContent = "Joining…";

    var body = new FormData(form);
    body.append("source", "fibre-challenge-landing");
    var params = new URLSearchParams(window.location.search);
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach(function (key) {
      if (params.has(key)) body.append(key, params.get(key));
    });

    fetch(config.formAction, { method: "POST", body: body })
      .then(function (response) {
        if (!response.ok) throw new Error("Sign-up failed with status " + response.status);
        goToThankYou(firstName);
      })
      .catch(function () {
        errorBox.textContent = "Something went wrong. Please try again in a moment.";
        button.removeAttribute("aria-disabled");
        button.textContent = "Join the free challenge";
      });
  }

  document.querySelectorAll("[data-signup]").forEach(function (form) {
    form.addEventListener("submit", handleSubmit);
  });
})();
