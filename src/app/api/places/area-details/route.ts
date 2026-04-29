import { NextResponse } from "next/server";

import {
  normalizeAreaPlaceFromGoogle,
} from "../_lib";

export async function GET(req: Request) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing GOOGLE_MAPS_API_KEY" }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const placeId = (searchParams.get("place_id") ?? "").trim();
  const query = (searchParams.get("query") ?? "").trim();
  const sessionToken = (searchParams.get("sessionToken") ?? "").trim();

  if (!placeId && !query) {
    return NextResponse.json({ error: "Missing place_id or query" }, { status: 400 });
  }

  let result = null as ReturnType<typeof normalizeAreaPlaceFromGoogle> | null;

  if (placeId) {
    const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`;
    const fullUrl = sessionToken ? `${url}?sessionToken=${encodeURIComponent(sessionToken)}` : url;

    const response = await fetch(fullUrl, {
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "id,displayName,formattedAddress,location,types,primaryType",
      },
      cache: "no-store",
    });

    const payload = (await response.json()) as Record<string, unknown>;

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            ((payload.error as Record<string, unknown> | undefined)?.message as string | undefined) ??
            "Place Details (New) error",
        },
        { status: response.status }
      );
    }

    result = normalizeAreaPlaceFromGoogle(payload);
  } else {
    const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.location,places.types,places.primaryType",
      },
      body: JSON.stringify({
        textQuery: query,
        pageSize: 5,
        regionCode: "US",
        ...(sessionToken ? { sessionToken } : {}),
      }),
      cache: "no-store",
    });

    const payload = (await response.json()) as Record<string, unknown>;

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            ((payload.error as Record<string, unknown> | undefined)?.message as string | undefined) ??
            "Places Text Search (New) error",
        },
        { status: response.status }
      );
    }

    const places = Array.isArray(payload.places)
      ? (payload.places as Record<string, unknown>[])
      : [];

    result =
      places
        .map((place) => normalizeAreaPlaceFromGoogle(place))
        .find((place) => place.place_id && place.lat != null && place.lng != null) ??
      null;
  }

  if (!result) {
    return NextResponse.json(
      {
        error: "We couldn't resolve a valid default dining location from that result. Please refine your search.",
      },
      { status: 422 }
    );
  }

  if (!result.place_id || result.lat == null || result.lng == null) {
    return NextResponse.json(
      {
        error:
          "We couldn't resolve a valid default dining location from that result. Please refine your search.",
      },
      { status: 422 }
    );
  }

  return NextResponse.json({ result });
}
