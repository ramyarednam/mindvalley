/*
 * 30-30-30 Fibre Challenge — page settings.
 * Everything a marketer may need to change lives here. Values marked TODO
 * are still waiting on a decision or a link.
 */
window.FIBRE_CONFIG = {
  // Where the sign-up form posts. Leave empty to skip the network call and go
  // straight to the thank-you page (useful for previews). TODO: web team to
  // connect this to the real list (Braze/CRM) before launch.
  formAction: "",

  // Thank-you page the form sends people to.
  thankYouUrl: "thank-you.html",

  // The guide people download on the thank-you page.
  guideUrl: "assets/30-30-30-Fibre-Challenge-Guide.pdf",

  // Free challenge community. TODO: paste the Finer Minds group invite link.
  communityName: "Finer Minds",
  communityUrl: "",

  // Extraordinary Minds episode with Nora Cavani. TODO: paste the YouTube
  // video ID (the part after "watch?v=").
  youtubeVideoId: "",

  // Calendar feed that holds the challenge dates and the live calls.
  // Edit calendar/fibre-challenge.ics to add the live calls; anyone who
  // subscribed picks them up automatically. Path is relative to this site.
  calendarFeedPath: "calendar/fibre-challenge.ics",

  // Challenge dates (used for the one-off "Google Calendar" fallback link).
  challengeStart: "20261116", // Monday 16 November 2026
  challengeEndExclusive: "20261216", // all-day events end the day after: Tuesday 15 December is the last day
};
