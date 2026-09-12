const polarInputs = [
  ["ia-mag", "ia-angle"],
  ["ib-mag", "ib-angle"],
  ["ic-mag", "ic-angle"],
];
const rectangularInputs = [
  ["ia-real", "ia-imag"],
  ["ib-real", "ib-imag"],
  ["ic-real", "ic-imag"],
];
const phaseNames = ["Iₐ", "Iᵦ", "I𝚌"];
const phaseLabels = ["I<sub>A</sub>", "I<sub>B</sub>", "I<sub>C</sub>"];
const componentLabels = ["I<sub>0</sub>", "I<sub>1</sub>", "I<sub>2</sub>"];
const componentDescriptions = ["Thứ tự không", "Thứ tự thuận ABC", "Thứ tự nghịch ACB"];
const phaseColors = ["#12648c", "#049c8c", "#c17a1f"];
const componentColors = ["#8156ad", "#12648c", "#c25f5f"];
const chart = document.getElementById("phasor-chart");
let inputFormat = "polar";
let graphMode = "phase";
let latestValues = null;
let latestComponents = null;

function parseNumber(value) {
  const normalized = value.trim().replace(/\s/g, "").replace(",", ".");
  const number = Number(normalized);
  return normalized !== "" && Number.isFinite(number) ? number : null;
}

function clean(value) {
  return Math.abs(value) < 1e-10 ? 0 : value;
}

function complex(real, imaginary) {
  return { real: clean(real), imaginary: clean(imaginary) };
}

function add(...values) {
  return complex(values.reduce((total, value) => total + value.real, 0), values.reduce((total, value) => total + value.imaginary, 0));
}

function multiply(left, right) {
  return complex(left.real * right.real - left.imaginary * right.imaginary, left.real * right.imaginary + left.imaginary * right.real);
}

function divide(value, divisor) {
  return complex(value.real / divisor, value.imaginary / divisor);
}

function fromPolar(magnitude, angle) {
  const radians = angle * Math.PI / 180;
  return complex(magnitude * Math.cos(radians), magnitude * Math.sin(radians));
}

function magnitude(value) {
  return Math.hypot(value.real, value.imaginary);
}

function angle(value) {
  return magnitude(value) === 0 ? 0 : Math.atan2(value.imaginary, value.real) * 180 / Math.PI;
}

function format(value, digits = 3) {
  const rounded = clean(value);
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: digits }).format(rounded);
}

function formatPolar(value) {
  return `${format(magnitude(value))} ∠ ${format(angle(value), 2)}°`;
}

function formatComplex(value) {
  const imaginary = clean(value.imaginary);
  const operator = imaginary < 0 ? " − j" : " + j";
  return `${format(value.real)}${operator}${format(Math.abs(imaginary))}`;
}

function showError(message = "") {
  const error = document.getElementById("input-error");
  error.textContent = message;
  error.hidden = !message;
}

function readValues() {
  const fields = inputFormat === "polar" ? polarInputs : rectangularInputs;
  const values = fields.map(([firstId, secondId]) => [parseNumber(document.getElementById(firstId).value), parseNumber(document.getElementById(secondId).value)]);
  if (values.some(([first, second]) => first === null || second === null)) {
    showError("Nhập đủ cả ba pha bằng số hợp lệ để tính.");
    return null;
  }
  if (inputFormat === "polar" && values.some(([current]) => current < 0)) {
    showError("Biên độ dòng điện không được âm. Hãy đổi góc pha nếu cần biểu diễn chiều ngược lại.");
    return null;
  }
  showError();
  return inputFormat === "polar"
    ? values.map(([current, phaseAngle]) => fromPolar(current, phaseAngle))
    : values.map(([real, imaginary]) => complex(real, imaginary));
}

function writePolar(values) {
  values.forEach((value, index) => {
    document.getElementById(polarInputs[index][0]).value = format(magnitude(value));
    document.getElementById(polarInputs[index][1]).value = format(angle(value), 4);
  });
}

function writeRectangular(values) {
  values.forEach((value, index) => {
    document.getElementById(rectangularInputs[index][0]).value = format(value.real);
    document.getElementById(rectangularInputs[index][1]).value = format(value.imaginary);
  });
}

function calculateComponents([ia, ib, ic]) {
  const a = fromPolar(1, 120);
  const aSquared = fromPolar(1, 240);
  return [
    divide(add(ia, ib, ic), 3),
    divide(add(ia, multiply(a, ib), multiply(aSquared, ic)), 3),
    divide(add(ia, multiply(aSquared, ib), multiply(a, ic)), 3),
  ];
}

function renderTable(values) {
  document.getElementById("phase-results").innerHTML = values.map((value, index) => `
    <tr><td>${phaseLabels[index]}</td><td>${formatPolar(value)} A</td><td>${formatComplex(value)} A</td></tr>`).join("");
}

function renderComponents(components) {
  document.getElementById("sequence-results").innerHTML = components.map((value, index) => `
    <article class="sequence-item">
      <h3>${componentLabels[index]}</h3>
      <p>${formatPolar(value)} A</p>
      <small>${formatComplex(value)} A<br>${componentDescriptions[index]}</small>
    </article>`).join("");
}

function update() {
  const values = readValues();
  if (!values) {
    latestValues = null;
    latestComponents = null;
    document.getElementById("phase-results").innerHTML = "";
    document.getElementById("sequence-results").innerHTML = "";
    drawChart();
    return;
  }
  const components = calculateComponents(values);
  latestValues = values;
  latestComponents = components;
  renderTable(values);
  renderComponents(components);
  drawChart();
}

