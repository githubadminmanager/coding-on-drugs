const os = require('os');

let prevCpuInfo = os.cpus();

function getCpuUsagePercent() {
  const current = os.cpus();
  let idleDiff = 0;
  let totalDiff = 0;

  for (let i = 0; i < current.length; i++) {
    const prev = prevCpuInfo[i] || current[i];
    const curr = current[i];
    const prevTotal = Object.values(prev.times).reduce((a, b) => a + b, 0);
    const currTotal = Object.values(curr.times).reduce((a, b) => a + b, 0);
    idleDiff += curr.times.idle - prev.times.idle;
    totalDiff += currTotal - prevTotal;
  }

  prevCpuInfo = current;
  if (totalDiff <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((1 - idleDiff / totalDiff) * 100)));
}

function getHardwareSnapshot() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const cpus = os.cpus();

  return {
    platform: `${os.type()} ${os.release()} (${os.arch()})`,
    cpuModel: cpus[0]?.model?.trim() || 'Unknown CPU',
    cpuCores: cpus.length,
    cpuUsagePercent: getCpuUsagePercent(),
    totalMemGB: +(totalMem / (1024 ** 3)).toFixed(2),
    usedMemGB: +(usedMem / (1024 ** 3)).toFixed(2),
    memUsagePercent: Math.round((usedMem / totalMem) * 100),
    uptimeSec: Math.round(os.uptime()),
    nodeVersion: process.version
  };
}

module.exports = { getHardwareSnapshot };
