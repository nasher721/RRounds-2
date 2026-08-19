/**
 * System Labels and Icons
 * Centralized constants for medical system categorization
 */

export const SYSTEM_LABELS: Record<string, string> = {
  neuro: "Neuro",
  cv: "Cardiovascular",
  resp: "Respiratory",
  renalGU: "Renal/GU",
  gi: "GI/Nutrition",
  endo: "Endocrine",
  heme: "Hematology",
  infectious: "Infectious",
  skinLines: "Skin/Lines",
  dispo: "Disposition",
};

export const SYSTEM_LABELS_SHORT: Record<string, string> = {
  neuro: "Neuro",
  cv: "CV",
  resp: "Resp",
  renalGU: "Renal/GU",
  gi: "GI",
  endo: "Endo",
  heme: "Heme",
  infectious: "ID",
  skinLines: "Skin/Lines",
  dispo: "Dispo",
};

export const SYSTEM_ICONS: Record<string, string> = {
  neuro: "🧠",
  cv: "❤️",
  resp: "🫁",
  renalGU: "💧",
  gi: "🍽️",
  endo: "⚡",
  heme: "🩸",
  infectious: "🦠",
  skinLines: "🩹",
  dispo: "🏠",
};

export const SYSTEM_KEYS = Object.keys(SYSTEM_LABELS) as Array<keyof typeof SYSTEM_LABELS>;