function setFormat(nextFormat) {
  if (nextFormat === inputFormat) return;
  const values = readValues();
  if (!values) return;
  if (nextFormat === "polar") writePolar(values);
  else writeRectangular(values);
  inputFormat = nextFormat;
  document.getElementById("polar-fields").hidden = nextFormat !== "polar";
  document.getElementById("rectangular-fields").hidden = nextFormat !== "rectangular";
  document.querySelectorAll("[data-format]").forEach((button) => {
    const selected = button.dataset.format === nextFormat;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-selected", String(selected));
  });
  update();
}

function setGraph(nextGraph) {
  graphMode = nextGraph;
  document.querySelectorAll("[data-graph]").forEach((button) => {
    const selected = button.dataset.graph === nextGraph;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-selected", String(selected));
  });
  drawChart();
}

function drawArrow(context, x1, y1, x2, y2, color, label) {
  const headLength = 9;
  const direction = Math.atan2(y2 - y1, x2 - x1);
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineWidth = 2.7;
  context.beginPath();
  context.moveTo(x1, y1);
  context.lineTo(x2, y2);
  context.stroke();
  context.beginPath();
  context.moveTo(x2, y2);
  context.lineTo(x2 - headLength * Math.cos(direction - Math.PI / 6), y2 - headLength * Math.sin(direction - Math.PI / 6));
  context.lineTo(x2 - headLength * Math.cos(direction + Math.PI / 6), y2 - headLength * Math.sin(direction + Math.PI / 6));
  context.closePath();
  context.fill();
  context.font = "700 12px system-ui, sans-serif";
  context.fillText(label, x2 + (x2 >= x1 ? 7 : -22), y2 + (y2 >= y1 ? 15 : -7));
}

function drawChart() {
  const rect = chart.getBoundingClientRect();
  const width = Math.max(280, Math.round(rect.width));
  const height = Math.max(270, Math.round(rect.height));
  const ratio = window.devicePixelRatio || 1;
  chart.width = width * ratio;
  chart.height = height * ratio;
  const context = chart.getContext("2d");
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  const values = graphMode === "phase" ? latestValues : latestComponents;
  const labels = graphMode === "phase" ? phaseNames : ["I₀", "I₁", "I₂"];
  const colors = graphMode === "phase" ? phaseColors : componentColors;
  const title = graphMode === "phase" ? "Biểu đồ vector ba dòng pha" : "Biểu đồ vector các thành phần đối xứng";
  if (!values) {
    context.fillStyle = "#667982";
    context.font = "14px system-ui, sans-serif";
    context.textAlign = "center";
    context.fillText("Nhập số liệu để vẽ biểu đồ", width / 2, height / 2);
    document.getElementById("chart-summary").textContent = "Chờ số liệu ba pha hợp lệ.";
    chart.setAttribute("aria-label", "Chưa có số liệu để hiển thị biểu đồ vector");
    return;
  }
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.32;
  const maximum = Math.max(...values.map(magnitude), 0.001) * 1.18;
  context.strokeStyle = "#d8e2e5";
  context.lineWidth = 1;
  [1 / 3, 2 / 3, 1].forEach((portion) => {
    context.beginPath();
    context.arc(centerX, centerY, radius * portion, 0, Math.PI * 2);
    context.stroke();
  });
  context.strokeStyle = "#aab9bf";
  context.beginPath();
  context.moveTo(centerX - radius * 1.25, centerY);
  context.lineTo(centerX + radius * 1.25, centerY);
  context.moveTo(centerX, centerY + radius * 1.25);
  context.lineTo(centerX, centerY - radius * 1.25);
  context.stroke();
  context.fillStyle = "#63747d";
  context.font = "12px system-ui, sans-serif";
  context.textAlign = "left";
  context.fillText("Thực (A)", Math.min(width - 60, centerX + radius * 1.24), centerY - 7);
  context.fillText("Ảo (A)", centerX + 7, Math.max(14, centerY - radius * 1.2));
  values.forEach((value, index) => {
    const x = centerX + value.real / maximum * radius;
    const y = centerY - value.imaginary / maximum * radius;
    drawArrow(context, centerX, centerY, x, y, colors[index], labels[index]);
  });
  const listed = values.map((value, index) => `${labels[index]} ${formatPolar(value)} A`).join("; ");
  document.getElementById("chart-summary").textContent = `${title}: ${listed}.`;
  chart.setAttribute("aria-label", `${title}. ${listed}.`);
}

document.querySelectorAll("[data-format]").forEach((button) => button.addEventListener("click", () => setFormat(button.dataset.format)));
document.querySelectorAll("[data-graph]").forEach((button) => button.addEventListener("click", () => setGraph(button.dataset.graph)));
[...polarInputs.flat(), ...rectangularInputs.flat()].forEach((id) => document.getElementById(id).addEventListener("input", update));
document.getElementById("balanced-button").addEventListener("click", () => {
  inputFormat = "polar";
  writePolar([fromPolar(10, 0), fromPolar(10, -120), fromPolar(10, 120)]);
  document.getElementById("polar-fields").hidden = false;
  document.getElementById("rectangular-fields").hidden = true;
  document.querySelectorAll("[data-format]").forEach((button) => {
    const selected = button.dataset.format === "polar";
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-selected", String(selected));
  });
  update();
});
window.addEventListener("resize", drawChart);
update();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("service-worker.js"));
}
