// Kakao Maps SDK 는 타입 패키지가 없다. 실제로 쓰는 것만 선언한다.
// import/export 가 없어야 전역 선언으로 취급된다 — 하나라도 넣으면 모듈이 되어 window.kakao 가 안 잡힌다.

declare namespace kakao.maps {
  class LatLng {
    constructor(lat: number, lng: number);
    getLat(): number;
    getLng(): number;
  }

  class Map {
    constructor(container: HTMLElement, options: { center: LatLng; level: number });
    panTo(latlng: LatLng): void;
    setCenter(latlng: LatLng): void;
    setLevel(level: number): void;
  }

  class Marker {
    constructor(options: { position: LatLng; map?: Map | null; title?: string });
    setMap(map: Map | null): void;
  }

  function load(callback: () => void): void;
}

interface Window {
  kakao: { maps: typeof kakao.maps };
}
