import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing GOOGLE_MAPS_API_KEY" }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const placeId = (searchParams.get("place_id") ?? "").trim();
  const sessionToken = (searchParams.get("sessionToken") ?? "").trim(); // optional for now

  if (!placeId) {
    return NextResponse.json({ error: "Missing place_id" }, { status: 400 });
  }

  // Place Details (New) is GET to https://places.googleapis.com/v1/places/PLACE_ID
  const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Goog-Api-Key": apiKey,
    // FieldMask is REQUIRED for Place Details (New)
    "X-Goog-FieldMask": "id,displayName,formattedAddress,priceLevel",
  };

  // Session token is passed as a query param (optional)
  const fullUrl = sessionToken ? `${url}?sessionToken=${encodeURIComponent(sessionToken)}` : url;

  const resp = await fetch(fullUrl, { headers });
  const data = await resp.json();

  if (!resp.ok) {
    return NextResponse.json(
      { error: data?.error?.message ?? "Place Details (New) error", raw: data },
      { status: resp.status }
    );
  }

  // Map New API shape to something simple for our app
  return NextResponse.json({
    result: {
      place_id: data.id,
      name: data.displayName?.text ?? null,
      formatted_address: data.formattedAddress ?? null,
      price_level: data.priceLevel ?? null,
    },
  });
}
