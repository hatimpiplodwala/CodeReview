export function mapNewFileLines(patch: string): number[] {
    const lines = patch.split("\n");
    const out: number[] = new Array(lines.length).fill(0);
    let newLine = 0;
  
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
  
      if (line.startsWith("@@")) {
        const m = /@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
        newLine = m ? parseInt(m[1], 10) : newLine;
        out[i] = 0;
        continue;
      }
      if (line.startsWith("+")) {
        out[i] = newLine;
        newLine += 1;
      } else if (line.startsWith("-")) {
        out[i] = 0;
      } else {
        out[i] = newLine;
        newLine += 1;
      }
    }
    return out;
  }
  