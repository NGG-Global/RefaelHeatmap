/**
 * Every text of the Live Heatmap module, in one place.
 *
 * Section A is copied from development brief V5 (28 Oct 2026), whose wording
 * is identical to the slide "שתי שאלות למפת החום" of 28 Oct. Do not edit it
 * without updating the brief. Section B is UI microcopy the brief does not
 * specify; it needs a Hebrew read-through before the first session.
 */

export interface Band {
  from: number;
  to: number;
  text: string;
}

export interface Question {
  axis: "x" | "y";
  /** The slide's column tag, e.g. "ציר X". */
  axisTag: string;
  /** Shown as the question itself (the brief: no extra question line). */
  axisLabel: string;
  /** Optional question line and note; empty in V5, shown only when set. */
  text?: string;
  note?: string;
  bands: readonly Band[];
}

/* ------------------------------------------------------------------------ */
/* A. Brief V5 / slide of 28 Oct 2026 — use exactly as written              */
/* ------------------------------------------------------------------------ */

export const OPENING_LINE = "סולם 1 עד 10, לפי מה שקורה היום בפועל. אנונימי.";

export const QUESTION_X: Question = {
  axis: "x",
  axisTag: "ציר X",
  axisLabel: "שימוש אישי ב-AI בעולמות התוכן המקצועיים",
  bands: [
    { from: 1, to: 2, text: "כמעט ולא" },
    { from: 3, to: 4, text: "מדי פעם, במשימות פשוטות" },
    { from: 5, to: 6, text: "כל יום, במשימות שגרתיות" },
    { from: 7, to: 8, text: "כל יום, במשימות שגרתיות ומורכבות" },
    { from: 9, to: 10, text: "בכל שלבי העבודה, בשיטה קבועה ומבוקרת" },
  ],
};

export const QUESTION_Y: Question = {
  axis: "y",
  axisTag: "ציר Y",
  axisLabel: "ניהול והובלת צוותים בעידן AI",
  bands: [
    { from: 1, to: 2, text: "עוד לא מטפל בזה כמנהל" },
    { from: 3, to: 4, text: "מעודד שימוש, בלי כללים מוגדרים" },
    { from: 5, to: 6, text: "מעודד שימוש וקובע לצוות כללי עבודה ברורים" },
    { from: 7, to: 8, text: "מעודד, מגדיר כללים, משימות ומלווה כל עובד אישית בשינוי" },
    {
      from: 9,
      to: 10,
      text: "מעודד שימוש קבוע ומייצר תשתיות עבודה, משנה הגדרות תפקידים, פרופיל גיוס וחלוקת זמן למשימות",
    },
  ],
};

export const QUADRANTS = {
  topRight: "מובילים מהחזית", // high X, high Y
  bottomRight: "השימוש האישי מקדים את הניהול", // high X, low Y
  topLeft: "הניהול מקדים את הכלים", // low X, high Y
  bottomLeft: "בנקודת התחלה", // low X, low Y
} as const;

export const MESSAGES = {
  submitted: "תודה, ההצבעה נקלטה",
  votingClosed: "ההצבעה הסתיימה",
} as const;

/** Display counter: "X הצביעו". */
export const VOTERS_SUFFIX = "הצביעו";
export const MEAN_LABEL = "ממוצע";

/** Legend under the map. */
export const LEGEND = {
  less: "פחות צפוף",
  more: "יותר צפוף",
  dot: "נקודה אחת = משיב אחד",
} as const;

/** Host control labels, as listed in the brief. */
export const CONTROLS = {
  reveal: "חשוף תוצאות",
  hide: "הסתר",
  closeVoting: "סגור הצבעה",
  showMean: "הצג ממוצע",
  hideMean: "הסתר ממוצע",
  showDots: "הצג נקודות",
  hideDots: "הסתר נקודות",
  reset: "אפס אירוע",
  newEvent: "אירוע חדש",
} as const;

/* ------------------------------------------------------------------------ */
/* B. UI microcopy (not in the brief) — review before the first session      */
/* ------------------------------------------------------------------------ */

