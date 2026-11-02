/** The gallery's style switch: default or quiet, remembered like the theme. */
import { useSyncExternalStore } from "react";
import {
  appliedStyle,
  applyStyle,
  IconButton,
  Menu,
  readStorage,
  writeStorage,
} from "../../src";
import type { StyleName } from "../../src";

export const STYLE_KEY = "workbench-gallery:style";
const listeners = new Set<() => void>();

function parseStyle(value: string | null): StyleName {
  return value === "quiet" ? "quiet" : "default";
}

/** Apply the stored style; call before the first render. */
export function applyStoredStyle(): void {
  applyStyle(parseStyle(readStorage(STYLE_KEY)));
}

/** Persist and apply a style (default clears the stored choice). */
export function setGalleryStyle(style: StyleName): void {
  writeStorage(STYLE_KEY, style === "default" ? null : style);
  applyStyle(style);
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useGalleryStyle(): StyleName {
  return useSyncExternalStore(subscribe, appliedStyle, () => "default");
}

/** Top-bar menu next to ThemeMenu: Default / Quiet. */
export function StyleMenu() {
  const style = useGalleryStyle();
  const option = (value: StyleName, label: string) => ({
    id: value,
    label,
    checked: style === value,
    onSelect: () => setGalleryStyle(value),
  });
  return (
    <Menu
      label="Style"
      items={[option("default", "Default"), option("quiet", "Quiet")]}
      trigger={(props) => (
        <IconButton {...props} icon="layers" label={`Style: ${style}`} />
      )}
    />
  );
}
