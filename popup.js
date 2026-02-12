(async function () {

    const loader = document.getElementById("loader");
    const resultDiv = document.getElementById("result");

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    const res = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: getLeaveTime
    });

    setTimeout(() => {

        loader.classList.add("hidden");

        const leaveData = res[0].result;

        if (!leaveData) {
            resultDiv.innerHTML = '<div class="line"><span class="line-icon">😅</span> डेटा नहीं मिला — पहले attendance पेज खोलो!</div>';
            resultDiv.classList.remove("hidden");
            return;
        }

        resultDiv.classList.remove("hidden");

        startCountdown(leaveData);

    }, 1500);

})();


// =====================================================
// Countdown UI
// =====================================================

function startCountdown(leaveData) {

    const resultDiv = document.getElementById("result");
    const targetSeconds = leaveData.leaveSeconds;
    const THIRTY_MIN = 30 * 60;

    function formatClock(sec) {
        sec = sec % (24 * 3600);
        let h = Math.floor(sec / 3600);
        let m = Math.floor((sec % 3600) / 60);
        let s = sec % 60;
        let ampm = h >= 12 ? "PM" : "AM";
        h = h % 12 || 12;
        return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")} ${ampm}`;
    }

    function formatDuration(sec) {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;
        return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }

    const LATE_AFTER_SEC = 10 * 3600 + 15 * 60; // 10:15 AM
    function parseFirstInToSec(str) {
        if (!str) return 0;
        const parts = str.trim().split(/\s+/);
        const [h, m, s = 0] = (parts[0] || "0:0").split(":").map(Number);
        const meridian = (parts[1] || "").toUpperCase();
        let hour = h;
        if (meridian === "PM" && h !== 12) hour = h + 12;
        if (meridian === "AM" && h === 12) hour = 0;
        return hour * 3600 + (m || 0) * 60 + (s || 0);
    }
    const firstInSec = parseFirstInToSec(leaveData.firstInStr);
    const line1Msg = firstInSec >= LATE_AFTER_SEC
        ? `${leaveData.firstInStr} बजे आए — आज थोड़ा लेट हो गया!`
        : `${leaveData.firstInStr} बजे आए थे — अच्छा टाइमिंग!`;

    const breakSec = leaveData.breakSeconds;
    let line2Icon, breakMsg;
    if (breakSec === 0) {
        line2Icon = "☕";
        breakMsg = `${formatDuration(breakSec)} ब्रेक नहीं लिया — आज robot mode on है क्या?`;
    } else if (breakSec > THIRTY_MIN) {
        line2Icon = "😏";
        breakMsg = `${formatDuration(breakSec)} ज्यादा ब्रेक लिया — बॉस को मत बताना`;
    } else {
        line2Icon = "👍";
        breakMsg = `${formatDuration(breakSec)} सही ब्रेक लिया — balance बना लिया`;
    }

    function update() {
        const now = new Date();
        const nowSeconds =
            now.getHours() * 3600 +
            now.getMinutes() * 60 +
            now.getSeconds();

        const remaining = targetSeconds - nowSeconds;

        const h = Math.floor(Math.abs(remaining) / 3600);
        const m = Math.floor((Math.abs(remaining) % 3600) / 60);
        const s = Math.abs(remaining) % 60;
        const timeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

        const remainingText = remaining <= 0
            ? `टाइम हो गया — अभी तक क्यों बैठे हो? 🏃‍♂️ (-${timeStr})`
            : `बाकी: ${timeStr}`;

        resultDiv.innerHTML = `
            <div class="line"><span class="line-icon">⏰</span> ${line1Msg}</div>
            <div class="line"><span class="line-icon">${line2Icon}</span> ${breakMsg}</div>
            <div class="line leave-time"><span class="line-icon">🚀</span> ${formatClock(targetSeconds)} बजे निकल सकते हो — बस इतना और!</div>
            <div class="remaining"><span class="line-icon">⏳</span> ${remainingText}</div>
        `;
    }

    update();
    setInterval(update, 1000);
}


// =====================================================
// Runs inside webpage
// =====================================================

function getLeaveTime() {

    const TARGET_SECONDS = 8 * 3600;

    function parseClock(str) {
        if (!str || typeof str !== "string") return 0;
        str = str.trim();
        if (!str) return 0;

        const parts = str.split(/\s+/);
        const timePart = parts[0] || "";
        const meridian = (parts[1] || "").toUpperCase();

        const [h = 0, m = 0, s = 0] = timePart.split(":").map(Number);

        let hour = h;
        if (meridian === "PM" && h !== 12) hour = h + 12;
        if (meridian === "AM" && h === 12) hour = 0;

        return hour * 3600 + m * 60 + s;
    }

    function tryTable(table) {
        const thead = table.querySelector("thead");
        const tbody = table.querySelector("tbody");
        if (!thead || !tbody) return null;

        const ths = [...thead.querySelectorAll("th")];
        const headers = ths.map(th => (th.innerText || th.textContent || "").trim());

        const findIdx = (text) => headers.findIndex(h => h && h.includes(text));
        const firstIdx = findIdx("First Punch") >= 0 ? findIdx("First Punch") : findIdx("First In");
        const breakIdx = findIdx("Break Hours");

        if (firstIdx < 0 || breakIdx < 0) return null;

        const row = tbody.querySelector("tr");
        if (!row) return null;

        const cells = [...row.querySelectorAll("td")];
        if (cells.length <= Math.max(firstIdx, breakIdx)) return null;

        const firstInStr = (cells[firstIdx].innerText || cells[firstIdx].textContent || "").trim();
        const breakHrsStr = (cells[breakIdx].innerText || cells[breakIdx].textContent || "").trim();
        if (!firstInStr) return null;

        const firstInSec = parseClock(firstInStr);
        const breakSec = parseClock(breakHrsStr);
        const completion = firstInSec + breakSec + TARGET_SECONDS;

        return {
            firstInStr: firstInStr,
            breakSeconds: breakSec,
            leaveSeconds: completion
        };
    }

    function tryCard() {
        const dtFields = [...document.querySelectorAll(".inout-tims dt")];
        if (dtFields.length === 0) return null;

        function getValue(label) {
            const dt = dtFields.find(el => (el.innerText || el.textContent || "").includes(label));
            if (!dt) return null;
            const text = (dt.innerText || dt.textContent || "").trim();
            const parts = text.split("\n").map(v => v.trim()).filter(Boolean);
            return parts[1] || null;
        }

        const firstIn = getValue("First In");
        const breakHrs = getValue("Break Hours");
        if (!firstIn || !breakHrs) return null;

        const firstInSec = parseClock(firstIn);
        const breakSec = parseClock(breakHrs);
        const completion = firstInSec + breakSec + TARGET_SECONDS;

        return {
            firstInStr: firstIn,
            breakSeconds: breakSec,
            leaveSeconds: completion
        };
    }

    // Try TABLE first (covers projectinouttable1 / First Punch + Break Hours format)
    const tables = [...document.querySelectorAll("table")];
    for (const table of tables) {
        const result = tryTable(table);
        if (result) return result;
    }

    // Then try CARD format (.inout-tims dt)
    return tryCard();
}
