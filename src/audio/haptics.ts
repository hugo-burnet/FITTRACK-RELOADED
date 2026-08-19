/** The end of a rest, felt. Two taps — the 10 ms tick already means "threshold crossed". */
export function buzzRestOver(): void {
  navigator.vibrate?.([80, 60, 80]);
}
