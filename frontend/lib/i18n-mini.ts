// Tiny English-Hindi vocabulary used only by the public /b/[token] booking
// flow. Full app-chrome translation is a v2 task (see PRD §14); this is
// just the customer-facing surface where Hindi matters most.

export type Lang = "en" | "hi";

const STR = {
  // C1
  pick_time:        { en: "Pick a time",                hi: "समय चुनें" },
  today:            { en: "Today",                       hi: "आज" },
  tomorrow:         { en: "Tomorrow",                    hi: "कल" },
  fully_booked:     { en: "Fully booked today.",         hi: "आज सभी स्लॉट भर चुके हैं।" },
  see_tomorrow:     { en: "See tomorrow's slots",        hi: "कल के स्लॉट देखें" },
  closed_today:     { en: "Closed today.",               hi: "आज बंद है।" },
  next_open:        { en: "Next open day",               hi: "अगला खुला दिन" },
  no_slots:         { en: "No slots available — please call the business.", hi: "कोई स्लॉट उपलब्ध नहीं — कृपया कॉल करें।" },
  continue:         { en: "Continue",                    hi: "आगे बढ़ें" },
  open_maps:        { en: "Open in Maps",                hi: "मैप्स में खोलें" },
  link_expired_title: { en: "This link has expired.",    hi: "यह लिंक समाप्त हो गया है।" },
  link_expired_body:  { en: "Please call",               hi: "कृपया कॉल करें" },
  link_expired_call:  { en: "again to get a new one.",   hi: "ताकि नया लिंक मिल सके।" },
  call_now:         { en: "Call now",                    hi: "अभी कॉल करें" },
  // C2
  almost_done:      { en: "Almost done",                 hi: "बस एक कदम और" },
  your_name:        { en: "Your name",                   hi: "आपका नाम" },
  whats_it_for:     { en: "What's it for?",              hi: "किसके लिए?" },
  first_visit:      { en: "First visit",                 hi: "पहली बार" },
  confirm_booking:  { en: "Confirm booking",             hi: "बुकिंग पक्की करें" },
  sms_confirm_note: { en: "You'll get an SMS confirmation.", hi: "आपको SMS पर पुष्टि मिलेगी।" },
  other:            { en: "Other",                       hi: "अन्य" },
  // C3
  youre_booked:     { en: "You're booked",               hi: "आपकी बुकिंग पक्की है" },
  add_to_calendar:  { en: "Add to calendar",             hi: "कैलेंडर में जोड़ें" },
  get_directions:   { en: "Get directions",              hi: "रास्ता" },
  call_business:    { en: "Call business",               hi: "कॉल करें" },
  see_live_status:  { en: "See live status",             hi: "लाइव स्थिति देखें" },
  need_to_cancel:   { en: "Need to cancel?",             hi: "रद्द करना है?" },
  cancel_booking:   { en: "Cancel booking",              hi: "बुकिंग रद्द करें" },
  sent_to:          { en: "We sent these details to",    hi: "ये जानकारी यहाँ भेजी गई:" },
  // C4
  youre_position:   { en: "You're #",                    hi: "आपकी बारी #" },
  in_queue:         { en: "in queue",                    hi: "" },
  youre_next:       { en: "You're next",                 hi: "आपकी अगली बारी है" },
  your_turn:        { en: "It's your turn — please go in.", hi: "आपकी बारी है — अंदर जाइए।" },
  in_session_now:   { en: "In session",                  hi: "सत्र चल रहा है" },
  all_done:         { en: "All done",                    hi: "हो गया" },
  estimated_wait:   { en: "~{{n}} min wait",             hi: "लगभग {{n}} मिनट इंतज़ार" },
  updating:         { en: "Updating…",                   hi: "अपडेट हो रहा है…" },
  waiting_help:     { en: "We'll text you when you're next.", hi: "जब आपकी बारी आएगी हम SMS भेजेंगे।" },
  next_help:        { en: "Please be at the location now.", hi: "कृपया अभी पहुँचें।" },
  cancelled_state:  { en: "Booking cancelled",           hi: "बुकिंग रद्द कर दी गई" },
  // C5
  cancel_q:         { en: "Cancel this booking?",        hi: "क्या यह बुकिंग रद्द करें?" },
  reason_optional:  { en: "Reason (optional)",           hi: "कारण (वैकल्पिक)" },
  keep_booking:     { en: "Keep booking",                hi: "बुकिंग रखें" },
  cancelled_done:   { en: "Booking cancelled.",          hi: "बुकिंग रद्द हो गई।" },
  cancelled_rebook: { en: "Call",                        hi: "कॉल करें" },
  cancelled_rebook2:{ en: "if you want to rebook.",      hi: "फिर से बुक करने के लिए।" },
  // Misc
  powered_by:       { en: "Powered by",                  hi: "Powered by" },
} as const;

export type StrKey = keyof typeof STR;

export function t(key: StrKey, lang: Lang = "en", vars?: Record<string, string | number>): string {
  let raw = (STR[key]?.[lang] ?? STR[key]?.en ?? key) as string;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      raw = raw.replace(`{{${k}}}`, String(v));
    }
  }
  return raw;
}

export function readLang(searchParams: { lang?: string }): Lang {
  return searchParams?.lang === "hi" ? "hi" : "en";
}
