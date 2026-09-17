import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { LiveFilter } from "./LiveFilter";

function ControlledLiveFilter({ initial = "" }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return <LiveFilter value={value} onChange={setValue} />;
}

describe("<LiveFilter>", () => {
  it("renders an input with the given value and the / keycap", () => {
    render(<ControlledLiveFilter initial="kubernetes" />);
    expect(screen.getByLabelText("Filter directory")).toHaveValue("kubernetes");
    expect(screen.getByText("/")).toBeInTheDocument();
  });

  it("invokes onChange with the next value when typed into", () => {
    const onChange = vi.fn();
    render(<LiveFilter value="" onChange={onChange} />);
    const input = screen.getByLabelText("Filter directory");
    fireEvent.change(input, { target: { value: "kube" } });
    expect(onChange).toHaveBeenCalledWith("kube");
  });

  it("focuses the input when `/` is pressed at the document level", () => {
    render(<ControlledLiveFilter />);
    const input = screen.getByLabelText("Filter directory");
    expect(document.activeElement).not.toBe(input);
    fireEvent.keyDown(document, { key: "/" });
    expect(document.activeElement).toBe(input);
  });

  it("does not steal focus from another input when `/` is pressed while typing", () => {
    render(
      <>
        <input type="text" aria-label="other" />
        <ControlledLiveFilter />
      </>,
    );
    const other = screen.getByLabelText("other");
    other.focus();
    fireEvent.keyDown(other, { key: "/" });
    expect(document.activeElement).toBe(other);
  });
});
