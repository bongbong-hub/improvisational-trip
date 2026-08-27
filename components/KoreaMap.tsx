"use client";

import { useRef } from "react";

import { DEMO_AREA_LABEL, DEMO_BBOX } from "@/lib/config.ts";
import type { Point } from "@/lib/domain/geo.ts";
import { JEJU_PATH, MAINLAND_PATH, MAP_H, MAP_W, project, unproject } from "@/lib/domain/korea.ts";
import type { RegionCandidate } from "@/lib/domain/scoring.ts";

const target = {
  topLeft: project({ lat: DEMO_BBOX.maxLat, lng: DEMO_BBOX.minLng }),
  bottomRight: project({ lat: DEMO_BBOX.minLat, lng: DEMO_BBOX.maxLng }),
  center: project({
    lat: (DEMO_BBOX.minLat + DEMO_BBOX.maxLat) / 2,
    lng: (DEMO_BBOX.minLng + DEMO_BBOX.maxLng) / 2,
  }),
  get reach() {
    return Math.max(
      this.bottomRight.x - this.topLeft.x,
      this.bottomRight.y - this.topLeft.y,
    ) / 2;
  },
};

type Props = {
  /** 다트가 꽂힌 곳 또는 직접 찍은 곳 */
  point: Point | null;
  /** 다트로 던졌을 때만 낙하 애니메이션을 튼다 */
  animateDrop: boolean;
  /** 서울 서부 조준 링. 다트 모드에서만 켠다 */
  showTarget: boolean;
  candidates: RegionCandidate[];
  selectedName: string | null;
  onPickPoint?: (p: Point) => void;
};

export default function KoreaMap({
  point,
  animateDrop,
  showTarget,
  candidates,
  selectedName,
  onPickPoint,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  /** 화면 좌표를 뷰박스 좌표로 되돌린다 — 컨테이너 크기나 여백에 무관하다 */
  function handleClick(event: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg || !onPickPoint) return;
    const screen = new DOMPoint(event.clientX, event.clientY);
    const local = screen.matrixTransform(svg.getScreenCTM()!.inverse());
    onPickPoint(unproject(local.x, local.y));
  }

  const marker = point ? project(point) : null;

  return (
    <div className="mapWrap">
      <svg
        ref={svgRef}
        className={`korea${onPickPoint ? " koreaPickable" : ""}`}
        viewBox={`0 0 ${MAP_W.toFixed(1)} ${MAP_H.toFixed(1)}`}
        onClick={handleClick}
        role={onPickPoint ? "button" : "img"}
        aria-label={onPickPoint ? "지도를 눌러 지역 고르기" : "남한 지도"}
      >
        <path className="landmass" d={MAINLAND_PATH} />
        <path className="landmass" d={JEJU_PATH} />

        {showTarget && (
          <g className="aim">
            {/* 링은 범위 사각형을 감싸야 한다. bbox 가 바뀌면 반지름도 따라 움직인다 */}
            {[1.45, 1.1, 0.78].map((k) => (
              <circle key={k} cx={target.center.x} cy={target.center.y} r={target.reach * k} />
            ))}
            <rect
              className="aimBox"
              x={target.topLeft.x}
              y={target.topLeft.y}
              width={target.bottomRight.x - target.topLeft.x}
              height={target.bottomRight.y - target.topLeft.y}
            />
            <text
              className="aimLabel"
              x={target.center.x + target.reach * 1.6}
              y={target.center.y + 3}
            >
              {DEMO_AREA_LABEL}
            </text>
          </g>
        )}

        {candidates.map((candidate) => {
          const { x, y } = project(candidate);
          return (
            <circle
              key={candidate.name}
              className={`spot${selectedName === candidate.name ? " spotOn" : ""}`}
              cx={x}
              cy={y}
              r={4}
            />
          );
        })}

        {/* 지도가 화면 폭에 맞춰 크게 축소되므로 표식은 뷰박스 기준으로 키워 둔다 */}
        {marker && (
          <g transform={`translate(${marker.x} ${marker.y}) scale(2.4)`}>
            {animateDrop ? (
              // key 가 바뀌면 노드가 새로 붙어 낙하 애니메이션이 다시 돈다. 재생용 state 가 필요 없다
              <g key={`${point!.lat},${point!.lng}`} className="dart dartDropping">
                <polygon className="dartFlight" points="-9,-46 0,-30 9,-46 0,-40" />
                <rect className="dartShaft" x={-1.5} y={-44} width={3} height={38} />
                <polygon className="dartTip" points="0,0 -3,-8 3,-8" />
              </g>
            ) : (
              // 직접 고른 곳은 던진 것이 아니다. 다트 대신 핀으로 구분한다
              <g className="pin">
                <path d="M0 0 L-6 -14 A6 6 0 1 1 6 -14 Z" />
                <circle cx={0} cy={-18} r={2.4} />
              </g>
            )}
          </g>
        )}
      </svg>
    </div>
  );
}
