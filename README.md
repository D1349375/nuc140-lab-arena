# NUC140 Lab Arena

Nu-LB-NUC140 微處理機系統實驗練習平台。沿用 [CPE Practice Arena](https://github.com/D1349375/cpe-practice-arena) 的深色程式工作台風格，加入淺色模式、右上角互動開發板，以及使用本機 Antigravity CLI 的 AI 導師。

第一版以課程 Lab 1–3 與 `Nu-LB-NUC140_BSP3.00.004_v1.4.5` 為基礎：寫 C、操作板子、執行自動評測，再匯出課堂 Keil 專案。

## 啟動

需要 Python 3.10 以上與 GCC。Windows 建議使用既有 MinGW GCC；Python 不需要額外套件。AI 導師另外需要已安裝並登入的 [Antigravity CLI](https://www.antigravity.google/docs/cli/install/)。

```powershell
git clone https://github.com/D1349375/nuc140-lab-arena.git
cd nuc140-lab-arena
python server.py --open
```

也可以直接雙擊 `start.bat`。平台預設開啟 **http://localhost:5055**；停止服務可在啟動的終端機按 Ctrl+C。

若 GCC 或 `agy` 沒有加入 PATH，可以在啟動前指定路徑：

```powershell
$env:NUC140_GCC = 'C:\mingw64\bin\gcc.exe'
$env:NUC140_AGY = 'C:\Users\你的帳號\AppData\Local\agy\bin\agy.exe'
python server.py --open
```

`NUC140_AGY_MODEL` 可指定 CLI 模型；未指定時沿用 CLI 預設。需要更換連接埠時使用 `python server.py --port 5056 --open`。

## 練習流程

1. 選擇 Lab 題目，查看實作要求與驗收項目。
2. 保留 Sample Code，或關閉後按「載入起始碼」，以基本骨架開始。載入前會自動保存完整版本。
3. 編輯 `main.c`。也可切換並修改 `MCU_init.h`、`Scankey.c`、`Seven_Segment.c`。練習參數由右上角設定管理，產生可攜的 `lab_config.h`。
4. 按「編譯並執行」，在右上角按住／放開九宮格按鍵；點選板子後，也能使用鍵盤數字 1–9。蜂鳴器聲音需手動開啟。
5. 按「自動評測」，查看每項預期和實際反應。修改程式或設定後，舊結果會提示重新評測。
6. 向 AI 導師提問。導師會取得目前程式、題目、練習設定和模擬／評測紀錄，透過你的 Antigravity 帳號提供提示。
7. 按「匯出 Keil 專案」，將完整 ZIP 帶回課堂。

作答、版本、主題與聊天保存在目前瀏覽器的 localStorage，每題分開保存；更換瀏覽器或清除網站資料不會保留。請定期匯出 ZIP 備份。

## 題庫

| Lab | 題目 | 預設 Sample Code |
| --- | --- | --- |
| 1.1 | 學號末碼的二進位 LED | GPIO_LED |
| 1.2 | 雙向旋轉跑馬燈 | GPIO_LED |
| 2.1 | 按住按鍵顯示日期七碼 | GPIO_Keypad |
| 2.2 | 按鍵控制漸增、暫停與恢復 | GPIO_Keypad |
| 3.1 | 一分鐘計時、七段顯示與掃頻警報 | GPIO_7seg_keypad |
| 3.2 | 四位數容器與 A/B 刪除模式 | GPIO_7seg_keypad4 |

教材 Lab 1 的左右旋轉練習合併為 1.2，使用設定中的方向分別測試。Lab 3.1 採按鍵 7=S、8=P、9=R；預設初始秒數 55，對應教材驗收，也可設為 0。Lab 3.2 採 7=P、8=A、9=B，B 模式依投影片 `123 → 23` 的範例刪除最早輸入的數字。

Sample Code 是原始 BSP 範例，不是題目完整解答。每題保留整理版說明，並提供原始簡報題目區域的截圖，點圖可放大。六題共使用八張原題／警報器投影片；原始簡報和整份 BSP ZIP 不加入本 repo。

題目中的「AC 如何判定？」列出該題的實際測試範圍。AC 表示目前程式與練習設定通過全部固定模擬測試，AI 不參與判分；修改後舊 AC 會失效。各題的詳細情境與限制見 [評測規則](docs/grading.md)。

## 程式編輯

工作台使用 Monaco Editor，支援 C 語法上色、巢狀區塊自動縮排、括號／引號配對、多行縮排、註解、搜尋取代、區塊摺疊、多游標、移動／複製行，以及各檔案獨立的復原紀錄。輸入 `for`、`if` 或常用板子函式可取得片段提示；按「快捷鍵」查看操作。`lab_config.h` 維持唯讀，由練習設定管理。

「重新縮排」對齊目前檔案的區塊縮排，不會改寫程式的運算式或套用完整 C 排版。編譯後，GCC 回報的已知檔案錯誤與警告會標在編輯器中；修改程式後會清除舊標記。片段提示涵蓋常用課堂 API，尚未接上完整 C/C++ 語言伺服器。

Monaco、繁體中文介面、字型與 worker 均放在 repo 的 `web/assets/editor`，使用者啟動平台不需要 npm，也不依賴外部 CDN。若修改 `web/editor.js`，開發者需執行：

```powershell
npm ci --ignore-scripts
npm run build:editor
```

請將重建的資源與來源一起提交，CI 會檢查兩者一致。套件版本由 `package-lock.json` 固定。

## 帶回真實板子

匯出的 ZIP 包含自己的程式、兩個可編輯驅動、`lab_config.h`、原始 Keil `.uvproj`、startup 與所需 BSP。解壓縮時保留 `Library` 和 `SampleCode` 的相對位置，依 ZIP 內 `README.txt` 指示開啟專案。

使用課堂的 **NUC140VE3CN、Keil ARM Compiler 5、Nu-Link** 設定重新編譯，再下載到 Nu-LB-NUC140。平台不會把模擬用的 GCC 標頭或原生執行檔放進匯出 ZIP，也不會直接從瀏覽器燒錄。

目前已檢查匯出專案的所有原始碼和 include 路徑、BSP 依賴及使用者修改的完整性。**尚未在 Keil 與實體 Nu-LB-NUC140 上完成編譯和燒錄驗證**；模擬通過仍需在課堂確認實際時序與接線。

## 模擬範圍

模擬會真正編譯並執行 C，以及可修改的原始 `Scankey.c`／`Seven_Segment.c`，將 GPIO 輸出轉成 LED、七段顯示器、按鍵矩陣和蜂鳴器狀態。它是 **原生 C 周邊模型**，不是 NUC140 ARM 指令模擬器，也不會執行 `.axf` 或韌體二進位。

第一版支援這六題使用的 GPIO 模式、PA–PE 腳位、`CLK_SysTickDelay`／`CLK_SysTickLongDelay` 和板上驅動。`SYS_Init` 只提供模擬初始化。CPU 空迴圈、時脈配置、Timer/NVIC 中斷、UART、SPI、I²C、ADC、LCD、暫存器的完整語意與真實電路時序尚未建模。板子上的 LCD 圖示僅呈現外觀。

請用 GPIO／掃描或延遲函式推進模擬時間；只有純運算的無窮迴圈會在 12 秒未回應後停止。GPIO 操作使用近似的虛擬時間，自動評測檢查功能與狀態轉移，不能認證硬體時間精度。原始 BSP 在 50MHz 下的 `CLK_SysTickDelay` 單次延遲應不超過約 335544μs；較長延遲請分段或使用 `CLK_SysTickLongDelay`。

這是個人本機工具，服務只監聽 loopback；提交的 C 程式會以目前使用者權限執行，並非安全的多使用者程式執行沙箱。若未來部署公開平台，需增加隔離編譯／執行服務與登入系統。

## 架構與驗證

前端使用原生 HTML/CSS/JavaScript，後端使用 Python 標準庫，避免初次練習需要 Node 或前端建置。詳細資料流程、API 與後續擴充見 [系統架構](docs/architecture.md)。

```powershell
python -m unittest discover -v
```

測試包含六題獨立 C 參考程式、反向跑馬燈、計時邊界、錯誤答案、編譯失敗、無回應終止、原始掃描驅動、修改驅動、完整 Keil ZIP，以及 CLI 串流回應的成功／失敗處理。自動測試不呼叫付費 AI，也不需要 AI 登入。

## 授權與來源

平台程式採 [MIT](LICENSE)。`vendor/bsp` 來自使用者提供的 Nuvoton BSP，保留原著作權與 ARM/CMSIS 授權文件；這些材料維持各自條款，詳見 [第三方來源說明](vendor/THIRD_PARTY_NOTICES.md)。
