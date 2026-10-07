"""Course requirements transcribed from the supplied Lab slides."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BSP = ROOT / "vendor" / "bsp"
SAMPLES = BSP / "SampleCode" / "Nu-LB-NUC140"
BOARD = BSP / "Library" / "Nu-LB-NUC140"
LABS = [
    dict(id="lab1-1", lab=1, number=1, title="學號二進位 LED", topic="GPIO 輸出", sample="GPIO_LED", samples=["GPIO_LED"],
         description="使用四顆 LED 顯示學號最後一碼的二進位。由左到右為最高位到最低位，例如 9 顯示 1001。",
         requirements=["PC12、PC13、PC14、PC15 依序對應左到右四顆 LED。", "LED 為低電位點亮：0 亮、1 滅。", "使用練習設定中的學號末碼；顯示結果應維持穩定。"],
         tips=["先設定 GPIO 輸出模式，再控制燈號。", "lab_config.h 提供 LAB_STUDENT_DIGIT，可直接帶回 Keil 使用。"],
         checks=["四顆 LED 的二進位排列", "顯示穩定性"], source="Lab1.pptx，投影片 14"),
    dict(id="lab1-2", lab=1, number=2, title="雙向旋轉跑馬燈", topic="迴圈與時序", sample="GPIO_LED", samples=["GPIO_LED"],
         description="以四顆 LED 製作循環旋轉跑馬燈。本題合併教材中的左右兩個練習，可切換方向分別練習與測試。",
         requirements=["每次點亮一顆 LED，依序循環。", "左向右：PC12 → PC13 → PC14 → PC15 → PC12。右向左為反向順序。", "練習設定可選擇本次測試方向；建議每步延遲 200ms。"],
         tips=["LAB_DIRECTION 為 1（左向右）或 -1（右向左）。", "請使用 CLK_SysTickDelay()；單純空迴圈的耗時與真板不同。"],
         checks=["方向與循環順序", "一次只亮一顆", "持續循環"], source="Lab1.pptx，投影片 15–16"),
    dict(id="lab2-1", lab=2, number=1, title="按鍵顯示日期", topic="鍵盤掃描", sample="GPIO_Keypad", samples=["GPIO_Keypad"],
         description="按住按鍵 1～7，分別用 LED 顯示實驗課日期七個數字的二進位。範例日期為 115/09/21。",
         requirements=["初始狀態 LED 全滅。", "按鍵 1～7 對應日期七碼；日期中的 0 以 LED 全亮代替。", "按住時顯示，放開後 LED 全滅。"],
         tips=["ScanKey() 在沒有按鍵時回傳 0。", "lab_config.h 提供 LAB_DATE_DIGITS 七個數字。"],
         checks=["初始狀態", "七個日期按鍵", "放開後停止顯示"], source="Lab2.pptx，投影片 27"),
    dict(id="lab2-2", lab=2, number=2, title="按鍵控制漸增跑馬燈", topic="狀態與按鍵邊緣", sample="GPIO_Keypad", samples=["GPIO_Keypad"],
         description="使用按鍵 1、2、3 控制漸增跑馬燈的方向與暫停。按一次後放開，動作仍持續。",
         requirements=["按鍵 1：全滅 → PC12 → PC12/13 → PC12/13/14 → 全亮，循環。", "按鍵 3：全滅 → PC15 → PC14/15 → PC13/14/15 → 全亮，循環。", "按鍵 2 切換暫停／恢復，恢復時保持原方向。", "長按一次按鍵應只觸發一次狀態切換。建議每步 200ms。"],
         tips=["記錄前一次按鍵，分辨新按下與持續按住。", "方向、暫停狀態與目前燈號可以分開保存。"],
         checks=["左向右漸增", "暫停與恢復", "右向左漸增"], source="Lab2.pptx，投影片 28"),
    dict(id="lab3-1", lab=3, number=1, title="一分鐘計時與警報", topic="七段顯示器與蜂鳴器", sample="GPIO_7seg_keypad", samples=["GPIO_7seg_keypad", "GPIO_7seg_keypad4_buzz", "GPIO_Buzzer"],
         description="使用七段顯示器製作一分鐘計時器。到時關閉顯示、播放警報器節奏，並讓 LED 左向右旋轉。",
         requirements=["按鍵 7=S 開始、8=P 暫停、9=R 重設，採按一下後放開的操作。", "正常從 0000 開始；驗收模式依教材從 0055 開始，使用 LAB_INITIAL_SECONDS。", "到一分鐘時七段顯示器全暗，蜂鳴器持續播放警報，LED 左向右旋轉。", "警報時只有 R 有效，S、P 不改變警報狀態。", "警報半週期從 1000μs 每次減少 5μs，再從 500μs 每次增加 5μs，各重複 100 次。"],
         tips=["七段顯示器需要持續輪流掃描；長時間延遲會影響顯示與按鍵反應。", "PB11 控制蜂鳴器。練習設定預設從 55 秒開始，便於驗收。"],
         checks=["開始、暫停、重設", "到時關閉顯示", "警報與跑馬燈", "警報時 S/P 無效"], source="Lab3 (2).pptx，投影片 4–5", keyLabels={"7":"S", "8":"P", "9":"R"}),
    dict(id="lab3-2", lab=3, number=2, title="四位數容器與 A/B 模式", topic="輸入緩衝與模式切換", sample="GPIO_7seg_keypad4", samples=["GPIO_7seg_keypad4", "GPIO_7seg_keypad"],
         description="輸入 1～6 的數字，最多保存四位，從右向左填入七段顯示器。使用 A/B 模式決定刪除方式。",
         requirements=["按鍵 1～6 輸入數字；7=P 刪除、8=A 模式、9=B 模式，依投影片排列。", "初始容器為空、顯示器全暗、LED 全滅。滿四位後不接受新數字。", "A 模式亮 PC12；B 模式亮 PC12/PC13，模式可隨時切換。", "只有選擇模式後 P 才有效。依教材範例：A 刪最新（123→12），B 刪最早（123→23）。", "每次按下再放開只輸入或刪除一次；未使用的顯示位應保持暗。"],
         tips=["B 模式依教材範例採刪除最早輸入，題目文字中的『最新』與範例不一致。", "可修改 Seven_Segment.c；修改會同時影響模擬與匯出專案。"],
         checks=["初始狀態與輸入順序", "容量上限", "A/B 指示燈", "兩種刪除方式", "長按不重複輸入"], source="Lab3 (2).pptx，投影片 6", keyLabels={"7":"P", "8":"A", "9":"B"}),
]

def get_lab(lab_id):
    return next((lab for lab in LABS if lab["id"] == lab_id), None)

def validate_config(config):
    config = config or {}
    digit = int(config.get("studentDigit", 9))
    date = str(config.get("date", "1150921")).replace("/", "")
    direction = int(config.get("direction", 1))
    initial = int(config.get("initialSeconds", 55))
    if digit not in range(10) or len(date) != 7 or not date.isascii() or not date.isdigit():
        raise ValueError("學號末碼需為 0～9；日期需為七個數字，例如 1150921。")
    if direction not in (-1, 1) or initial not in range(60):
        raise ValueError("方向需為 1 或 -1；初始秒數需為 0～59。")
    return dict(studentDigit=digit, date=date, direction=direction, initialSeconds=initial)

def config_header(config):
    c = validate_config(config)
    return ("/* Portable practice settings; include this file in main.c. */\n"
            "#ifndef LAB_CONFIG_H\n#define LAB_CONFIG_H\n"
            f"#define LAB_STUDENT_DIGIT {c['studentDigit']}\n"
            f"#define LAB_DATE_DIGITS {{{', '.join(c['date'])}}}\n"
            f"#define LAB_DIRECTION ({c['direction']})\n"
            f"#define LAB_INITIAL_SECONDS {c['initialSeconds']}\n"
            "#endif\n")

def get_template(lab_id, sample=True, sample_id=None, config=None):
    lab = get_lab(lab_id)
    if not lab:
        raise ValueError("找不到這個 Lab 題目。")
    sample_id = sample_id or lab["sample"]
    if sample_id not in lab["samples"]:
        raise ValueError("這個範例不適用於目前題目。")
    folder = SAMPLES / sample_id
    files = {name: (BOARD / "Source" / name).read_text(encoding="utf-8-sig")
             for name in ("Scankey.c", "Seven_Segment.c")}
    files["MCU_init.h"] = (folder / "MCU_init.h").read_text(encoding="utf-8-sig")
    files["lab_config.h"] = config_header(config)
    if sample:
        files["main.c"] = (folder / "main.c").read_text(encoding="utf-8-sig")
    else:
        files["main.c"] = ('#include <stdio.h>\n#include "NUC100Series.h"\n'
                           '#include "MCU_init.h"\n#include "SYS_init.h"\n'
                           '#include "Scankey.h"\n#include "Seven_Segment.h"\n#include "lab_config.h"\n\n'
                           'int main(void)\n{\n    SYS_Init();\n\n    // 在這裡設定 GPIO 與需要的周邊。\n'
                           '    while (1) {\n        // 在這裡實作題目。\n        CLK_SysTickDelay(1000);\n    }\n}\n')
    return dict(labId=lab_id, sampleId=sample_id, files=files)
