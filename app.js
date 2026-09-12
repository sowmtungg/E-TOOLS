const groups = {
  current: {
    inputs: ["current-l1", "current-l2", "current-l3"],
    limit: "current-limit",
    result: "current-results",
    unit: "A",
    label: "Lệch dòng lớn nhất",
    meanLabel: "Dòng trung bình",
    phaseNames: ["Pha A", "Pha B", "Pha C"],
  },
  resistance: {
    inputs: ["resistance-u-v", "resistance-v-w", "resistance-w-u"],
    limit: "resistance-limit",
    result: "resistance-results",
    unit: "Ω",
    label: "Lệch trở lớn nhất",
    meanLabel: "Điện trở trung bình",
    phaseNames: ["U–V", "V–W", "W–U"],
  },
};

let activeGroup = "current";
const numberFormat = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 });

function parseNumber(value) {
  const normalized = value.trim().replace(/\s/g, "").replace(",", ".");
  const number = Number(normalized);
  return normalized !== "" && Number.isFinite(number) && number >= 0 ? number : null;
}

function formatNumber(value) {
  return numberFormat.format(value);
}

function calculate(groupName) {
  const group = groups[groupName];
  const values = group.inputs.map((id) => parseNumber(document.getElementById(id).value));
  const result = document.getElementById(group.result);
  const shareButton = document.getElementById("share-button");

  if (values.some((value) => value === null)) {
    result.className = "result-card empty";
    result.innerHTML = "<p>Nhập đủ 3 giá trị không âm để xem kết quả.</p>";
    if (groupName === activeGroup) shareButton.disabled = true;
    return null;
  }

  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (average === 0) {
    result.className = "result-card empty";
    result.innerHTML = "<p>Không thể tính tỷ lệ lệch khi cả ba giá trị đều bằng 0.</p>";
    if (groupName === activeGroup) shareButton.disabled = true;
    return null;
  }

  const deviations = values.map((value) => Math.abs(value - average) / average * 100);
  const maxDeviation = Math.max(...deviations);
  const highestIndex = deviations.indexOf(maxDeviation);
  const threshold = parseNumber(document.getElementById(group.limit).value) ?? 0;
  const isWithinLimit = maxDeviation <= threshold;
  const statusClass = isWithinLimit ? "ok" : "warn";
  const statusText = isWithinLimit ? "Trong ngưỡng" : "Cần kiểm tra";

  result.className = "result-card";
  result.innerHTML = `
    <div class="result-main">
      <div>
        <p class="result-label">${group.label}</p>
        <p class="result-value">${formatNumber(maxDeviation)}%</p>
      </div>
      <span class="status ${statusClass}">${statusText}</span>
    </div>
    <div class="result-details">
      <div><span class="detail-label">${group.meanLabel}</span><span class="detail-value">${formatNumber(average)} ${group.unit}</span></div>
      <div><span class="detail-label">Pha lệch nhiều nhất</span><span class="detail-value">${group.phaseNames[highestIndex]} · ${formatNumber(values[highestIndex])} ${group.unit}</span></div>
    </div>`;

  const calculation = { groupName, values, average, maxDeviation, threshold, highestIndex };
  if (groupName === activeGroup) shareButton.disabled = false;
  return calculation;
}

function showTab(targetId) {
  const groupName = targetId === "current-panel" ? "current" : "resistance";
  activeGroup = groupName;
  document.querySelectorAll(".tab").forEach((tab) => {
    const selected = tab.dataset.target === targetId;
    tab.classList.toggle("is-active", selected);
    tab.setAttribute("aria-selected", String(selected));
  });
  document.querySelectorAll(".calculator-panel").forEach((panel) => {
    const selected = panel.id === targetId;
    panel.hidden = !selected;
    panel.classList.toggle("is-active", selected);
  });
  calculate(groupName);
}

document.querySelectorAll(".tab").forEach((tab) => tab.addEventListener("click", () => showTab(tab.dataset.target)));

Object.values(groups).forEach((group) => {
  [...group.inputs, group.limit].forEach((id) => {
    document.getElementById(id).addEventListener("input", () => calculate(group === groups.current ? "current" : "resistance"));
  });
});

document.getElementById("winding-type").addEventListener("change", (event) => {
  document.getElementById("resistance-limit").value = event.target.value;
  calculate("resistance");
});

document.getElementById("reset-button").addEventListener("click", () => {
  Object.values(groups).forEach((group) => {
    group.inputs.forEach((id) => { document.getElementById(id).value = ""; });
    calculate(group === groups.current ? "current" : "resistance");
  });
  document.getElementById(groups[activeGroup].inputs[0]).focus();
});

document.getElementById("share-button").addEventListener("click", async () => {
  const group = groups[activeGroup];
  const calculation = calculate(activeGroup);
  if (!calculation) return;
  const names = group.phaseNames;
  const values = calculation.values.map((value, index) => `${names[index]}: ${formatNumber(value)} ${group.unit}`).join(" | ");
  const text = `Kiểm tra động cơ 3 pha\n${activeGroup === "current" ? "Lệch dòng" : "Lệch điện trở"}: ${formatNumber(calculation.maxDeviation)}%\n${group.meanLabel}: ${formatNumber(calculation.average)} ${group.unit}\n${values}\nNgưỡng cài đặt: ${formatNumber(calculation.threshold)}%`;
  try {
    if (navigator.share) {
      await navigator.share({ title: "Kết quả kiểm tra động cơ", text });
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      const button = document.getElementById("share-button");
      const original = button.textContent;
      button.textContent = "Đã chép kết quả";
      setTimeout(() => { button.textContent = original; }, 1800);
    }
  } catch (error) {
    if (error.name !== "AbortError") console.warn("Không thể chia sẻ kết quả", error);
  }
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("service-worker.js"));
}
