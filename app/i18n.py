"""Bilingual UI strings (English + Hindi Devanagari).

Single source of truth — both languages live next to each other so translators can scan in one
glance. Keys are flat dotted paths.
"""
from typing import Final

DEFAULT_LANG = "en"
SUPPORTED: Final[tuple[str, ...]] = ("en", "hi")
COOKIE_NAME = "baari_lang"

STRINGS: Final[dict[str, dict[str, str]]] = {
    # Top nav
    "nav.queue":    {"en": "Queue",    "hi": "क्यू"},
    "nav.search":   {"en": "Search",   "hi": "खोजें"},
    "nav.reports":  {"en": "Reports",  "hi": "रिपोर्ट"},
    "nav.settings": {"en": "Settings", "hi": "सेटिंग्स"},
    "nav.logout":   {"en": "Log out",  "hi": "लॉग आउट"},

    # Queue page
    "queue.title":          {"en": "Today's queue",           "hi": "आज का क्यू"},
    "queue.new_booking":    {"en": "New booking",             "hi": "नई बुकिंग"},
    "queue.close_day":      {"en": "Close day",               "hi": "दिन समाप्त करें"},
    "queue.waiting":        {"en": "Waiting",                 "hi": "प्रतीक्षा में"},
    "queue.now_consulting": {"en": "Now consulting",          "hi": "वर्तमान में"},
    "queue.done_today":     {"en": "Done today",              "hi": "पूरा हुआ"},
    "queue.empty_waiting":  {"en": "No one waiting right now.","hi": "कोई प्रतीक्षा में नहीं।"},
    "queue.idle":           {"en": "Idle — check in the next patient.", "hi": "खाली — अगले मरीज़ को चेक-इन करें।"},
    "queue.token":          {"en": "Token",                   "hi": "टोकन"},
    "queue.in_consult":     {"en": "In consult",              "hi": "परामर्श में"},
    "queue.mark_done":      {"en": "Mark done",               "hi": "पूरा करें"},
    "queue.add_family":     {"en": "Add family member",       "hi": "परिवारजन जोड़ें"},
    "queue.check_in":       {"en": "Check in",                "hi": "चेक-इन"},
    "queue.checked_in":     {"en": "Checked in",              "hi": "चेक-इन"},
    "queue.late":           {"en": "Late",                    "hi": "देरी"},
    "queue.done":           {"en": "Done",                    "hi": "पूरा"},
    "queue.no_show":        {"en": "No show",                 "hi": "अनुपस्थित"},
    "queue.cancelled":      {"en": "Cancelled",               "hi": "रद्द"},
    "queue.restore":        {"en": "Restore",                 "hi": "वापस"},
    "queue.undo":           {"en": "Undo",                    "hi": "वापस लें"},
    "queue.party_of":       {"en": "party of",                "hi": "के साथ"},

    # Counters
    "counter.booked":   {"en": "Booked today", "hi": "आज बुक"},
    "counter.waiting":  {"en": "Waiting",      "hi": "प्रतीक्षा"},
    "counter.done":     {"en": "Done",         "hi": "पूरा"},
    "counter.no_show":  {"en": "No-show",      "hi": "अनुपस्थित"},

    # Login
    "login.title":     {"en": "Sign in",        "hi": "लॉग इन"},
    "login.tagline":   {"en": "Baari", "hi": "बाड़ी"},
    "login.mobile":    {"en": "Mobile number",  "hi": "मोबाइल नंबर"},
    "login.password":  {"en": "Password",       "hi": "पासवर्ड"},
    "login.submit":    {"en": "Sign in",        "hi": "लॉग इन"},
    "login.forgot":    {"en": "Forgot your password? Ask your clinic admin to reset it.",
                       "hi": "पासवर्ड भूल गए? अपने क्लीनिक एडमिन से रीसेट करवाएँ।"},

    # Booking form
    "booking.title":         {"en": "New booking",          "hi": "नई बुकिंग"},
    "booking.name":          {"en": "Patient name",         "hi": "मरीज़ का नाम"},
    "booking.mobile":        {"en": "Mobile (WhatsApp)",    "hi": "मोबाइल (व्हाट्सऐप)"},
    "booking.slot":          {"en": "Slot",                 "hi": "समय"},
    "booking.patient_type":  {"en": "Patient type",         "hi": "मरीज़ का प्रकार"},
    "booking.new":           {"en": "New",                  "hi": "नया"},
    "booking.returning":     {"en": "Returning",            "hi": "पुराना"},
    "booking.party_size":    {"en": "Expected party size",  "hi": "परिवार के सदस्य"},
    "booking.reason":        {"en": "Reason for visit",     "hi": "आने का कारण"},
    "booking.opt_out":       {"en": "No WhatsApp — suppress all notifications for this patient.",
                              "hi": "व्हाट्सऐप नहीं — इस मरीज़ को कोई सूचना न भेजें।"},
    "booking.submit":        {"en": "Create booking",       "hi": "बुकिंग बनाएँ"},
    "booking.cancel":        {"en": "Cancel",               "hi": "रद्द करें"},

    # Common
    "common.reconnecting":  {"en": "Reconnecting…", "hi": "पुनः कनेक्ट हो रहे हैं…"},
    "common.cancel":        {"en": "Cancel",         "hi": "रद्द करें"},
    "common.save":          {"en": "Save",           "hi": "सहेजें"},
}


def t(key: str, lang: str = DEFAULT_LANG) -> str:
    entry = STRINGS.get(key)
    if not entry:
        return key
    return entry.get(lang) or entry.get(DEFAULT_LANG) or key


def normalize_lang(value: str | None) -> str:
    if value and value in SUPPORTED:
        return value
    return DEFAULT_LANG
