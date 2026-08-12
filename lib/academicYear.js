import { kuwaitNow } from "./kuwaitDate";

export const PRICE_PER_STUDENT_KWD = 2;

// العام الدراسي يبدأ ١ سبتمبر وينتهي ٣٠ يوليو. من أول أغسطس نعتبرها تحضير
// للعام الجاي (نفس منطق التسجيل المبكر قبل الدوام)، والدفع نفسه ما يصير
// إلزامي إلا من ١ سبتمبر (isGatingActive).
export function getAcademicYear(date = kuwaitNow()) {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const startYear = m >= 8 ? y : y - 1;
  return {
    label: `${startYear}-${startYear + 1}`,
    start: `${startYear}-09-01`,
    end: `${startYear + 1}-07-30`,
  };
}

export function computePaymentStatus({ mother, childrenCount, date = kuwaitNow() }) {
  const ay = getAcademicYear(date);
  const todayStr = date.toISOString().slice(0, 10);
  const gatingActive = todayStr >= ay.start;
  const paidForCount = mother.paid_academic_year === ay.label ? (mother.paid_for_count || 0) : 0;
  const amountDueKwd = gatingActive
    ? Math.max(0, childrenCount - paidForCount) * PRICE_PER_STUDENT_KWD
    : 0;
  return {
    active: !gatingActive || amountDueKwd <= 0,
    gatingActive,
    academicYear: ay.label,
    academicYearEnd: ay.end,
    childrenCount,
    paidForCount,
    amountDueKwd,
    pricePerStudent: PRICE_PER_STUDENT_KWD,
  };
}
