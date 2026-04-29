import { NextResponse } from "next/server";

import {
  normalizeAreaAutocompleteSuggestion,
  normalizeAreaPlaceFromGoogle,
} from "../_lib";

function dedupePlaceSuggestions(
  suggestions: Array<ReturnType<typeof normalizeAreaAutocompleteSuggestion>>
) {
  return suggestions
    .filter((suggestion): suggestion is NonNullable<typeof suggestion> => Boolean(suggestion))
    .filter(
      (suggestion, index, list) =>
        list.findIndex((entry) => entry.place_id === suggestion.place_id) === index
    );
}

async function fetchLocationSuggestions(
  apiKey: string,
  input: string,
  sessionToken: string
) {
  const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.types",
    },
    body: JSON.stringify({
      input,
      ...(sessionToken ? { sessionToken } : {}),
      regionCode: "US",
    }),
    cache: "no-store",
  });

  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(
      ((payload.error as Record<string, unknown> | undefined)?.message as string | undefined) ??
        "Places Autocomplete (New) error"
    );
  }

  const suggestions = Array.isArray(payload.suggestions)
    ? payload.suggestions
      .map((entry) =>
        entry && typeof entry === "object"
          ? normalizeAreaAutocompleteSuggestion(entry as Record<string, unknown>)
          : null
      )
    : [];

  return dedupePlaceSuggestions(suggestions);
}

async function fetchTextSearchSuggestions(
  apiKey: string,
  input: string,
  sessionToken: string
) {
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.types,places.location",
    },
    body: JSON.stringify({
      textQuery: input,
      pageSize: 5,
      regionCode: "US",
      ...(sessionToken ? { sessionToken } : {}),
    }),
    cache: "no-store",
  });

  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(
      ((payload.error as Record<string, unknown> | undefined)?.message as string | undefined) ??
        "Places Text Search (New) error"
    );
  }

  const places = Array.isArray(payload.places)
    ? (payload.places as Record<string, unknown>[])
    : [];

  return places
    .map((place) => normalizeAreaPlaceFromGoogle(place))
    .filter((place) => place.place_id && place.label)
    .map((place) => ({
      place_id: place.place_id,
      label: place.label,
      types: place.types,
      source: "places" as const,
    }))
    .filter(
      (suggestion, index, list) =>
        list.findIndex((entry) => entry.place_id === suggestion.place_id) === index
    );
}

export async function GET(req: Request) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing GOOGLE_MAPS_API_KEY" }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const input = (searchParams.get("input") ?? "").trim();
  const sessionToken = (searchParams.get("sessionToken") ?? "").trim();

  if (!input) {
    return NextResponse.json({ suggestions: [] });
  }

  let placeSuggestions: Array<ReturnType<typeof normalizeAreaAutocompleteSuggestion>> = [];

  try {
    placeSuggestions = await fetchLocationSuggestions(apiKey, input, sessionToken);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Places Autocomplete (New) error",
      },
      { status: 500 }
    );
  }

  if (placeSuggestions.length > 0) {
    return NextResponse.json({ suggestions: placeSuggestions });
  }

  try {
    const fallbackSuggestions = await fetchTextSearchSuggestions(apiKey, input, sessionToken);
    if (fallbackSuggestions.length > 0) {
      return NextResponse.json({ suggestions: fallbackSuggestions });
    }
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Places Text Search (New) error",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ suggestions: [] });
}
