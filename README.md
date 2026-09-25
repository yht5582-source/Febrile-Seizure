# 小兒熱性痙攣評估與決策路徑 (Pediatric Febrile Seizure Evaluation Pathway)

這是一個專為兒科急診、兒科門診及基層醫療人員開發的單頁式 Web 應用程式 (SPA)。本工具依據美國兒科醫學會 (AAP) 最新臨床指引，協助醫師快速鑑別「單純型 (Simple)」與「複雜型 (Complex)」熱性痙攣，並自動產出是否需要安排腰椎穿刺 (LP)、腦波 (EEG) 或神經影像檢查之決策建議。

## ✨ 核心功能 (Features)

*   **紅旗警示防漏診機制 (Red Flag Screening)：** 優先篩檢病童年齡（< 6 個月或 > 5 歲）與腦膜炎/中樞神經感染徵候。若符合危險因子，系統將強制跳過常規分型，直接發出紅色警示並建議高階醫療介入。
*   **動態二分法鑑別 (Dynamic Classification)：** 透過評估「發作持續時間」、「發作型態 (全身 vs. 局部)」與「24小時內復發次數」，自動界定單純型或複雜型熱性痙攣。
*   **年齡連動處置建議 (Age-based Workup)：** 系統會針對不同年齡層（特別是 6-12 個月嬰幼兒）給予精細化的腰椎穿刺 (LP) 與腦波 (EEG) 檢查建議。
*   **醫病共享決策與衛教單列印 (Parental Education Export)：** 內建隱藏式 A4 列印排版。一鍵匯出即可將病童的臨床分型、未來的「復發率與癲癇風險數據」及「居家急救處置 SOP」印出，方便醫師直接交予家屬帶回參考。
*   **離線支援 (PWA)：** 支援安裝至手機或平板主畫面，即使在無網路的急診室地下室仍可流暢執行評估。

## 📚 參考臨床指引 (Clinical Guidelines)

*   **評估與處置基準：** 美國兒科醫學會 (AAP) 指引 - *Clinical Practice Guideline for the Neurodiagnostic Evaluation of the Child With a Simple Febrile Seizure*.
*   **預後與衛教數據：** 採用當代小兒神經學教科書與臨床共識中關於熱性痙攣復發率與發展為癲癇 (Epilepsy) 之流行病學統計。

## 🚀 部署與安裝 (Deployment)

本專案為純前端架構 (HTML/CSS/JS)，無須建置後端伺服器。

1.  **線上發布 (GitHub Pages)：**
    進入 GitHub 專案的 `Settings > Pages`，將 Branch 設為 `main` 即可自動生成對外網址。
2.  **行動裝置安裝 (PWA)：**
    使用行動裝置瀏覽器 (Safari / Chrome) 開啟網頁後，選擇 **「加入主畫面 (Add to Home Screen)」** 即可建立桌面捷徑並啟用離線功能。

## 📁 檔案結構 (File Structure)

```text
├── index.html       # 系統主程式 (包含臨床評估表單、鑑別邏輯與衛教單列印排版)
├── manifest.json    # PWA 應用程式清單
├── sw.js            # PWA Service Worker (處理離線快取)
└── icons/           # 放置 192x192 與 512x512 的 APP 圖示
