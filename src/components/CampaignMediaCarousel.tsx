import { useRef, useState, type ReactNode, type TouchEvent } from "react";
import { ChevronLeft, ChevronRight, Image as ImageIcon } from "lucide-react";

type CampaignMediaCarouselProps = {
  title: string;
  mediaItems?: string[] | null;
  mediaUrl?: string | null;
  mediaType?: string | null;
  /** Content rendered on top of the media (badges, labels). */
  overlay?: ReactNode;
  className?: string;
};

/**
 * Elegant media viewer for campaign cards: shows the whole creative (no cropping)
 * over a blurred copy of itself, with arrows, dots and swipe for carousels.
 */
export function CampaignMediaCarousel({
  title,
  mediaItems,
  mediaUrl,
  mediaType,
  overlay,
  className = "",
}: CampaignMediaCarouselProps) {
  const images = (mediaItems ?? []).filter(Boolean);
  const items = images.length ? images : mediaUrl && mediaType !== "video" ? [mediaUrl] : [];
  const [index, setIndex] = useState(0);
  const touchStart = useRef<number | null>(null);
  const current = items[Math.min(index, Math.max(items.length - 1, 0))];
  const many = items.length > 1;

  const go = (step: number) => setIndex((value) => (value + step + items.length) % items.length);

  const onTouchStart = (event: TouchEvent) => {
    touchStart.current = event.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (event: TouchEvent) => {
    if (touchStart.current == null || !many) return;
    const delta = (event.changedTouches[0]?.clientX ?? touchStart.current) - touchStart.current;
    if (Math.abs(delta) > 40) go(delta < 0 ? 1 : -1);
    touchStart.current = null;
  };

  return (
    <div
      className={`group/media relative aspect-[4/3] overflow-hidden bg-neutral-900 ${className}`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {mediaType === "video" && mediaUrl && !images.length ? (
        <video src={mediaUrl} className="h-full w-full bg-black object-contain" preload="metadata" controls />
      ) : current ? (
        <>
          <img
            src={current}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full scale-110 object-cover opacity-50 blur-2xl"
          />
          <img
            key={current}
            src={current}
            alt={many ? `${title} — foto ${index + 1} de ${items.length}` : title}
            className="relative h-full w-full object-contain drop-shadow-xl animate-in fade-in duration-300"
            loading="lazy"
          />
        </>
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
          <ImageIcon className="h-8 w-8" />
          <span className="text-xs">Sem imagem</span>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/45 to-transparent" />
      {overlay ? <div className="absolute left-3 right-3 top-3 flex flex-wrap items-center gap-1.5">{overlay}</div> : null}

      {many ? (
        <>
          <button
            type="button"
            aria-label="Foto anterior"
            onClick={() => go(-1)}
            className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-foreground shadow-md opacity-80 transition hover:bg-white hover:opacity-100 group-hover/media:opacity-100"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Próxima foto"
            onClick={() => go(1)}
            className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-foreground shadow-md opacity-80 transition hover:bg-white hover:opacity-100 group-hover/media:opacity-100"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1.5 backdrop-blur-sm">
            {items.map((item, itemIndex) => (
              <button
                key={`${item}-${itemIndex}`}
                type="button"
                aria-label={`Ver foto ${itemIndex + 1}`}
                onClick={() => setIndex(itemIndex)}
                className={`h-1.5 rounded-full transition-all ${
                  itemIndex === index ? "w-5 bg-white" : "w-1.5 bg-white/55 hover:bg-white/80"
                }`}
              />
            ))}
          </div>
          <span className="absolute bottom-3 right-3 rounded-full bg-black/45 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
            {index + 1}/{items.length}
          </span>
        </>
      ) : null}
    </div>
  );
}
