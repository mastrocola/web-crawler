export const min = (a: number, b: number): number => {
  return a <= b ? a : b
}

export const sleep = (ms: number) => {
  return new Promise(resolve => setTimeout(resolve, ms));
}
