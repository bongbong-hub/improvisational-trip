"use client";

import { useState } from "react";

import {
  DEFAULT_PREFERENCES,
  THEME_OPTIONS,
  type Accommodation,
  type Preferences,
} from "@/lib/domain/session.ts";

type ChoiceProps<T extends string> = {
  label: string;
  options: readonly T[];
  value: T | T[];
  onPick: (option: T) => void;
};

/** 단일선택과 다중선택이 UI 상 똑같이 생겼다. 선택 여부만 배열이냐 값이냐로 갈린다 */
function Choice<T extends string>({ label, options, value, onPick }: ChoiceProps<T>) {
  const isOn = (option: T) => (Array.isArray(value) ? value.includes(option) : value === option);
  return (
    <div className="choice">
      <span className="choiceLabel">{label}</span>
      <div className="chips">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className={`chip${isOn(option) ? " chipOn" : ""}`}
            onClick={() => onPick(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Onboarding({ onDone }: { onDone: (preferences: Preferences) => void }) {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES);

  return (
    <section className="panel panelFull">
      <h1 className="title">어떤 여행이 좋아요?</h1>
      <p className="sub">답한 내용은 이번 여행 동안만 쓰이고 저장되지 않습니다.</p>

      <Choice
        label="여행 템포"
        options={["느긋", "보통", "빡빡"] as const}
        value={prefs.tempo}
        onPick={(tempo) => setPrefs({ ...prefs, tempo })}
      />
      <Choice
        label="선호 테마 (복수 선택)"
        options={THEME_OPTIONS}
        value={prefs.themes}
        onPick={(theme) =>
          setPrefs({
            ...prefs,
            themes: prefs.themes.includes(theme)
              ? prefs.themes.filter((t) => t !== theme)
              : [...prefs.themes, theme],
          })
        }
      />
      <Choice
        label="동행"
        options={["혼자", "커플", "친구", "가족"] as const}
        value={prefs.companion}
        onPick={(companion) => setPrefs({ ...prefs, companion })}
      />
      <Choice
        label="예산대"
        options={["저가", "중가", "고가"] as const}
        value={prefs.budget}
        onPick={(budget) => setPrefs({ ...prefs, budget })}
      />

      <button
        className="primary"
        onClick={() => onDone(prefs)}
        disabled={prefs.themes.length === 0}
      >
        {prefs.themes.length === 0 ? "테마를 하나 이상 골라주세요" : "다음"}
      </button>
    </section>
  );
}

type Place = { name: string; address: string; lat: number; lng: number };

export function AccommodationStep({ onDone }: { onDone: (place: Accommodation | null) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search() {
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const res = await fetch("/api/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "검색에 실패했습니다.");
      setResults(data.places);
      if (data.places.length === 0) setError("검색 결과가 없습니다.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSearching(false);
    }
  }

  return (
    <section className="panel panelFull">
      <h1 className="title">숙소가 정해져 있나요?</h1>
      <p className="sub">알려주면 숙소 방향의 장소도 추천에 섞습니다. 없어도 진행됩니다.</p>

      <form
        className="searchRow"
        onSubmit={(e) => {
          e.preventDefault();
          search();
        }}
      >
        <input
          className="input"
          placeholder="숙소 이름이나 주소"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="secondary" type="submit" disabled={searching}>
          검색
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      <ul className="cards">
        {results.map((place) => (
          <li key={`${place.lat},${place.lng}`}>
            <button
              className="card"
              onClick={() =>
                onDone({ lat: place.lat, lng: place.lng, address: place.address || place.name })
              }
            >
              <strong>{place.name}</strong>
              <span>{place.address}</span>
            </button>
          </li>
        ))}
      </ul>

      <button className="secondary" onClick={() => onDone(null)}>
        숙소 없이 진행할게요
      </button>
    </section>
  );
}
