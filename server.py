"""Local-only HTTP service. No third-party Python packages are required."""
import argparse
import atexit
from concurrent.futures import ThreadPoolExecutor
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import threading
import time
import uuid
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

from arena.curriculum import ROOT, LABS, get_template
from arena.projects import normalize_project, export_project
from arena.simulation import Simulation, CompileError, compiler_path, NO_WINDOW
from arena.grading import judge
from arena.mentor import agy_path, mentor_reply

class State:
    def __init__(self):
        self.lock=threading.RLock()
        self.simulations={}
        self.jobs={}
        self.pool=ThreadPoolExecutor(max_workers=2)

    def expire(self):
        with self.lock:
            for key,simulation in list(self.simulations.items()):
                if time.monotonic()-simulation.last_active>600:
                    simulation.close()
                    self.simulations.pop(key,None)
            for key,job in list(self.jobs.items()):
                if job["status"]!="running" and time.monotonic()-job["created"]>1800:
                    self.jobs.pop(key,None)

    def job(self, operation):
        with self.lock:
            if sum(job["status"]=="running" for job in self.jobs.values())>=4:
                raise ValueError("目前工作較多，請等評測或 AI 回應完成後再試。")
            key=uuid.uuid4().hex
            job=dict(status="running",progress="準備中…",created=time.monotonic())
            self.jobs[key]=job
        def run():
            def progress(message):
                with self.lock:
                    job["progress"]=message
            try:
                result=operation(progress)
                with self.lock:
                    job.update(status="done",result=result,progress="完成")
            except CompileError as error:
                with self.lock:
                    job.update(status="done",result=dict(verdict="CE",message=str(error),cases=[]),progress="編譯錯誤")
            except Exception as error:
                with self.lock:
                    job.update(status="error",error=str(error),progress="未完成")
        self.pool.submit(run)
        return key

    def close(self):
        with self.lock:
            for simulation in self.simulations.values():
                simulation.close()
        self.pool.shutdown(wait=False,cancel_futures=True)

STATE=State()
atexit.register(STATE.close)

def environment():
    compiler=compiler_path()
    version=""
    if compiler:
        try:
            result=subprocess.run([compiler,"--version"],capture_output=True,timeout=5,creationflags=NO_WINDOW)
            version=result.stdout.decode("utf-8",errors="replace").splitlines()[0]
        except (OSError,subprocess.TimeoutExpired,IndexError):
            compiler=None
    return dict(gcc=bool(compiler),gccVersion=version,agy=bool(agy_path()),
                board="Nu-LB-NUC140",mcu="NUC140VE3CN",bsp="3.00.004 / v1.4.5",
                simulation="原生 C 周邊模型",keilVerified=False)

