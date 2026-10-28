/**
 * WHY: a named object, not a tuple: the wire's GeoJSON `[lng, lat]` is renamed in one place, since
 * an axis swap raises no error and lands Seoul in the Yellow Sea.
 */
export interface LatLng {
  lat: number;
  lng: number;
}
