/* Thank-you page: personalises the greeting, wires up the add-to-calendar,
   community and video blocks from FIBRE_CONFIG, and lists the live calls
   from calendar/events.json once they are booked. */
(function () {
  "use strict";

  var config = window.FIBRE_CONFIG || {};

  // ---- Greeting ----
  var firstName = new URLSearchParams(window.location.search).get("name");
  if (firstName) {
    document.querySelectorAll("[data-first-name]").forEach(function (el) {
      el.textContent = ", " + firstName.slice(0, 40);
    });
  }

  // ---- Guide ----
  if (config.guideUrl) {
    document.querySelectorAll("[data-guide-link]").forEach(function (el) {
      el.href = config.guideUrl;
    });
  }

  // ---- Calendar ----
  var feedUrl = new URL(config.calendarFeedPath || "calendar/fibre-challenge.ics", window.location.href);
  var webcalUrl = "webcal://" + feedUrl.host + feedUrl.pathname;

  var googleOnce =
    "https://calendar.google.com/calendar/render?action=TEMPLATE" +
    "&text=" + encodeURIComponent("30-30-30 Fibre Challenge") +
    "&dates=" + (config.challengeStart || "20261116") + "/" + (config.challengeEndExclusive || "20261216") +
    "&details=" +
    encodeURIComponent(
      "30 days. 30 g of fibre a day. 30 plants a week.\n" +
        "Day 1 is Monday 16 November: measure, then make the breakfast bowl.\n" +
        "Live-call links with Nora arrive by email."
    );

  var calendarLinks = {
    google: "https://calendar.google.com/calendar/r?cid=" + encodeURIComponent(webcalUrl),
    apple: webcalUrl,
    outlook:
      "https://outlook.live.com/calendar/0/addfromweb?url=" +
      encodeURIComponent(feedUrl.href) +
      "&name=" + encodeURIComponent("30-30-30 Fibre Challenge"),
    ics: feedUrl.href,
    "google-once": googleOnce,
  };

  document.querySelectorAll("[data-cal]").forEach(function (el) {
    var link = calendarLinks[el.getAttribute("data-cal")];
    if (link) el.href = link;
    el.addEventListener("click", function () {
      markDone("calendar");
    });
  });

  // ---- Community ----
  document.querySelectorAll("[data-community-name]").forEach(function (el) {
    if (config.communityName) el.textContent = config.communityName;
  });
  document.querySelectorAll("[data-community-link]").forEach(function (el) {
    if (config.communityUrl) {
      el.href = config.communityUrl;
      el.addEventListener("click", function () {
        markDone("community");
      });
    } else {
      el.setAttribute("aria-disabled", "true");
      el.title = "Community link not set yet (FIBRE_CONFIG.communityUrl)";
    }
  });

  // ---- Video ----
  var videoId = (config.youtubeVideoId || "").trim();
  if (videoId) {
    document.querySelectorAll("[data-video]").forEach(function (el) {
      el.innerHTML = "";
      var iframe = document.createElement("iframe");
      iframe.src = "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(videoId) + "?rel=0";
      iframe.title = "Vishen Lakhiani and Nora Cavani on fibre";
      iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
      iframe.allowFullscreen = true;
      el.appendChild(iframe);
    });
  }

  // ---- Live calls from the calendar source ----
  var DATE_FORMAT = { weekday: "short", day: "numeric", month: "short" };
  var TIME_FORMAT = { hour: "numeric", minute: "2-digit", timeZoneName: "short" };

  function renderLiveCalls(events) {
    var calls = events.filter(function (event) {
      return event.start && event.start.indexOf("T") !== -1;
    });
    if (!calls.length) return;
    var list = document.querySelector("[data-date-list]");
    if (!list) return;
    var placeholder = list.children[2];
    calls.forEach(function (call) {
      var when = new Date(call.start);
      var item = document.createElement("li");
      var label = document.createElement("span");
      label.className = "when";
      label.textContent = when.toLocaleDateString(undefined, DATE_FORMAT);
      var text = document.createElement("span");
      text.textContent = call.title + ", " + when.toLocaleTimeString(undefined, TIME_FORMAT);
      item.appendChild(label);
      item.appendChild(text);
      list.insertBefore(item, placeholder);
    });
    if (placeholder) placeholder.remove();
  }

  var eventsUrl = new URL("calendar/events.json", window.location.href);
  if (window.fetch && eventsUrl.protocol.indexOf("http") === 0) {
    fetch(eventsUrl.href)
      .then(function (response) {
        return response.ok ? response.json() : null;
      })
      .then(function (data) {
        if (data && data.events) renderLiveCalls(data.events);
      })
      .catch(function () {
        /* Keep the static list. */
      });
  }

  function markDone(key) {
    var badge = document.querySelector('[data-done="' + key + '"]');
    if (badge) badge.hidden = false;
  }
})();
