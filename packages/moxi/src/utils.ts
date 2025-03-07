
export const uc = (s = '') => s.toUpperCase();
export const lc = (s = '') => s.toLowerCase();

export const padRight = (val = '', length = 0, padWith = ' ') => {
  let result = val+'';
  while(result.length < length){
    result += padWith;
  }
  return result;
}
export const pr = padRight;

export const getRandomInt = (max, min = 0) => (Math.floor(Math.random() * (max + 1 - min)) + min);

export const roundTo = (places, value) => (Math.round(value * Math.pow(10, places)) / Math.pow(10, places));

export const lerp = (begin, end, mag) => ((1 - mag) * begin + mag * end);

export function metersToPixels(m: number): number { return m * 20; }

export function pixelsToMeters(p: number): number { return p * 0.05; }

export const fetchXml = async (url: string) => (await (await fetch(url)).text());

