# pawlingo · 9-email welcome and Plus sequence

Nine HTML-ready emails for new Pawlingo signups. Free daily lessons for the first five, then an invitation to Pawlingo Plus (7-day free trial, £4.99 a month) and the January launch price (£29.99 a year until 31 January).

Voice: a golden retriever who has read your diary. Every email is signed by Biscuit, Head of Barketing, and the dog's name is in every subject line. Source: `pawlingo-brand-tone-voice.md` (Live Build deck, 14 Oct 2026). Pawlingo is a fictional brand; prices and figures are illustrative.

## Sequence at a glance

| # | File | Send | Subject | Job | CTA |
|---|------|------|---------|-----|-----|
| 1 | `01-welcome-the-sigh.html` | Day 0, on signup | {{dog_name}} has been trying to tell you something | Welcome. Lesson 1 (the sigh). Set the frame: he's the teacher. | Start lesson one |
| 2 | `02-three-words-before-breakfast.html` | Day 1, 7am | Three words of {{dog_name}} before breakfast | Quick win: ears, tail, sigh. | Open today's lesson |
| 3 | `03-the-head-tilt.html` | Day 2, 7am | What {{dog_name}}'s head tilt actually means | Real behaviour lesson. Professor Alsatian and the squirrel. | Watch today's lesson |
| 4 | `04-five-minutes-whole-lesson.html` | Day 3, 7am | {{dog_name}} says: 5 minutes. That's the whole lesson. | Habit and retention. Day four is where apps die. The slow blink. | Five minutes. Go. |
| 5 | `05-training-the-wrong-one.html` | Day 5, 7am | {{dog_name}}: "You've been training the wrong one." | The reversal. First invitation to Plus. | Start your 7-day free trial |
| 6 | `06-live-translate-for-laughs.html` | Day 7, 6pm | {{dog_name}} has opinions about your ex | Live Translate demo, four blue cards from Biscuit. "For laughs" said three times. | Try Live Translate free for 7 days |
| 7 | `07-breed-packs-dialects.html` | Day 9, 7am | {{dog_name}} speaks a dialect. Which one? | The "for real" half of Plus: five breed packs. | Unlock every breed pack |
| 8 | `08-good-boy-guarantee.html` | Day 12, 7am | {{dog_name}} has a bone to pick with you | Objection handling: the cancel button. The Good Boy Guarantee. | Start the free trial. Two taps to leave. |
| 9 | `09-last-word-january.html` | Day 14, 7am | {{first_name}}, {{dog_name}} has one more thing to say | Close. £29.99 a year until 31 January. Door left open. | Get the year for £29.99 |

Alternate subject lines and preview text are in the HTML comment at the top of each file.

## Arc

Emails 1 to 4 are the free product doing its job: one real lesson each, a blue card each, five minutes each. No selling. Email 5 turns the deck's reversal hook ("you've been training the wrong one") into the first invitation. Emails 6 and 7 show the two halves of Plus: Live Translate (for laughs) and breed packs (for real). Email 8 handles the one objection the brand actually has, the cancel button. Email 9 closes on the January price and leaves the free lesson running.

Innuendo bank, one per email, all deniable: 1 "Who's a good listener?" · 4 "Heavy petting. Light learning." · 5 "He's been sniffing around your secrets." · 6 "Off the lead and on the record." · 7 "Fluent in tongue." · 8 "Got a bone to pick with you." · 9 "Ruff day? He knows." Emails 2 and 3 have none.

Running bits used: the postman (every P.S.), the vacuum, the 3am bark, the vet lie, the slow blink, the sock, Professor Alsatian's squirrel, Cat pack: still no.

## Merge tags

Replace with your email provider's syntax.

| Tag | Source | Fallback |
|-----|--------|----------|
| `{{first_name}}` | Signup form, Name | "there" is wrong for this brand. Use "Hello" and drop the name. |
| `{{dog_name}}` | Signup form, "What's your dog's name?" | **Required.** Set "your dog" as the fallback so no subject line ever renders blank. |
| `{{lesson_url}}` | Deep link to that day's lesson in the app | App store link |
| `{{trial_url}}` | Plus trial start screen | |
| `{{unsubscribe_url}}` | Provider | |
| `{{company_address}}` | Provider or static | Required for CAN-SPAM / PECR |

Pronoun: the brand copy uses "he" for the dog throughout, as the deck does. If the signup form ever captures the dog's sex, add a `{{dog_he}}` / `{{dog_his}}` tag and swap; until then this matches the deck.

## Flow and branching

