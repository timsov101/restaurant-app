export function formatRestaurantAddress(address: string | null | undefined) {
  if (!address) return address ?? null;
  return address.replace(/,\s*(usa|united states)\s*$/i, "");
}
