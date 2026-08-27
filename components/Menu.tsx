"use client";


import type { Accommodation, Mission } from "@/lib/domain/session.ts";
import { AccommodationSearch } from "./Setup";

type Props = {
  accommodation: Accommodation | null;
  /** 못 가서 접어둔 곳들. Mission 의 status 가 "스킵됨" 인 것이다 */
  wishlist: Mission[];
  onSetAccommodation: (place: Accommodation) => void;
  onRemoveWish: (missionId: string) => void;
  onHome: () => void;
  /** 홈에서도 위시리스트를 바로 열 수 있어야 해서 열림 상태는 바깥이 쥔다 */
  panel: Panel | null;
  setPanel: (panel: Panel | null) => void;
};

export type Panel = "menu" | "wishlist" | "accommodation";

export function Menu({
  accommodation,
  wishlist,
  onSetAccommodation,
  onRemoveWish,
  onHome,
  panel,
  setPanel,
}: Props) {

  if (!panel) {
    return (
      <button className="hamburger" onClick={() => setPanel("menu")} aria-label="메뉴 열기">
        <span />
        <span />
        <span />
      </button>
    );
  }

  return (
    <div className="sheet">
      <div className="sheetBar">
        <button
          className="sheetBack"
          onClick={() => (panel === "menu" ? setPanel(null) : setPanel("menu"))}
        >
          {panel === "menu" ? "닫기" : "메뉴로"}
        </button>
      </div>

      {panel === "menu" && (
        <nav className="menuList">
          <button className="menuItem" onClick={onHome}>
            <strong>홈</strong>
            <span className="meta">지난 여행 보기</span>
          </button>
          <button className="menuItem" onClick={() => setPanel("wishlist")}>
            <strong>위시리스트</strong>
            <span className="meta">{wishlist.length}곳</span>
          </button>
          <button className="menuItem" onClick={() => setPanel("accommodation")}>
            <strong>숙소</strong>
            <span className="meta">{accommodation ? accommodation.address : "등록 안 됨"}</span>
          </button>
        </nav>
      )}

      {panel === "wishlist" && (
        <>
          <h2 className="title">위시리스트</h2>
          {wishlist.length === 0 ? (
            <p className="sub">아직 없습니다. 미션에서 못 간 곳을 담으면 여기 모입니다.</p>
          ) : (
            <ul className="cards">
              {wishlist.map((mission) => (
                <li key={mission.mission_id} className="wishRow">
                  <div className="wishText">
                    <strong>{mission.place_name}</strong>
                    <span className="meta">{mission.category}</span>
                  </div>
                  <button
                    className="secondary"
                    onClick={() => onRemoveWish(mission.mission_id)}
                    aria-label={`${mission.place_name} 지우기`}
                  >
                    지우기
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {panel === "accommodation" && (
        <>
          <h2 className="title">숙소</h2>
          {accommodation && <p className="meta">지금: {accommodation.address}</p>}
          <AccommodationSearch
            onDone={(place) => {
              onSetAccommodation(place);
              setPanel("menu");
            }}
          />
        </>
      )}
    </div>
  );
}
