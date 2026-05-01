import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Auto-unmount after each test so screen queries don't leak across tests.
// vitest doesn't run RTL's cleanup automatically (jest does via setup-files).
afterEach(() => {
  cleanup();
});
