"""Deterministic, event-based Lab checks. AI never decides the verdict."""
import time
from .simulation import Simulation

def binary_leds(digit):
    return sum(((digit >> (3-i)) & 1) << i for i in range(4))

def stable_masks(frames):
    changes = []
    for frame in frames:
        for event in frame.get("events", []) + [dict(timeUs=frame["timeUs"], ledMask=frame["ledMask"])]:
            if not changes or changes[-1][1] != event["ledMask"]:
                changes.append((event["timeUs"], event["ledMask"]))
    result=[]
    end=frames[-1]["timeUs"] if frames else 0
    for index,(at,mask) in enumerate(changes):
        until=changes[index+1][0] if index+1<len(changes) else end
        if until-at >= 5000 and (not result or result[-1]!=mask):
            result.append(mask)
    return result

def contains_cycle(actual, expected):
    n=len(expected)
    return any(actual[start:start+n+1] == [expected[(offset+i)%n] for i in range(n+1)]
               for start in range(max(0,len(actual)-n)) for offset in range(n))

class Scenario:
    def __init__(self, simulation, progress):
        self.sim=simulation
        self.cases=[]
        self.frames=[]
        self.progress=progress
        self.deadline=time.monotonic()+75

    def wait(self, milliseconds, keys=()):
        frames=[]
        remaining=int(milliseconds*1000)
        while remaining:
            if time.monotonic()>self.deadline:
                raise RuntimeError("評測超過 75 秒，請縮短不必要的運算。")
            chunk=min(50000,remaining)
            frame=self.sim.step(list(keys),chunk)
            frames.append(frame)
            self.frames.append(frame)
            remaining-=chunk
        return frames

    def tap(self, key):
        return self.wait(100,[key])+self.wait(150)

    def check(self, name, passed, expected, actual):
        self.cases.append(dict(name=name, passed=bool(passed), expected=expected, actual=actual))
        self.progress(f"已檢查：{name}")

    @property
    def frame(self):
        return self.sim.frame

    def display(self, expected, name):
        self.check(name,self.frame["display"]==expected,repr(expected),repr(self.frame["display"]))

