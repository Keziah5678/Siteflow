"use client";
import { useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { publicEnv } from "@/lib/env";

export type MapPoint = { id: string; title: string; category: string; lat: number; lng: number; href: string };

/** Interactive map of projects (city-level coordinates only). */
export function ProjectMap({ points }: { points: MapPoint[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    let map: import("maplibre-gl").Map | null = null;
    let cancelled = false;
    (async () => {
      try {
        const maplibre = await import("maplibre-gl");
        if (cancelled || !ref.current) return;
        const m = new maplibre.Map({ container: ref.current, style: publicEnv.mapStyleUrl, center: [2.35, 46.6], zoom: 4.6, attributionControl: { compact: true } });
        map = m;
        m.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
        m.on("error", (e) => {
          if (String(e.error?.message ?? "").includes("style")) setFailed(true);
        });
        const bounds = new maplibre.LngLatBounds();
        for (const p of points) {
          const el = document.createElement("button");
          el.type = "button";
          el.className = "size-3.5 rounded-full border-2 border-white bg-[#7C3AED] shadow-[0_0_0_4px_rgba(124,58,237,0.25)]";
          el.setAttribute("aria-label", p.title);
          const popup = new maplibre.Popup({ offset: 12, closeButton: false }).setDOMContent(
            Object.assign(document.createElement("a"), { href: p.href, textContent: p.title, className: "block max-w-[220px] text-[13px] font-medium hover:underline" }),
          );
          new maplibre.Marker({ element: el }).setLngLat([p.lng, p.lat]).setPopup(popup).addTo(m);
          bounds.extend([p.lng, p.lat]);
        }
        if (points.length > 1) m.fitBounds(bounds, { padding: 60, maxZoom: 9, duration: 0 });
        else if (points.length === 1) m.jumpTo({ center: [points[0]!.lng, points[0]!.lat], zoom: 8 });
      } catch {
        setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [points]);
  if (failed) return <p className="rounded-2xl border border-border p-6 text-center text-sm text-muted">La carte n'a pas pu être chargée. Les résultats restent disponibles en liste.</p>;
  return <div ref={ref} className="h-[420px] w-full overflow-hidden rounded-2xl border border-border" role="region" aria-label="Carte des projets" />;
}
