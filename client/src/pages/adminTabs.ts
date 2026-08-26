export const ADMIN_TABS = [
  { value: "overview", label: "نظرة عامة", description: "المؤشرات وحالة الخدمات" },
  { value: "users", label: "المستخدمون", description: "البحث والصلاحيات والنشاط" },
  { value: "ai", label: "الذكاء الاصطناعي", description: "مزودو النماذج والإعدادات" },
  { value: "maintenance", label: "صيانة السوق", description: "الكاش والمهام المجدولة" },
] as const;

export type AdminTabValue = (typeof ADMIN_TABS)[number]["value"];
