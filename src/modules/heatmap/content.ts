/**
 * Every text of the Live Heatmap module, in one place.
 *
 * Section A is copied verbatim from the brief (section 7) and must not be
 * edited without updating the brief. Section B is UI microcopy that the brief
 * does not specify; it needs a Hebrew read-through before the first session.
 */

export interface Band {
  from: number;
  to: number;
  text: string;
}

export interface Question {
  axis: "x" | "y";
  axisLabel: string;
  question: string;
  bands: readonly Band[];
}

/* ------------------------------------------------------------------------ */
/* A. Brief, section 7 — use exactly as written                             */
/* ------------------------------------------------------------------------ */

export const OPENING_LINE = "סולם 1 עד 10, לפי מה שקורה היום בפועל. אנונימי.";

export const QUESTION_X: Question = {
  axis: "x",
  axisLabel: "שימוש אישי מתקדם ב-AI",
  question: "עד כמה AI הוא חלק מתקדם מהעבודה האישית שלי היום?",
  bands: [
    { from: 1, to: 2, text: "צ'אט מזדמן, שאלה-תשובה" },
    { from: 3, to: 4, text: "שימוש שבועי במשימות מוגדרות" },
    { from: 5, to: 6, text: "שימוש יומי עם הנחיות שבניתי" },
    { from: 7, to: 8, text: "סוכנים מבצעים עבורי רצפי עבודה" },
    { from: 9, to: 10, text: "סוכנים שאני מתכנן, מתחזק ומעריך" },
  ],
};

export const QUESTION_Y: Question = {
  axis: "y",
  axisLabel: "הובלת האנשים בשינוי",
  question: "עד כמה אני מוביל את הצוות שלי בשינוי ש-AI מביא?",
  bands: [
    { from: 1, to: 2, text: "הצוות מסתדר לבד" },
    { from: 3, to: 4, text: "עידוד ומידע כללי" },
    { from: 5, to: 6, text: "כיוון וגבולות ברורים לצוות" },
    { from: 7, to: 8, text: "שיתוף בהחלטות ושיחה על חששות" },
    { from: 9, to: 10, text: "הובלה פעילה של תפקידים ופיתוח מקצועי" },
  ],
};

export const QUADRANTS = {
  topRight: "מובילים מהחזית", // high X, high Y
  bottomRight: "השימוש שלי מקדים את הצוות", // high X, low Y
  topLeft: "הצוות לפני הכלים", // low X, high Y
  bottomLeft: "בנקודת התחלה", // low X, low Y
} as const;

export const MESSAGES = {
  submitted: "תודה, ההצבעה נקלטה",
  votingClosed: "ההצבעה הסתיימה",
} as const;

/** Display counter: "X הצביעו". */
export const VOTERS_SUFFIX = "הצביעו";
export const MEAN_LABEL = "ממוצע";

/* ------------------------------------------------------------------------ */
/* B. UI microcopy (not in the brief) — review before the first session      */
/* ------------------------------------------------------------------------ */

export const PARTICIPANT_UI = {
  submit: "שליחה",
  resubmit: "עדכון ההצבעה",
  sending: "שולח…",
  answerBoth: "בחרו ציון בשתי השאלות",
  slidePrompt: "גררו את המד או הקישו על מספר",
  sliderEmpty: "לא נבחר ציון",
  sendFailed: "השליחה לא הצליחה. בדקו את החיבור ונסו שוב.",
  offline: "אין חיבור לרשת. נסו שוב בעוד רגע.",
  notFoundTitle: "האירוע לא נמצא",
  notFoundBody: "בדקו את הקישור או סרקו שוב את הקוד.",
} as const;

export const DISPLAY_UI = {
  notFound: "האירוע לא נמצא",
  offline: "אין חיבור. מנסה להתחבר מחדש…",
  reveal: "חשיפת תוצאות",
  hide: "הסתרת תוצאות",
  closeVoting: "סגירת הצבעה",
  openVoting: "פתיחת הצבעה",
  showMean: "הצגת ממוצע",
  hideMean: "הסתרת ממוצע",
  votingClosedBadge: "ההצבעה סגורה",
  qrAlt: "קוד QR להצבעה",
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
  newEvent: "אירוע חדש",
  eventName: "שם האירוע",
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
  openDisplay: "פתיחת מסך הצגה",
  reveal: "חשיפת תוצאות",
  hide: "הסתרת תוצאות",
  closeVoting: "סגירת הצבעה",
  reopenVoting: "פתיחה מחדש",
  showMean: "הצגת ממוצע",
  hideMean: "הסתרת ממוצע",
  exportCsv: "ייצוא CSV",
  reset: "איפוס",
  delete: "מחיקה",
  cancel: "ביטול",
  resetTitle: "לאפס את האירוע?",
  resetBody: (name: string) =>
    `כל ההצבעות של "${name}" יימחקו, התוצאות יוסתרו וההצבעה תיפתח מחדש. אי אפשר לבטל את הפעולה.`,
  deleteTitle: "למחוק את האירוע?",
  deleteBody: (name: string) => `האירוע "${name}" וכל ההצבעות שלו יימחקו לצמיתות. אי אפשר לבטל את הפעולה.`,
  actionFailed: "הפעולה לא הצליחה. נסו שוב.",
  sessionExpired: "יש להזין שוב את קוד המנחה.",
  nameInvalid: "יש להזין שם באורך 1 עד 120 תווים.",
} as const;

/** CSV header: event id, X score, Y score, time (Israel time). */
export const CSV_HEADER = ["מזהה אירוע", "ציון X", "ציון Y", "זמן (שעון ישראל)"] as const;
