import { searchKeyword } from "@/lib/clients/kakao.ts";

/** 숙소 주소·상호를 좌표로 바꾼다. 브라우저에서 직접 부르면 REST 키가 노출되므로 서버를 거친다 */
export async function POST(request: Request) {
  const { query } = (await request.json()) as { query?: string };
  if (!query?.trim()) {
    return Response.json({ error: "검색어가 필요합니다." }, { status: 400 });
  }

  try {
    return Response.json({ places: await searchKeyword(query.trim()) });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 502 });
  }
}