```
[Signup: name, email, dog's name] --> Email 1 (Day 0)
        |
   Email 2 (Day 1) --> Email 3 (Day 2) --> Email 4 (Day 3)
        |
   Lesson completed at least once by Day 5?
        |-- Yes --> Email 5 (Day 5, Plus invitation)
        |-- No  --> Email 5 with alt subject "That sigh? It was about you, {{first_name}}."
        |          (same body; the lesson recap still holds because the free lessons exist whether or not they opened them)
        v
   Email 6 (Day 7) --> Email 7 (Day 9) --> Email 8 (Day 12) --> Email 9 (Day 14)
        |
   Started Plus trial at any point? --> [EXIT: move to Plus trial onboarding, not in this pack]
   Trial started then cancelled? --> [EXIT: suppress 8 and 9; nothing chases a cancel]
```

Exit conditions
- Trial started: exit immediately. Do not send 5 to 9. Sending "start your free trial" to someone on the trial breaks the Good Boy Guarantee tone.
- Annual purchase: exit.
- Unsubscribe: exit, obviously.

Suppressions
- Do not send 8 or 9 to anyone who has cancelled a trial. The brand's cost of the guarantee is that it means it.
- Do not run 9's January block outside January. Remove the block marked `JANUARY LAUNCH BLOCK` in the HTML for the evergreen version; the email still works as a close without it (the CTA then reads "Start your 7-day free trial" and points at `{{trial_url}}`).
- Pause the whole series if the user contacts support in the last 48 hours.

Re-entry: none. If someone deletes the app and reinstalls, they get a win-back series, not this one.

## Timing notes

- 7am local for lessons: the belief headline is "three words of Labrador before your coffee's cold." Send before coffee.
- Email 6 at 6pm: the photo style is warm evening light, phone glowing blue, dog in shot. Live Translate lands when the dog is actually on the sofa.
- Days 5 to 14 are spaced wider than 1 to 4 on purpose. The free lessons keep going daily in the app; the emails stop pretending to be the lesson and become invitations.

## Proof: still needed

The brand file is explicit: never invent a review, a behaviourist, or a number presented as real. None of these emails contain any. When you have a real review and a named behaviourist, email 7 (breed packs) is where the behaviourist belongs and email 8 (guarantee) is where the review belongs. Add them as a plain paragraph above the button. Until then, leave both out.

## A/B tests worth running

1. **Email 1 subject.** "{{dog_name}} has been trying to tell you something" vs "Lesson one is in. {{dog_name}} is already judging your accent." Measure open rate; 50/50 split; call it at 2,000 sends.
2. **Email 5 CTA.** "Start your 7-day free trial" vs "Let him talk. 7 days free." Measure trial starts, not clicks.
3. **Email 6 send time.** 6pm vs 7am. Measure trial starts within 24 hours. The hypothesis is that evening wins because the dog is in the room.

## Benchmarks

Consumer app onboarding, no paid traffic assumptions.

| Metric | Emails 1 to 4 | Emails 5 to 9 |
|--------|---------------|---------------|
| Open rate | 50 to 70% | 35 to 50% |
| Click rate | 15 to 25% | 6 to 12% |
| Unsubscribe | under 0.3% | under 0.6% |
| Trial start from the series | | 8 to 15% of signups |

Track: trial starts by email (which invitation converted), lesson completions in-app on the day each email lands, and drop-off between 4 and 5. If 4 to 5 is where people leave, the Plus invitation came too early; push 5 to Day 7.

## Set-up checklist (any email provider)

1. Create an automation triggered on signup with `dog_name` captured.
2. Set the `dog_name` fallback to "your dog".
3. Add the nine emails with the delays above. Paste each HTML file as the raw template.
4. Add the exit on trial start and the suppression after trial cancel.
5. Send a test to yourself with a real dog name. Read the subject lines on a phone. If one reads as spam, it's the one without the dog in it.

## Brand checks applied

- Dog's name in every subject line. Every email signed by Biscuit. Every email ends "Learn dog. Five minutes a day."
- Footer line verbatim from the brand file.
- Live Translate always labelled "for laughs" on the card and in the copy. Lessons labelled "for real."
- Real behaviour under every gag: settling sigh, ear and tail position, head tilt and sound localisation, slow blink as a soft signal, vacuum unease, alert bark, stiff-tail "no" in Labradors.
- No "train your dog," no "100% accurate," no loneliness, nothing about the reader's personal attributes, no competitor named, no invented reviews, behaviourists or stats.
- "Invitation," never the other word.
- Blue card in every email. Wordmark lower case. Squeaky blue #3B5BFF, Biscuit #F6B73C, Cream #FFF6E8, Ink #1D1B2E. Baloo 2 for display, DM Sans for body (Google Sans is not on Google Fonts; swap in when self-hosting).
