// Minimal logger for critical process tracking
export function log(level: 'START' | 'OK' | 'FAIL', proc: string, msg?: string): void {
  const timestamp = new Date().toISOString();
  const message = msg ? `${proc} ${msg}` : proc;
  process.stderr.write(`[${timestamp}] [${level}] [${message}]\n`);
}

export function logStart(proc: string): void {
  log('START', proc);
}

export function logOk(proc: string, msg?: string): void {
  log('OK', proc, msg);
}

export function logFail(proc: string, msg?: string): void {
  log('FAIL', proc, msg);
}