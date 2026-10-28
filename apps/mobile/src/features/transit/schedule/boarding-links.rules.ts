// QUIRK(naver-map): the `nmap://place` link asks for the calling app's bundle id or package as `appname`.
// WHY: the street view link is built by the server, so a change in NAVER's unofficial format is one deploy, not an OTA.
export interface PlaceLinkInput {
  lat: number;
  lng: number;
  name: string;
}

// QUIRK(url-search-params): writes a space as `+`, which only form decoders read back, and the receiving app is not one.
function query(params: Record<string, string | number>): string {
  return Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&');
}

export function nmapPlaceUrl({ lat, lng, name }: PlaceLinkInput, appname: string): string {
  return `nmap://place?${query({ lat, lng, name, appname })}`;
}

export function naverWebMapUrl({ lat, lng, name }: PlaceLinkInput): string {
  return `https://m.map.naver.com/map.naver?${query({ lat, lng, dlevel: 13, pinTitle: name, pinType: 'SITE' })}`;
}