export const PARTICIPANT_UI = {
  submit: "שליחה",
  resubmit: "עדכון ההצבעה",
  sending: "שולח…",
  answerBoth: "בחרו ציון בשתי השאלות",
  slidePrompt: "גררו את העיגול ימינה או שמאלה, או הקישו על מספר",
  sliderEmpty: "לא נבחר ציון",
  sendFailed: "השליחה לא הצליחה. בדקו את החיבור ונסו שוב.",
  offline: "אין חיבור לרשת. נסו שוב בעוד רגע.",
  notFoundTitle: "האירוע לא נמצא",
  notFoundBody: "בדקו את הקישור או סרקו שוב את הקוד.",
} as const;

export const DISPLAY_UI = {
  notFound: "האירוע לא נמצא",
  offline: "אין חיבור. מנסה להתחבר מחדש…",
  reveal: CONTROLS.reveal,
  hide: CONTROLS.hide,
  closeVoting: CONTROLS.closeVoting,
  openVoting: "פתח הצבעה",
  showMean: CONTROLS.showMean,
  hideMean: CONTROLS.hideMean,
  showDots: CONTROLS.showDots,
  hideDots: CONTROLS.hideDots,
  reset: CONTROLS.reset,
  resetConfirm: "לאשר איפוס?",
  votingClosedBadge: "ההצבעה סגורה",
  qrAlt: "קוד QR להצבעה",
  mapAlt: "מפת חום של ההצבעות",
  hostControls: "שליטת מנחה",
  backToConsole: "חזרה לניהול",
} as const;

export const HOST_UI = {
  title: "מפת חום",
  subtitle: "ניהול אירועים",
  pinLabel: "קוד מנחה",
  signIn: "כניסה",
  signOut: "יציאה",
  pinWrong: "הקוד שגוי.",
  pinLocked: "יותר מדי ניסיונות שגויים. נסו שוב בעוד דקה.",
  pinNotConfigured: "קוד המנחה עדיין לא הוגדר במערכת.",
  newEvent: CONTROLS.newEvent,
  eventName: "שם האירוע, למשל: סדנת מנהלים 02.11",
  create: "יצירה",
  events: "אירועים",
  noEvents: "אין אירועים עדיין.",
  code: "קוד",
  created: "נוצר",
  voters: "הצביעו",
  link: "קישור למשתתפים",
  open: "הצבעה פתוחה",
  closed: "הצבעה סגורה",
  revealed: "תוצאות גלויות",
  hidden: "תוצאות מוסתרות",
  meanOn: "ממוצע מוצג",
  dotsOff: "נקודות מוסתרות",
  openDisplay: "פתיחת מסך הצגה",
  reveal: CONTROLS.reveal,
  hide: CONTROLS.hide,
  closeVoting: CONTROLS.closeVoting,
  reopenVoting: "פתח הצבעה",
  showMean: CONTROLS.showMean,
  hideMean: CONTROLS.hideMean,
  showDots: CONTROLS.showDots,
  hideDots: CONTROLS.hideDots,
  exportCsv: "ייצוא CSV",
  reset: CONTROLS.reset,
  delete: "מחיקה",
  cancel: "ביטול",
  resetTitle: "לאפס את האירוע?",
  resetBody: (name: string) =>
    `כל ההצבעות של "${name}" יימחקו, התוצאות יוסתרו וההצבעה תיפתח מחדש. אי אפשר לבטל את הפעולה. כדי לשמור את התוצאות, ייצאו CSV לפני האיפוס.`,
  deleteTitle: "למחוק את האירוע?",
  deleteBody: (name: string) => `האירוע "${name}" וכל ההצבעות שלו יימחקו לצמיתות. אי אפשר לבטל את הפעולה.`,
  actionFailed: "הפעולה לא הצליחה. נסו שוב.",
  sessionExpired: "יש להזין שוב את קוד המנחה.",
  nameInvalid: "יש להזין שם באורך 1 עד 120 תווים.",
} as const;

/** CSV header: event id, X score, Y score, time (Israel time). */
export const CSV_HEADER = ["מזהה אירוע", "ציון X", "ציון Y", "זמן (שעון ישראל)"] as const;
