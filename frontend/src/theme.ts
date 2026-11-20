import { readable } from "./utils";

export interface Prefs {
  theme: "dark" | "light" | "system";
  primaryColor: string;
  backgroundColor: string;
}
export const DEFAULT_PREFS: Prefs = {
  theme: "dark",
  primaryColor: "#1E90FF",
  backgroundColor: "#000000",
};

export function applyTheme(p: Prefs) {
  const dark =
    p.theme === "dark" ||
    (p.theme === "system" &&
      matchMedia("(prefers-color-scheme: dark)").matches);
  const bg = dark ? p.backgroundColor : "#F4F8FF";
  const s = document.documentElement.style;
  s.setProperty("--bg", bg);
  s.setProperty("--text", readable(bg));
  s.setProperty("--primary", p.primaryColor);
  s.setProperty("--on-primary", readable(p.primaryColor));
  s.colorScheme = dark ? "dark" : "light";
}
