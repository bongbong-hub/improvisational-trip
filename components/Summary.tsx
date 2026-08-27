"use client";

import { useEffect, useState } from "react";

import type { Mission } from "@/lib/domain/session.ts";
import { getPhoto } from "@/lib/storage/photo-store.ts";

export type Overlay = { order: boolean; place: boolean; date: boolean };

const DEFAULT_OVERLAY: Overlay = { order: true, place: true, date: true };

function captionLines(mission: Mission, overlay: Overlay): string[] {
  const lines: string[] = [];
  if (overlay.order || overlay.place) {
    lines.push(
      [overlay.order ? `${mission.order_index + 1}번째` : "", overlay.place ? mission.place_name : ""]
        .filter(Boolean)
        .join(" · "),
    );
  }
  if (overlay.date && mission.completed_at) {
    lines.push(new Date(mission.completed_at).toLocaleString("ko-KR"));
  }
  return lines.filter(Boolean);
}

/**
 * 사진 위에 글자를 얹어 한 장으로 저장한다. CSS 오버레이는 화면에만 보이고 파일에는 안 남기 때문에
 * 저장 시점에 canvas 로 다시 그린다.
 */
async function downloadWithCaption(blob: Blob, mission: Mission, overlay: Overlay) {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0);

  const lines = captionLines(mission, overlay);
  if (lines.length) {
    const size = Math.round(bitmap.width / 22);
    const pad = size;
    const boxHeight = pad + lines.length * size * 1.35;
    const gradient = ctx.createLinearGradient(0, bitmap.height - boxHeight * 1.6, 0, bitmap.height);
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(1, "rgba(0,0,0,0.72)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, bitmap.height - boxHeight * 1.6, bitmap.width, boxHeight * 1.6);

    ctx.fillStyle = "#fff";
    ctx.textBaseline = "bottom";
    lines.forEach((line, i) => {
      ctx.font = `${i === 0 ? 700 : 400} ${i === 0 ? size : size * 0.72}px sans-serif`;
      ctx.fillText(line, pad, bitmap.height - pad - (lines.length - 1 - i) * size * 1.35);
    });
  }

  const output = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
  if (!output) return;

  const url = URL.createObjectURL(output);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${mission.order_index + 1}_${mission.place_name}.jpg`;
  link.click();
  URL.revokeObjectURL(url);
}

export function Summary({ missions, onRestart }: { missions: Mission[]; onRestart: () => void }) {
  const [overlay, setOverlay] = useState<Overlay>(DEFAULT_OVERLAY);
  const [photos, setPhotos] = useState<Record<string, { url: string; blob: Blob }>>({});

  const done = missions.filter((m) => m.status === "완료");

  // 사진은 여기서 처음 꺼낸다. 세션 복원 때 통째로 읽으면 쓰지도 않을 Blob 을 들고 있게 된다
  useEffect(() => {
    const urls: string[] = [];
    Promise.all(
      done.map(async (mission) => {
        const blob = mission.photo ? await getPhoto(mission.photo) : undefined;
        if (!blob) return null;
        const url = URL.createObjectURL(blob);
        urls.push(url);
        return [mission.mission_id, { url, blob }] as const;
      }),
    ).then((entries) => setPhotos(Object.fromEntries(entries.filter((e) => e !== null))));

    return () => urls.forEach(URL.revokeObjectURL);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missions]);

  return (
    <section className="panel panelFull">
      <h1 className="title">여행 기록</h1>
      <p className="sub">
        {done.length}곳을 다녀왔습니다. 사진 위에 넣을 정보를 고르고 저장하세요.
      </p>

      <div className="chips">
        {(
          [
            ["order", "순서"],
            ["place", "장소명"],
            ["date", "날짜"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            className={`chip${overlay[key] ? " chipOn" : ""}`}
            onClick={() => setOverlay({ ...overlay, [key]: !overlay[key] })}
          >
            {label}
          </button>
        ))}
      </div>

      <ul className="timeline">
        {done.map((mission) => {
          const photo = photos[mission.mission_id];
          return (
            <li key={mission.mission_id} className="shot">
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo.url} alt={mission.place_name} />
              ) : (
                <div className="shotEmpty">사진 없음</div>
              )}
              <div className="caption">
                {captionLines(mission, overlay).map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </div>
              {photo && (
                <button
                  className="secondary"
                  onClick={() => downloadWithCaption(photo.blob, mission, overlay)}
                >
                  이미지 저장
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <button className="primary" onClick={onRestart}>
        새 여행 시작
      </button>
    </section>
  );
}
