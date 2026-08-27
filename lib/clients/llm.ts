// OpenRouter 래퍼. 서버에서만 import 한다 — 키가 클라이언트 번들에 실리면 안 된다.
// 최종본에서 Claude API 로 갈아끼우는 것이 전제라 이 파일 밖으로 OpenRouter 스키마를 흘리지 않는다.
import { LLM_TIMEOUT_MS } from "../config.ts";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

/**
 * 모델이 ```json 펜스로 감싸 보내는 일이 잦다. 펜스를 벗기고, 그래도 안 되면
 * 처음 나오는 { 부터 마지막 } 까지를 잘라 파싱한다.
 */
function parseJson<T>(content: string): T {
  const unfenced = content.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, "");
  try {
    return JSON.parse(unfenced) as T;
  } catch {
    const start = unfenced.indexOf("{");
    const end = unfenced.lastIndexOf("}");
    if (start === -1 || end <= start) throw new Error("LLM 응답에서 JSON 을 찾지 못했습니다.");
    return JSON.parse(unfenced.slice(start, end + 1)) as T;
  }
}

export async function chatJson<T>(system: string, user: string): Promise<T> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY 가 설정되지 않았습니다.");

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      // 무료 라우팅(OPENROUTER_MODEL_DEMO)은 호출마다 다른 모델로 가고 17초쯤 걸려
      // 타임아웃 폴백만 계속 탔다. 유료지만 1초 안에 끝나는 쪽을 기본으로 둔다.
      model: process.env.OPENROUTER_MODEL_PROD ?? process.env.OPENROUTER_MODEL_DEMO,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.7,
    }),
    signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
  });

  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("LLM 응답이 비어 있습니다.");
  return parseJson<T>(content);
}
