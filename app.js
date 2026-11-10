"use strict";

const form = document.querySelector("#proposal-form");
const field = (name) => form.elements.namedItem(name);
const value = (name) => field(name).value.trim();
const proposal = document.querySelector("#proposal");
const slots = Object.fromEntries(
  [...proposal.querySelectorAll("[data-proposal]")].map((node) => [node.dataset.proposal, node])
);
const placeholders = Object.fromEntries(
  Object.entries(slots).map(([key, node]) => [key, node.textContent])
);
const overview = document.querySelector("#preview-overview");
const deliverables = document.querySelector("#preview-deliverables");
const overviewPlaceholder = overview.textContent.trim();
const deliverablePlaceholder = deliverables.textContent.trim();
const priceHelp = document.querySelector("#price-help");
const priceInstruction = priceHelp.textContent;
const customTermsField = document.querySelector("#custom-terms-field");
const brandMark = document.querySelector("#brand-mark");
let logo = document.querySelector("#preview-logo");
const logoStatus = document.querySelector("#logo-status");
const actionStatus = document.querySelector("#action-status");
const copyDialog = document.querySelector("#copy-dialog");
const manualText = document.querySelector("#manual-text");
const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
});

let logoRevision = 0;
let logoTimer;
let feedbackTimer;

function setText(name, text, fallback = placeholders[name]) {
  slots[name].textContent = text || fallback;
  slots[name].classList.toggle("placeholder", !text);
}

function formatDate(name) {
  const date = field(name).valueAsDate;
  return date ? dateFormatter.format(date) : "";
}

function formatPrice(currency) {
  const amount = value("price").replace(",", ".");
  const formatter = new Intl.NumberFormat("en", {
    style: "currency", currency, currencyDisplay: "code",
  });
  const decimals = formatter.resolvedOptions().maximumFractionDigits;
  const match = /^(\d{1,12})(?:\.(\d+))?$/.exec(amount);
  const valid = match && (match[2]?.length ?? 0) <= decimals;
  const error = Boolean(amount) && !valid;
  field("price").setAttribute("aria-invalid", String(error));
  const decimalInstruction = decimals === 0 ? "whole numbers" : `up to ${decimals} decimal places`;
  priceHelp.textContent = error
    ? `Enter a nonnegative amount with up to 12 digits before the decimal and ${decimalInstruction}.`
    : priceInstruction;
  return valid ? formatter.format(Number(amount)) : "";
}

function renderProposal() {
  for (const name of ["name", "agency", "title", "client", "company", "project"]) {
    setText(name, value(name));
  }
  for (const name of ["date", "expires"]) setText(name, formatDate(name));

  const summary = value("overview");
  const paragraphs = summary ? summary.split(/\n[ \t]*\n+/) : [overviewPlaceholder];
  overview.classList.toggle("placeholder", !summary);
  overview.replaceChildren(...paragraphs.map((text) => {
    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    return paragraph;
  }));

  const items = value("deliverables").split(/\r?\n/)
    .map((line) => line.trim().replace(/^[-*•]\s+/, "")).filter(Boolean);
  deliverables.classList.toggle("placeholder", !items.length);
  deliverables.replaceChildren(...(items.length ? items : [deliverablePlaceholder]).map((text) => {
    const item = document.createElement("li");
    item.textContent = text;
    return item;
  }));

  const currency = value("currency");
  setText("price", formatPrice(currency), `${placeholders.price} (${currency})`);
  const terms = value("terms");
  customTermsField.hidden = terms !== "custom";
  setText("terms", terms === "custom" ? value("custom-terms") : terms);
}

function updateLogo() {
  const revision = ++logoRevision;
  clearTimeout(logoTimer);
  logo.hidden = true;
  logo.removeAttribute("src");
  brandMark.hidden = false;
  field("logo").setAttribute("aria-invalid", "false");
  logoStatus.textContent = "";
  const address = value("logo");
  if (!address) return;

  let url;
  try {
    url = new URL(address);
    if (url.protocol !== "https:" || url.username || url.password) throw new Error("Invalid logo URL");
  } catch {
    logoStatus.textContent = "Enter a valid HTTPS image URL without credentials.";
    field("logo").setAttribute("aria-invalid", "true");
    return;
  }

  logoStatus.textContent = "Loading logo…";
  logoTimer = setTimeout(() => {
    const candidate = new Image();
    candidate.id = logo.id;
    candidate.alt = logo.alt;
    candidate.referrerPolicy = "no-referrer";
    candidate.onload = () => {
      if (revision !== logoRevision) return;
      logo.replaceWith(candidate);
      logo = candidate;
      brandMark.hidden = true;
      logoStatus.textContent = "Logo loaded.";
    };
    candidate.onerror = () => {
      if (revision !== logoRevision) return;
      logoStatus.textContent = "Couldn’t load the logo. Check that the image link is accessible.";
      field("logo").setAttribute("aria-invalid", "true");
    };
    candidate.src = url.href;
  }, 350);
}

function plainText() {
  const linesFor = (selector) => [...proposal.querySelectorAll(selector)].map((node) => node.textContent);
  const headings = linesFor(".section-name");
  const text = (key) => slots[key].textContent;
  const branding = [text("agency")];
  if (!logo.hidden) branding.push(`Logo: ${logo.getAttribute("src")}`);

  return [
    branding.join("\n"),
    "PROJECT PROPOSAL\n" + text("project"),
    [
      `Prepared for: ${text("client")} | ${text("company")}`,
      `Prepared by: ${text("name")} | ${text("title")}`,
      `Issued: ${text("date")}`,
    ].join("\n"),
    [headings[0], linesFor("#preview-overview p").join("\n\n")].join("\n"),
    [headings[1], ...linesFor("#preview-deliverables li").map((item) => `• ${item}`)].join("\n"),
    [
      headings[2],
      `Total investment: ${text("price")}`,
      `Payment terms: ${text("terms")}`,
      `Valid until: ${text("expires")}`,
    ].join("\n"),
  ].join("\n\n");
}

function showFeedback(message) {
  clearTimeout(feedbackTimer);
  actionStatus.textContent = message;
  if (message) feedbackTimer = setTimeout(() => { actionStatus.textContent = ""; }, 5000);
}

form.addEventListener("submit", (event) => event.preventDefault());
form.addEventListener("input", (event) => {
  if (event.target === field("logo")) updateLogo();
  else renderProposal();
  showFeedback("");
});
renderProposal();
if (value("logo")) updateLogo();

document.querySelector("#copy").addEventListener("click", async () => {
  const text = plainText();
  try {
    await navigator.clipboard.writeText(text);
    showFeedback("Proposal text copied to clipboard.");
  } catch {
    showFeedback("");
    manualText.value = text;
    copyDialog.showModal();
    manualText.focus();
    manualText.select();
  }
});

document.querySelector("#print").addEventListener("click", () => window.print());

const viewButtons = document.querySelectorAll(".mobile-switch button");
for (const button of viewButtons) {
  button.addEventListener("click", () => {
    document.body.dataset.mobileView = button.dataset.view;
    for (const option of viewButtons) option.setAttribute("aria-pressed", String(option === button));
    window.scrollTo(0, 0);
  });
}
