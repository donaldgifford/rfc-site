import { useTheme } from "@donaldgifford/design-system/theme";
import styles from "./ThemeToggle.module.css";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const next: "dark" | "light" = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${next} theme`}
      className={styles.toggle}
    >
      {theme === "dark" ? "Light mode" : "Dark mode"}
    </button>
  );
}
