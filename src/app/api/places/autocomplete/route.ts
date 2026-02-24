import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing GOOGLE_MAPS_API_KEY" }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const input = (searchParams.get("input") ?? "").trim();
  const sessionToken = (searchParams.get("sessionToken") ?? "").trim(); // optional for now

  if (!input) return NextResponse.json({ suggestions: [] });

  // Places API (New) Autocomplete uses POST to places.googleapis.com
  const resp = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      // FieldMask optional for Autocomplete (New), but helps keep responses small
      "X-Goog-FieldMask":
        "suggestions.placePrediction.placeId,suggestions.placePrediction.text",
    },
    body: JSON.stringify({
      input,
      // “establishment” equivalent in New API is includedPrimaryTypes
      includedPrimaryTypes: ["restaurant", "cafe", "bar", "meal_takeaway", "meal_delivery"],
      ...(sessionToken ? { sessionToken } : {}),
      // Optional: bias toward US
      // regionCode: "US",
    }),
  });

  const data = await resp.json();

  if (!resp.ok) {
    return NextResponse.json(
      { error: data?.error?.message ?? "Places Autocomplete (New) error", raw: data },
      { status: resp.status }
    );
  }

  // Return the raw suggestions array; we'll map it in the UI later
  return NextResponse.json({ suggestions: data.suggestions ?? [] });
}
