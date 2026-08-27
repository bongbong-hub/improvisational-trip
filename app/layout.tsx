import type { Metadata } from "next";
import "./globals.css";

/*
 * next/font 를 쓰지 않고 link 로 받는다 — 한글 폰트는 unicode-range 서브셋이 수백 개라
 * turbopack 이 폰트 파일을 못 풀고 "Can't resolve .../internal/font/google/font" 로 죽는다.
 */
const FONTS =
  "https://fonts.googleapis.com/css2?family=Hahmlet:wght@600;700" +
  "&family=IBM+Plex+Sans+KR:wght@400;500;600" +
  "&family=IBM+Plex+Mono:wght@400;500&display=swap";

export const metadata: Metadata = {
  title: "다트 트립",
  description: "다트로 지역을 정하고 한 곳씩 열어가는 여행 미션 앱",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={FONTS} />
      </head>
      <body>{children}</body>
    </html>
  );
}
