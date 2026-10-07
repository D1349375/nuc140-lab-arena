"""Compile real C and exchange bounded peripheral frames with a native runner."""
from collections import deque
import json
import os
from pathlib import Path
import queue
import shutil
import subprocess
import threading
import time
import uuid
from .curriculum import ROOT

RUNTIME = ROOT / ".runtime"
RUNTIME.mkdir(exist_ok=True)
# BSP v1.4.5 draws 9 without its bottom segment; accept both glyphs.
SEGMENT_DIGITS = {0x3f:"0", 0x06:"1", 0x5b:"2", 0x4f:"3", 0x66:"4", 0x6d:"5", 0x7d:"6", 0x07:"7", 0x7f:"8", 0x6f:"9", 0x67:"9", 0:" "}
NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0)

class BuildDirectory:
    def __init__(self):
        # Inherit the workspace ACL on Windows; Python 3.12's mode-0700
        # mkdtemp can make a directory inaccessible to restricted tokens.
        self.path = RUNTIME / ("run-" + uuid.uuid4().hex)
        self.path.mkdir()
        self.name = str(self.path)

    def cleanup(self):
        resolved = self.path.resolve()
        if resolved.parent != RUNTIME.resolve() or self.path.is_symlink():
            raise RuntimeError("Refusing to remove a build directory outside .runtime.")
        shutil.rmtree(resolved, ignore_errors=True)

class CompileError(Exception):
    pass

def compiler_path():
    return os.environ.get("NUC140_GCC") or shutil.which("gcc")

def decorate_frame(frame):
    frame["display"] = "".join(SEGMENT_DIGITS.get(digit["mask"] & 0x7f, "?") for digit in frame["segments"])
    return frame

class Simulation:
    def __init__(self, project):
        compiler = compiler_path()
        if not compiler:
            raise CompileError("找不到 GCC。請將 MinGW GCC 加入 PATH，或設定 NUC140_GCC。")
        self.project = project
        self.directory = BuildDirectory()
        self.cwd = Path(self.directory.name)
        self.frames = queue.Queue(maxsize=4)
        self.logs = deque(maxlen=160)
        self.lock = threading.RLock()
        self.closed = False
        self.last_active = time.monotonic()
        self.proc = None
        self.warnings = ""
        try:
            for name, text in project["files"].items():
                (self.cwd / name).write_text(text, encoding="utf-8")
            include = os.path.relpath(ROOT / "sim" / "include", self.cwd)
            arguments = [compiler, "-std=c99", "-O0", "-g", "-Wall", "-Wextra", "-Wno-unused-variable", "-Wno-unused-function", "-I", include, "-I", "."]
            result = subprocess.run(arguments + ["-Dmain=arena_user_main", "-c", "main.c", "Scankey.c", "Seven_Segment.c"],
                                    cwd=self.cwd, capture_output=True, timeout=25, creationflags=NO_WINDOW)
            diagnostics = result.stderr.decode("utf-8", errors="replace")
            if result.returncode:
                raise CompileError(diagnostics or "C 程式編譯失敗。")
            self.warnings = diagnostics
            executable = "simulation.exe" if os.name == "nt" else "simulation"
            result = subprocess.run(arguments + [os.path.relpath(ROOT / "sim" / "runtime.c", self.cwd), "main.o", "Scankey.o", "Seven_Segment.o", "-o", executable, "-lm"] + (["-static"] if os.name == "nt" else []),
                                    cwd=self.cwd, capture_output=True, timeout=25, creationflags=NO_WINDOW)
            if result.returncode:
                raise CompileError(result.stderr.decode("utf-8", errors="replace"))
            self.proc = subprocess.Popen([str(self.cwd / executable)], cwd=self.cwd,
                                         stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                         creationflags=NO_WINDOW)
            threading.Thread(target=self._read_stdout, daemon=True).start()
            threading.Thread(target=self._read_stderr, daemon=True).start()
            self.frame = self._next_frame()
        except Exception:
            self.close()
            raise

    def _read_stdout(self):
        marker = b"@NUC140_FRAME "
        try:
            while not self.closed:
                line = self.proc.stdout.readline(65536)
                if not line:
                    break
                position = line.find(marker)
                if position >= 0:
                    if position:
                        text = line[:position].decode("utf-8", errors="replace").strip()
                        if text:
                            self.logs.append(text[:4000])
                    try:
                        frame = decorate_frame(json.loads(line[position+len(marker):]))
                        self.frames.put(frame, timeout=1)
                    except (json.JSONDecodeError, KeyError, queue.Full):
                        self.logs.append("模擬器輸出格式錯誤。")
                elif line.strip():
                    self.logs.append(line.decode("utf-8", errors="replace").rstrip()[:4000])
        except (OSError, ValueError):
            pass

    def _read_stderr(self):
        try:
            while not self.closed:
                line = self.proc.stderr.readline(8192)
                if not line:
                    break
                self.logs.append(line.decode("utf-8", errors="replace").rstrip()[:4000])
        except (OSError, ValueError):
            pass

    def _next_frame(self):
        try:
            return self.frames.get(timeout=12)
        except queue.Empty:
            code = self.proc.poll() if self.proc else None
            self.close()
            if code is not None:
                raise RuntimeError(f"程式異常結束（exit {code}）。\n" + "\n".join(self.logs))
            raise RuntimeError("程式 12 秒內未回應。請檢查無窮迴圈，並使用 GPIO、ScanKey 或 CLK_SysTickDelay 推進模擬。")

    def step(self, keys=(), duration_us=33333):
        if not isinstance(keys, (list, tuple)) or any(type(key) is not int or key not in range(1,10) for key in keys):
            raise ValueError("按鍵需為 1～9。")
        if type(duration_us) is not int or duration_us not in range(1000,100001):
            raise ValueError("模擬步長需為 1000～100000 微秒。")
        with self.lock:
            self.last_active = time.monotonic()
            if self.closed:
                raise RuntimeError("模擬已停止，請重新執行。")
            if self.frame.get("finished"):
                return self.frame
            mask = sum(1 << (key-1) for key in set(keys))
            try:
                self.proc.stdin.write(f"{mask} {duration_us}\n".encode("ascii"))
                self.proc.stdin.flush()
            except (BrokenPipeError, OSError):
                self.close()
                raise RuntimeError("程式已結束。\n" + "\n".join(self.logs))
            self.frame = self._next_frame()
            return self.frame

    def close(self):
        with self.lock:
            if self.closed:
                return
            self.closed = True
            if self.proc:
                if self.proc.poll() is None:
                    self.proc.kill()
                try:
                    self.proc.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    pass
                for pipe in (self.proc.stdin, self.proc.stdout, self.proc.stderr):
                    try:
                        pipe.close()
                    except (OSError, ValueError):
                        pass
            self.directory.cleanup()

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.close()