def judge(project, progress=lambda _: None):
    progress("編譯 C 程式與板子驅動…")
    with Simulation(project) as sim:
        s=Scenario(sim,progress)
        config=project["config"]
        lab=project["labId"]
        initial=s.wait(200)
        if lab=="lab1-1":
            expected=binary_leds(config["studentDigit"])
            s.check("學號二進位排列",s.frame["ledMask"]==expected,f"LED mask={expected}",f"LED mask={s.frame['ledMask']}")
            frames=s.wait(800)
            s.check("顯示維持穩定",all(f["ledMask"]==expected for f in frames),"保持相同二進位燈號",str(stable_masks(frames)))
        elif lab=="lab1-2":
            frames=initial+s.wait(3000)
            sequence=stable_masks(frames)
            expected=[1,2,4,8] if config["direction"]==1 else [8,4,2,1]
            s.check("跑馬燈方向與循環",contains_cycle(sequence,expected),str(expected)+" 循環",str(sequence))
            s.check("每次只點亮一顆",bool(sequence) and all(mask in (1,2,4,8) for mask in sequence),"單顆 LED 輪流點亮",str(sequence))
        elif lab=="lab2-1":
            s.check("初始 LED 全滅",s.frame["ledMask"]==0,"0",str(s.frame["ledMask"]))
            for key,digit in enumerate(config["date"],1):
                frames=s.wait(250,[key])
                expected=15 if digit=="0" else binary_leds(int(digit))
                s.check(f"按住按鍵 {key}（日期 {digit}）",all(f["ledMask"]==expected for f in frames[-3:]),str(expected),str([f["ledMask"] for f in frames[-3:]]))
                released=s.wait(200)
                s.check(f"放開按鍵 {key}",all(f["ledMask"]==0 for f in released[-2:]),"LED 全滅",str([f["ledMask"] for f in released[-2:]]))
        elif lab=="lab2-2":
            s.tap(1)
            sequence=stable_masks(s.wait(3000))
            s.check("左向右漸增循環",contains_cycle(sequence,[0,1,3,7,15]),"0→1→3→7→15→0",str(sequence))
            s.tap(2);s.wait(250)
            paused=s.wait(600)
            s.check("按鍵 2 暫停",len({f["ledMask"] for f in paused})==1,"燈號保持不變",str(stable_masks(paused)))
            s.tap(2)
            resumed=stable_masks(s.wait(3000))
            s.check("恢復原方向",contains_cycle(resumed,[0,1,3,7,15]),"恢復左向右漸增",str(resumed))
            s.tap(3)
            sequence=stable_masks(s.wait(3000))
            s.check("右向左漸增循環",contains_cycle(sequence,[0,8,12,14,15]),"0→8→12→14→15→0",str(sequence))
        elif lab=="lab3-1":
            start=config["initialSeconds"]
            initial_text=f"00{start:02}"
            s.display(initial_text,"初始計時顯示")
            s.tap(7);s.wait(1050)
            next_text=f"00{start+1:02}" if start<59 else "    "
            s.check("S 開始計時",s.frame["display"]==next_text,next_text,repr(s.frame["display"]))
            s.tap(8);s.wait(200)
            paused=s.frame["display"]
            s.wait(1200)
            s.check("P 暫停計時",s.frame["display"]==paused,repr(paused),repr(s.frame["display"]))
            s.tap(9)
            s.display(initial_text,"R 重設計時")
            s.tap(7)
            # Peripheral accesses have a small modelling cost; allow a
            # bounded 5% margin rather than requiring CPU-cycle precision.
            s.wait((60-start)*1050+300)
            alarm=s.wait(1200)
            s.check("到時關閉七段顯示",all(f["display"]=="    " for f in alarm),"四位全暗",repr(s.frame["display"]))
            sequence=stable_masks(alarm)
            s.check("到時 LED 左向右旋轉",contains_cycle(sequence,[1,2,4,8]),"1→2→4→8 循環",str(sequence))
            edges=[edge for f in alarm for edge in f.get("buzzerEdges",[])]
            periods=[b[0]-a[0] for a,b in zip(edges,edges[1:]) if a[1]!=b[1]]
            tone_ok=bool(periods) and sum(490<=p<=1080 for p in periods)>len(periods)*0.8 and max(periods)-min(periods)>=300
            s.check("警報器掃頻節奏",tone_ok,"半週期約 500～1000μs 往返變化",f"{len(periods)} edges; range {min(periods,default=0)}～{max(periods,default=0)}μs")
            s.tap(7);s.tap(8)
            s.check("警報時 S/P 無效",s.frame["display"]=="    " and s.frame["buzzer"]["active"],"維持警報狀態",repr(s.frame["display"])+str(s.frame["buzzer"]))
            s.tap(9)
            s.display(initial_text,"警報時 R 可重設")
        elif lab=="lab3-2":
            s.display("    ","初始容器為空")
            s.check("初始 LED 全滅",s.frame["ledMask"]==0,"0",str(s.frame["ledMask"]))
            s.wait(350,[1]);s.wait(150)
            s.display("   1","長按只輸入一次")
            s.tap(2);s.tap(3)
            s.display(" 123","數字從右向左填入")
            s.tap(7)
            s.display(" 123","未選擇模式時 P 無效")
            s.tap(4);s.tap(5)
            s.display("1234","滿四位拒絕新數字")
            s.tap(8)
            s.check("A 模式指示 LED",s.frame["ledMask"]==1,"PC12 亮",str(s.frame["ledMask"]))
            s.tap(7)
            s.display(" 123","A 模式刪除最新")
            s.tap(9)
            s.check("B 模式指示 LED",s.frame["ledMask"]==3,"PC12/PC13 亮",str(s.frame["ledMask"]))
            s.tap(7)
            s.display("  23","B 模式刪除最早")
            s.tap(6)
            s.display(" 236","刪除後可繼續輸入")
            s.tap(7);s.tap(7);s.tap(7);s.tap(7)
            s.display("    ","清空與空容器刪除")
        passed=sum(case["passed"] for case in s.cases)
        return dict(verdict="AC" if passed==len(s.cases) else "WA", passedCases=passed,totalCases=len(s.cases),
                    cases=s.cases, lastFrame=s.frame, trace=[dict(timeUs=f["timeUs"],ledMask=f["ledMask"],display=f["display"],buzzer=f["buzzer"]) for f in s.frames[-100:]],
                    warnings=sim.warnings, logs=list(sim.logs))
