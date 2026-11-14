const { spawn } = require('child_process');
const path = require('path');

let activeProcess = null;

function stopActiveProcess(emit) {
  if (activeProcess) {
    try {
      activeProcess.kill();
      emit('terminal', { stream: 'system', text: '\r\n[process] Stopped running process.\r\n' });
    } catch {
      // ignore if already exited
    }
    activeProcess = null;
  }
}

function runCommandInWorkspace({ command, args = [], cwd, emit }) {
  return new Promise((resolve) => {
    emit('terminal', { stream: 'system', text: `$ ${command} ${args.join(' ')}\r\n` });

    const proc = spawn(command, args, {
      cwd,
      shell: true,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
    });

    activeProcess = proc;

    proc.stdout.on('data', (chunk) => {
      emit('terminal', { stream: 'stdout', text: chunk.toString() });
    });

    proc.stderr.on('data', (chunk) => {
      emit('terminal', { stream: 'stderr', text: chunk.toString() });
    });

    proc.on('error', (err) => {
      emit('terminal', { stream: 'stderr', text: `[error] ${err.message}\r\n` });
      if (activeProcess === proc) activeProcess = null;
      resolve({ code: 1, error: err.message });
    });

    proc.on('close', (code) => {
      emit('terminal', { stream: 'system', text: `\r\n[process] Exited with code ${code}\r\n` });
      if (activeProcess === proc) activeProcess = null;
      resolve({ code });
    });
  });
}

function startBackgroundProcess({ command, args = [], cwd, emit }) {
  stopActiveProcess(emit);
  emit('terminal', { stream: 'system', text: `$ ${command} ${args.join(' ')}\r\n` });

  const proc = spawn(command, args, {
    cwd,
    shell: true,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
  });

  activeProcess = proc;

  proc.stdout.on('data', (chunk) => {
    emit('terminal', { stream: 'stdout', text: chunk.toString() });
  });

  proc.stderr.on('data', (chunk) => {
    emit('terminal', { stream: 'stderr', text: chunk.toString() });
  });

  proc.on('close', (code) => {
    emit('terminal', { stream: 'system', text: `\r\n[runtime] Process exited with code ${code}\r\n` });
    if (activeProcess === proc) activeProcess = null;
    emit('process_status', { running: false, code });
  });

  emit('process_status', { running: true, pid: proc.pid });
  return proc;
}

module.exports = {
  runCommandInWorkspace,
  startBackgroundProcess,
  stopActiveProcess,
  isRunning: () => Boolean(activeProcess)
};
