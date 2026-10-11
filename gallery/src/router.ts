/** Minimal hash router for the gallery: "#/path?query". Plain <a href="#/..."> links work. */
import { useCallback, useSyncExternalStore } from "react";

function subscribe(listener: () => void): () => void {
  window.addEventListener("hashchange", listener);
  return () => window.removeEventListener("hashchange", listener);
}

const getHash = () => window.location.hash;

export interface Route {
  path: string;
  params: URLSearchParams;
}

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, "") || "/";
  const [path = "/", query = ""] = raw.split("?");
  return { path, params: new URLSearchParams(query) };
}

export function hrefFor(
  path: string,
  params?: Record<string, string | null | undefined>,
): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) if (v) q.set(k, v);
  const s = q.toString();
  return `#${path}${s ? `?${s}` : ""}`;
}

export function useRoute(): Route & {
  navigate: (href: string, options?: { replace?: boolean }) => void;
  setParams: (
    patch: Record<string, string | null>,
    options?: { replace?: boolean },
  ) => void;
} {
  const hash = useSyncExternalStore(subscribe, getHash, () => "");
  const route = parseHash(hash);
  const navigate = useCallback(
    (href: string, options: { replace?: boolean } = {}) => {
      if (options.replace) {
        window.history.replaceState(null, "", href);
        window.dispatchEvent(new HashChangeEvent("hashchange"));
      } else {
        window.location.hash = href.replace(/^#/, "");
      }
    },
    [],
  );
  const setParams = useCallback(
    (
      patch: Record<string, string | null>,
      options: { replace?: boolean } = {},
    ) => {
      const current = parseHash(window.location.hash);
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "") current.params.delete(k);
        else current.params.set(k, v);
      }
      const s = current.params.toString();
      navigate(`#${current.path}${s ? `?${s}` : ""}`, options);
    },
    [navigate],
  );
  return { ...route, navigate, setParams };
}
