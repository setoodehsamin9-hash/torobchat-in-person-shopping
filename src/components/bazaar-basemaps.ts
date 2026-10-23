/** OpenMapTiles-schema vector styles (openmaptiles.org/#map-styles), served
 * without a key by OpenFreeMap. Dark Matter matches the ترب‌چت canvas; Positron
 * is the daylight option for reading streets outdoors.
 */
export const basemaps={
 dark:{label:'تیره',style:'https://tiles.openfreemap.org/styles/dark'},
 positron:{label:'روشن',style:'https://tiles.openfreemap.org/styles/positron'},
} as const;
export type Basemap=keyof typeof basemaps;