class Handler(SimpleHTTPRequestHandler):
    protocol_version="HTTP/1.1"

    def end_headers(self):
        # This local workbench updates in place; do not reuse old UI scripts.
        if not urlparse(self.path).path.startswith("/api/"):
            self.send_header("Cache-Control","no-store")
        super().end_headers()

    def setup(self):
        super().setup()
        # Small frame requests/responses should not wait for delayed TCP ACKs.
        self.connection.setsockopt(socket.IPPROTO_TCP,socket.TCP_NODELAY,1)

    def __init__(self,*args,**kwargs):
        super().__init__(*args,directory=str(ROOT/"web"),**kwargs)

    def log_message(self,format,*args):
        if self.path.startswith("/api/simulations/") or self.path.startswith("/api/jobs/"):
            return
        super().log_message(format,*args)

    def valid_origin(self):
        host=self.headers.get("Host","")
        allowed={f"127.0.0.1:{self.server.server_port}",f"localhost:{self.server.server_port}"}
        origin=self.headers.get("Origin")
        return host in allowed and (not origin or origin in {"http://"+name for name in allowed})

    def send_bytes(self,status,body,content_type="application/json; charset=utf-8",filename=None):
        self.send_response(status)
        self.send_header("Content-Type",content_type)
        self.send_header("Content-Length",str(len(body)))
        self.send_header("Cache-Control","no-store")
        self.send_header("X-Content-Type-Options","nosniff")
        if filename:
            self.send_header("Content-Disposition",f'attachment; filename="{filename}"')
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError,ConnectionResetError):
            pass

    def json(self,status,data):
        self.send_bytes(status,json.dumps(data,ensure_ascii=False).encode("utf-8"))

    def do_GET(self):
        parsed=urlparse(self.path)
        if parsed.path.startswith("/api/"):
            if not self.valid_origin():
                return self.json(403,dict(error="只接受本機平台的請求。"))
            STATE.expire()
            query=parse_qs(parsed.query)
            try:
                if parsed.path=="/api/labs":
                    return self.json(200,LABS)
                if parsed.path=="/api/environment":
                    return self.json(200,environment())
                if parsed.path=="/api/template":
                    return self.json(200,get_template(query.get("labId",[""])[0],query.get("sample",["true"])[0]=="true",query.get("sampleId",[None])[0]))
                if parsed.path.startswith("/api/jobs/"):
                    with STATE.lock:
                        job=STATE.jobs.get(parsed.path.rsplit("/",1)[-1])
                        if job:
                            return self.json(200,{name:value for name,value in job.items() if name!="created"})
            except ValueError as error:
                return self.json(400,dict(error=str(error)))
            return self.json(404,dict(error="找不到這項資源。"))
        if not self.valid_origin():
            return self.json(403,dict(error="請由 localhost 開啟平台。"))
        return super().do_GET()

    def do_POST(self):
        if not self.valid_origin():
            self.close_connection=True
            return self.json(403,dict(error="只接受本機平台的請求。"))
        try:
            length=int(self.headers.get("Content-Length","0"))
        except ValueError:
            self.close_connection=True
            return self.json(400,dict(error="無效的請求長度。"))
        if length<1 or length>250000:
            self.close_connection=True
            return self.json(413,dict(error="請求超過限制，請縮短原始碼或對話。"))
        try:
            data=json.loads(self.rfile.read(length).decode("utf-8"))
            if not isinstance(data,dict):
                raise ValueError("請求格式需為物件。")
            path=urlparse(self.path).path
            STATE.expire()
            if path=="/api/simulations":
                project=normalize_project(data)
                with STATE.lock:
                    if len(STATE.simulations)>=4:
                        raise ValueError("已有四個模擬正在執行，請先停止其他視窗的模擬。")
                    simulation=Simulation(project)
                    key=uuid.uuid4().hex
                    STATE.simulations[key]=simulation
                return self.json(200,dict(id=key,frame=simulation.frame,warnings=simulation.warnings))
            if path.startswith("/api/simulations/") and path.endswith("/step"):
                key=path.split("/")[3]
                with STATE.lock:
                    simulation=STATE.simulations.get(key)
                if not simulation:
                    return self.json(404,dict(error="模擬已停止或逾時，請重新執行。"))
                try:
                    frame=simulation.step(data.get("keys",[]),data.get("durationUs",33333))
                except Exception:
                    with STATE.lock:
                        STATE.simulations.pop(key,None)
                    simulation.close()
                    raise
                return self.json(200,dict(frame=frame,logs=list(simulation.logs)))
            if path=="/api/export":
                project=normalize_project(data)
                return self.send_bytes(200,export_project(project),"application/zip",f"nuc140-{project['labId']}-keil.zip")
            if path=="/api/judge":
                project=normalize_project(data)
                key=STATE.job(lambda progress: judge(project,progress))
                return self.json(202,dict(jobId=key))
            if path=="/api/mentor":
                project=normalize_project(data)
                history=data.get("history",[])
                context=data.get("context",{})
                message=data.get("message","")
                if not isinstance(message,str) or not message.strip() or len(message)>4000:
                    raise ValueError("請輸入 1～4000 字的提問。")
                if not isinstance(history,list) or not isinstance(context,dict):
                    raise ValueError("對話資料格式錯誤。")
                key=STATE.job(lambda progress: mentor_reply(project,message,history,context))
                return self.json(202,dict(jobId=key))
            return self.json(404,dict(error="找不到這項操作。"))
        except CompileError as error:
            return self.json(200,dict(verdict="CE",message=str(error)))
        except (ValueError,UnicodeDecodeError,TypeError) as error:
            return self.json(400,dict(error=str(error)))
        except (RuntimeError,subprocess.TimeoutExpired,OSError) as error:
            return self.json(400,dict(error=str(error)))

    def do_DELETE(self):
        if not self.valid_origin():
            return self.json(403,dict(error="只接受本機平台的請求。"))
        path=urlparse(self.path).path
        if path.startswith("/api/simulations/"):
            with STATE.lock:
                simulation=STATE.simulations.pop(path.rsplit("/",1)[-1],None)
            if simulation:
                simulation.close()
            return self.json(200,dict(stopped=True))
        return self.json(404,dict(error="找不到這項操作。"))

def main():
    parser=argparse.ArgumentParser(description="NUC140 Lab Arena")
    parser.add_argument("--port",type=int,default=int(os.environ.get("NUC140_PORT","5055")))
    parser.add_argument("--open",action="store_true",help="open the default browser")
    args=parser.parse_args()
    server=ThreadingHTTPServer(("127.0.0.1",args.port),Handler)
    server.daemon_threads=True
    url=f"http://localhost:{args.port}"
    print(f"NUC140 Lab Arena | {url}",flush=True)
    if args.open:
        threading.Timer(0.6,lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        STATE.close()

if __name__=="__main__":
    main()
