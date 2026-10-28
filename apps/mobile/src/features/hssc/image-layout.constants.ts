export interface ImageLayoutEntry {
  source: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

 
const image0 = require('./assets/hssc_image0.png');
 
const image1 = require('./assets/hssc_image1.png');
 
const image2 = require('./assets/hssc_image2.png');
 
const image3 = require('./assets/hssc_image3.png');

export const IMAGE_LAYOUT: ImageLayoutEntry[] = [
  { source: image0, x: 70, y: 268, width: 162, height: 3276 },
  { source: image0, x: 232, y: 269, width: 1581, height: 3451 },
  { source: image0, x: 1813, y: 268, width: 2444, height: 3451 },
  { source: image1, x: 3280, y: 110, width: 868, height: 763 },
  { source: image2, x: 970, y: 2624, width: 693, height: 604 },
  { source: image3, x: 1366, y: 2509, width: 81, height: 81 },
  { source: image3, x: 1513, y: 2509, width: 81, height: 81 },
  { source: image3, x: 329, y: 717, width: 81, height: 81 },
];

export const SVG_WIDTH = 4257;
export const SVG_HEIGHT = 3720;
