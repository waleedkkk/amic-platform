import type { AppLanguage } from "./i18n";

export function getChatDirection(language: AppLanguage) {
  return language === "ar" ? "rtl" : "ltr";
}

export function getChatTextAlignment(language: AppLanguage) {
  return language === "ar" ? "text-right" : "text-left";
}

export function getAssistantBubbleAlignment(language: AppLanguage) {
  return language === "ar" ? "justify-end" : "justify-start";
}
