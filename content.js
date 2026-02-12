(function () {

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

    function formatClock(sec) {
        sec = sec % (24 * 3600);

        let h = Math.floor(sec / 3600);
        let m = Math.floor((sec % 3600) / 60);
        let s = sec % 60;

        let ampm = h >= 12 ? "PM" : "AM";
        h = h % 12 || 12;

        return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")} ${ampm}`;
    }

    // ===== Prevent duplicate insertion =====
    if (document.querySelector(".leave-time-added")) return;

    // ================= DT Layout =================
    const dtFields = [...document.querySelectorAll(".inout-tims dt")];

    if (dtFields.length) {

        function getValue(label) {
            const dt = dtFields.find(el => el.innerText.includes(label));
            if (!dt) return null;

            const parts = dt.innerText.split("\n").map(v => v.trim());
            return { value: parts[1], node: dt };
        }

        const firstIn = getValue("First In");
        const breakHrs = getValue("Break Hours");
        const working = getValue("Working Hour");

        if (firstIn && breakHrs && working) {

            const completion =
                parseClock(firstIn.value) +
                parseClock(breakHrs.value) +
                TARGET_SECONDS;

            const newDt = working.node.cloneNode(true);
            newDt.innerHTML = `You Can Leave At<br>${formatClock(completion)}`;
            newDt.classList.add("leave-time-added");

            working.node.parentElement.appendChild(newDt);
        }

        return;
    }

    // ================= Table Layout (First Punch + Break Hours) =================
    const tables = [...document.querySelectorAll("table")];
    let table = null;
    let firstIdx = -1;
    let breakIdx = -1;

    for (const t of tables) {
        const ths = [...t.querySelectorAll("thead th")];
        const headers = ths.map(th => (th.innerText || th.textContent || "").trim());
        const findIdx = (text) => headers.findIndex(h => h && h.includes(text));
        const f = findIdx("First Punch") >= 0 ? findIdx("First Punch") : findIdx("First In");
        const b = findIdx("Break Hours");
        if (f >= 0 && b >= 0 && t.querySelector("tbody tr")) {
            table = t;
            firstIdx = f;
            breakIdx = b;
            break;
        }
    }

    if (!table || firstIdx === -1 || breakIdx === -1) return;

    const headers = [...table.querySelectorAll("thead th")];
    const workingIdx = headers.findIndex(th => (th.innerText || th.textContent || "").trim().includes("Working Hour"));
    if (workingIdx === -1) return;

    const headerRow = headers[0].parentElement;

    if ([...headerRow.children].some(th => th.innerText === "You Can Leave At")) return;

    // Add header
    const newTh = document.createElement("th");
    newTh.innerText = "You Can Leave At";
    newTh.classList.add("leave-time-added");
    headerRow.appendChild(newTh);

    // Add row value
    const row = table.querySelector("tbody tr");
    const cells = row.querySelectorAll("td");

    const completion =
        parseClock((cells[firstIdx].innerText || cells[firstIdx].textContent || "").trim()) +
        parseClock((cells[breakIdx].innerText || cells[breakIdx].textContent || "").trim()) +
        TARGET_SECONDS;

    const newTd = document.createElement("td");
    newTd.innerText = formatClock(completion);
    newTd.classList.add("leave-time-added");

    row.appendChild(newTd);

})();
