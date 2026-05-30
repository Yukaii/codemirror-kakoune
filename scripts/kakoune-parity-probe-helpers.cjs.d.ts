export interface ParityProgress {
  supported: string[];
  red: string[];
}

export function parseParityProgress(markdown: string): ParityProgress;
export function renderParityProgress(progress: ParityProgress): string;
export function selectNextProbeFixture(progress: ParityProgress): string | undefined;
export function promoteParityFixture(progress: ParityProgress, fixtureName: string): ParityProgress;
export function findPromotableFixture(progress: ParityProgress, probe: (name: string) => boolean | Promise<boolean>): Promise<string | undefined>;

declare const probeHelpers: {
  parseParityProgress: typeof parseParityProgress;
  renderParityProgress: typeof renderParityProgress;
  selectNextProbeFixture: typeof selectNextProbeFixture;
  promoteParityFixture: typeof promoteParityFixture;
  findPromotableFixture: typeof findPromotableFixture;
};

export = probeHelpers;
