/*
  Indigenize Toys Pilot Portal (prototype): Language Bear workflow.

  Plain JavaScript, no framework. Read top to bottom:
    1. State
    2. Helpers (formatting, filenames)
    3. Rendering (hotspots, list, panel, meter, review)
    4. Actions (select, add, remove, reorder, record)
    5. Package (manifest + ZIP)
    6. Init

  Nothing here talks to a server. Files stay in browser memory until the
  user downloads the package.
*/

(function () {
  "use strict";

  const CFG = window.PORTAL_CONFIG;
  const TPS = CFG.touchpoints;

  /* ---------- 1. State ---------- */

  const state = {
    selected: TPS[0].id,
    recordings: {},          // touchpoint id -> array of recording objects
    submissionId: null,
    recorder: null,
    timer: null
  };
  TPS.forEach((tp) => { state.recordings[tp.id] = []; });

  let uidCounter = 0;
  let recordingCounter = 0;

  /* ---------- 2. Helpers ---------- */

  const $ = (id) => document.getElementById(id);

  function tpById(id) { return TPS.find((t) => t.id === id); }

  function formatBytes(bytes) {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  function formatDuration(seconds) {
    if (seconds == null || !isFinite(seconds)) return "";
    const s = Math.round(seconds);
    const m = Math.floor(s / 60);
    return m + ":" + String(s % 60).padStart(2, "0");
  }

  function extensionOf(name) {
    const m = /\.([a-z0-9]+)$/i.exec(name || "");
    return m ? m[1].toLowerCase() : "";
  }

  /* Turns "Grandma's welcome song.WAV" into "Grandma-s-welcome-song"
     so filenames are safe on any device or SD card. */
  function safeBaseName(name) {
    const base = (name || "").replace(/\.[a-z0-9]+$/i, "");
    const cleaned = base.normalize("NFKD").replace(/[^\x20-\x7E]/g, "")
      .replace(/[^A-Za-z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^[-.]+|[-.]+$/g, "");
    return (cleaned || "recording").slice(0, 40);
  }

  function productionFilename(rec, order) {
    return String(order).padStart(2, "0") + "_" + safeBaseName(rec.name) + "." + rec.format;
  }

  function totals() {
    let bytes = 0, count = 0, filled = 0;
    TPS.forEach((tp) => {
      const list = state.recordings[tp.id];
      if (list.length) filled++;
      list.forEach((r) => { bytes += r.bytes; count++; });
    });
    return { bytes, count, filled };
  }

  function probeDuration(url) {
    return new Promise((resolve) => {
      const a = new Audio();
      a.preload = "metadata";
      a.onloadedmetadata = () => resolve(isFinite(a.duration) ? a.duration : null);
      a.onerror = () => resolve(null);
      a.src = url;
    });
  }

  function setStatus(id, message, isError) {
    const el = $(id);
    el.textContent = message || "";
    el.classList.toggle("is-error", !!isError);
  }

  /* Hotspot coordinates, honouring the left/right perspective setting. */
  function hotspotPosition(tp) {
    if (CFG.perspective !== "bear" || !tp.side) return { x: tp.x, y: tp.y };
    const partnerId = tp.side === "left" ? tp.id + 1 : tp.id - 1;
    const partner = tpById(partnerId) || tp;
    return { x: partner.x, y: partner.y };
  }

  /* ---------- 3. Rendering ---------- */

  function renderHotspots() {
    const wrap = $("hotspots");
    wrap.innerHTML = "";
    TPS.forEach((tp) => {
      const list = state.recordings[tp.id];
      const pos = hotspotPosition(tp);
      const b = document.createElement("button");
      b.type = "button";
      b.className = "hotspot" + (list.length ? " has-rec" : "") + (tp.id === state.selected ? " is-selected" : "");
      b.style.left = pos.x + "%";
      b.style.top = pos.y + "%";
      b.dataset.id = tp.id;
      b.setAttribute("aria-pressed", tp.id === state.selected ? "true" : "false");
      b.setAttribute("aria-label", tp.label + ", " + list.length + (list.length === 1 ? " recording" : " recordings"));
      b.innerHTML = "<span aria-hidden='true'>" + tp.id + "</span>" +
        (list.length ? "<span class='count' aria-hidden='true'>" + list.length + "</span>" : "") +
        (tp.id === state.selected ? "<span class='name' aria-hidden='true'>" + tp.label + "</span>" : "");
      b.addEventListener("click", () => selectTouchpoint(tp.id));
      wrap.appendChild(b);
    });
  }

  function renderList() {
    const ul = $("tp-list");
    ul.innerHTML = "";
    TPS.forEach((tp) => {
      const list = state.recordings[tp.id];
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button";
      b.className = (list.length ? "has-rec" : "") + (tp.id === state.selected ? " is-selected" : "");
      b.setAttribute("aria-pressed", tp.id === state.selected ? "true" : "false");
      b.innerHTML = "<span class='num' aria-hidden='true'>" + tp.id + "</span>" +
        "<span>" + tp.label + "</span>" +
        "<span class='cnt'>" + (list.length ? list.length : "") + "</span>";
      b.addEventListener("click", () => selectTouchpoint(tp.id));
      li.appendChild(b);
      ul.appendChild(li);
    });
  }

  function renderPanel() {
    const tp = tpById(state.selected);
    const list = state.recordings[tp.id];
    $("panel-title").textContent = tp.label;
    $("panel-folder").textContent = tp.folder;
    $("prev-tp").disabled = tp.id === TPS[0].id;
    $("next-tp").disabled = tp.id === TPS[TPS.length - 1].id;

    const ol = $("rec-list");
    ol.innerHTML = "";
    $("rec-empty").hidden = list.length > 0;

    list.forEach((rec, i) => {
      const li = document.createElement("li");
      li.className = "rec-item";
      li.innerHTML =
        "<span class='rec-order' aria-label='Plays " + (i + 1) + "'>" + (i + 1) + "</span>" +
        "<div>" +
          "<div class='rec-name'>" + escapeHtml(rec.name) + "</div>" +
          "<div class='rec-meta'>" +
            "<span class='fmt'>" + rec.format + "</span>" +
            "<span>" + formatBytes(rec.bytes) + "</span>" +
            (rec.duration != null ? "<span>" + formatDuration(rec.duration) + "</span>" : "") +
            "<span>" + (rec.source === "microphone" ? "Recorded here" : "Uploaded") + "</span>" +
            "<span>Saved as <code>" + productionFilename(rec, i + 1) + "</code></span>" +
          "</div>" +
        "</div>" +
        "<div class='rec-actions'>" +
          "<button type='button' class='btn-icon' data-act='up' " + (i === 0 ? "disabled" : "") + " aria-label='Move up'>&uarr;</button>" +
          "<button type='button' class='btn-icon' data-act='down' " + (i === list.length - 1 ? "disabled" : "") + " aria-label='Move down'>&darr;</button>" +
          "<button type='button' class='btn-icon btn-danger' data-act='remove' aria-label='Remove " + escapeHtml(rec.name) + "'>Remove</button>" +
        "</div>" +
        "<audio controls preload='metadata' src='" + rec.url + "' aria-label='Preview " + escapeHtml(rec.name) + "'></audio>";
      li.querySelectorAll("[data-act]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const act = btn.dataset.act;
          if (act === "up") moveRecording(tp.id, rec.uid, -1);
          if (act === "down") moveRecording(tp.id, rec.uid, 1);
          if (act === "remove") removeRecording(tp.id, rec.uid);
        });
      });
      ol.appendChild(li);
    });
  }

  function renderMeter() {
    const t = totals();
    const ratio = t.bytes / CFG.capacityBytes;
    const bar = $("storage-bar");
    $("meter-used").textContent = formatBytes(t.bytes);
    $("meter-fill").style.width = Math.min(100, ratio * 100) + "%";
    bar.classList.toggle("is-warn", ratio >= CFG.warnAt && ratio <= 1);
    bar.classList.toggle("is-over", ratio > 1);
    let warn = "";
    if (ratio > 1) warn = "Over the bear's capacity by " + formatBytes(t.bytes - CFG.capacityBytes) + ". Remove or shorten some recordings.";
    else if (ratio >= CFG.warnAt) warn = "Getting close to the limit. About " + formatBytes(CFG.capacityBytes - t.bytes) + " left.";
    $("meter-warn").textContent = warn;
    $("progress-text").textContent = t.filled + " of " + TPS.length + " touch points have recordings";
  }

  function renderReview() {
    const d = readDetails();
    const rows = [
      ["Community", d.community], ["Language", d.language], ["Contact", d.contact_name],
      ["Email", d.email], ["Phone", d.phone], ["Notes", d.notes]
    ];
    $("review-details").innerHTML = rows.map(([k, v]) =>
      "<tr><td>" + k + "</td><td>" + (v ? escapeHtml(v) : "<span class='" + (isRequired(k) ? "missing" : "empty") + "'>" +
      (isRequired(k) ? "Missing" : "Not given") + "</span>") + "</td></tr>").join("");

    const t = totals();
    let html = "";
    TPS.forEach((tp) => {
      const list = state.recordings[tp.id];
      html += "<tr><td>" + tp.id + ". " + tp.label + "</td><td>";
      if (!list.length) html += "<span class='empty'>No recordings</span>";
      else html += list.map((r, i) => (i + 1) + ". " + escapeHtml(r.name) + " <span class='muted'>(" + formatBytes(r.bytes) + ")</span>").join("<br>");
      html += "</td></tr>";
    });
    html += "<tr class='total'><td>Total</td><td>" + t.count + (t.count === 1 ? " recording, " : " recordings, ") +
      formatBytes(t.bytes) + " of about " + formatBytes(CFG.capacityBytes) + "</td></tr>";
    $("review-recordings").innerHTML = html;
  }

  function isRequired(label) { return ["Community", "Language", "Contact", "Email"].includes(label); }

  function renderAll() {
    renderHotspots();
    renderList();
    renderPanel();
    renderMeter();
    renderReview();
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  /* ---------- 4. Actions ---------- */

  function selectTouchpoint(id) {
    if (state.recorder) return; // don't switch mid-recording
    state.selected = id;
    setStatus("status-line", "");
    renderHotspots();
    renderList();
    renderPanel();
    if (window.matchMedia("(max-width: 900px)").matches) {
      $("tp-panel").scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function makeRecording(file, blob, source, duration) {
    const format = extensionOf(file.name) || "wav";
    return {
      uid: ++uidCounter,
      name: file.name,
      blob: blob,
      bytes: blob.size,
      format: format,
      source: source,
      duration: duration,
      url: URL.createObjectURL(blob)
    };
  }

  async function addFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const tpId = state.selected;
    const rejected = [];
    for (const file of files) {
      const ext = extensionOf(file.name);
      if (!CFG.acceptedExtensions.includes(ext)) { rejected.push(file.name); continue; }
      const rec = makeRecording(file, file, "upload", null);
      state.recordings[tpId].push(rec);
      probeDuration(rec.url).then((d) => { rec.duration = d; if (state.selected === tpId) renderPanel(); });
    }
    renderAll();
    const added = files.length - rejected.length;
    let msg = added ? "Added " + added + (added === 1 ? " recording" : " recordings") + " to " + tpById(tpId).label + "." : "";
    if (rejected.length) msg += " Skipped (not MP3 or WAV): " + rejected.join(", ");
    setStatus("status-line", msg, rejected.length > 0);
  }

  function addMicrophoneRecording(blob, duration) {
    recordingCounter++;
    const tp = tpById(state.selected);
    const name = "recording-" + String(recordingCounter).padStart(2, "0") + ".wav";
    const rec = makeRecording({ name: name }, blob, "microphone", duration);
    state.recordings[tp.id].push(rec);
    renderAll();
    setStatus("status-line", "Saved " + name + " (" + formatDuration(duration) + ") to " + tp.label + ". Press play to check it.");
  }

  function removeRecording(tpId, uid) {
    const list = state.recordings[tpId];
    const idx = list.findIndex((r) => r.uid === uid);
    if (idx < 0) return;
    URL.revokeObjectURL(list[idx].url);
    const removed = list.splice(idx, 1)[0];
    renderAll();
    setStatus("status-line", "Removed " + removed.name + ".");
  }

  function moveRecording(tpId, uid, delta) {
    const list = state.recordings[tpId];
    const idx = list.findIndex((r) => r.uid === uid);
    const to = idx + delta;
    if (idx < 0 || to < 0 || to >= list.length) return;
    const item = list.splice(idx, 1)[0];
    list.splice(to, 0, item);
    renderPanel();
    renderReview();
    setStatus("status-line", item.name + " now plays " + (to + 1) + (to === 0 ? "st" : to === 1 ? "nd" : to === 2 ? "rd" : "th") + ".");
  }

  async function toggleRecording() {
    const btn = $("record-btn");
    if (state.recorder) { await stopRecording(); return; }
    if (!window.WavRecorder || !WavRecorder.isSupported()) {
      setStatus("status-line", "This browser cannot record. Please upload a file instead.", true);
      return;
    }
    const rec = new WavRecorder({
      sampleRate: CFG.recording.sampleRate,
      maxSeconds: CFG.recording.maxSeconds,
      onMaxReached: () => stopRecording()
    });
    try {
      await rec.start();
    } catch (err) {
      setStatus("status-line", "Microphone not available. Check the browser's permission, or upload a file instead.", true);
      return;
    }
    state.recorder = rec;
    btn.classList.add("is-recording");
    btn.innerHTML = "<span class='rec-dot' aria-hidden='true'></span> Stop recording";
    btn.setAttribute("aria-pressed", "true");
    $("record-hint").textContent = "Recording. Press again when you are finished.";
    setStatus("status-line", "");
    state.timer = setInterval(() => { $("rec-timer").textContent = formatDuration(rec.elapsedSeconds()); }, 250);
  }

  async function stopRecording() {
    const rec = state.recorder;
    if (!rec) return;
    state.recorder = null;
    clearInterval(state.timer);
    const btn = $("record-btn");
    btn.classList.remove("is-recording");
    btn.innerHTML = "<span class='rec-dot' aria-hidden='true'></span> Record with microphone";
    btn.setAttribute("aria-pressed", "false");
    $("record-hint").textContent = "Press, speak, then press again to stop.";
    $("rec-timer").textContent = "";
    const result = await rec.stop();
    if (result.duration < 0.3) {
      setStatus("status-line", "That recording was too short to keep. Try again.", true);
      return;
    }
    addMicrophoneRecording(result.blob, result.duration);
  }

  /* ---------- Details form ---------- */

  function readDetails() {
    const f = $("details-form");
    const val = (n) => (f.elements[n] ? f.elements[n].value.trim() : "");
    return {
      community: val("community"), language: val("language"), contact_name: val("contact_name"),
      email: val("email"), phone: val("phone"), notes: val("notes")
    };
  }

  function validateDetails() {
    const f = $("details-form");
    let ok = true, first = null;
    ["community", "language", "contact_name", "email"].forEach((n) => {
      const el = f.elements[n];
      const bad = !el.value.trim() || (n === "email" && !el.checkValidity());
      el.classList.toggle("is-invalid", bad);
      el.setAttribute("aria-invalid", bad ? "true" : "false");
      if (bad) { ok = false; first = first || el; }
    });
    if (first) first.focus();
    return ok;
  }

  /* ---------- 5. Package ---------- */

  function newSubmissionId() {
    const year = new Date().getFullYear();
    const n = String(Math.floor(Math.random() * 1000000)).padStart(6, "0");
    return CFG.submissionIdPrefix + "-" + year + "-" + n;
  }

  function buildManifest(submissionId, details, now) {
    const t = totals();
    return {
      schema_version: "0.1-prototype",
      submission_id: submissionId,
      product: CFG.product,
      product_label: CFG.productLabel,
      created_at: now.toISOString(),
      status: "submitted",
      pilot: details,
      acknowledgement: { text: CFG.acknowledgementText, accepted: true, accepted_at: now.toISOString() },
      capacity_bytes: CFG.capacityBytes,
      total_bytes: t.bytes,
      total_recordings: t.count,
      left_right_perspective: CFG.perspective,
      touchpoints: TPS.map((tp) => ({
        id: tp.id,
        folder: tp.folder,
        label: tp.label,
        recordings: state.recordings[tp.id].map((r, i) => ({
          order: i + 1,
          filename: productionFilename(r, i + 1),
          original_filename: r.name,
          source: r.source,
          format: r.format,
          bytes: r.bytes,
          duration_seconds: r.duration != null ? Math.round(r.duration * 10) / 10 : null
        }))
      })),
      generated_by: "Indigenize Toys pilot portal prototype (generated in the browser, nothing uploaded)"
    };
  }

  function buildSummary(m) {
    const lines = [];
    lines.push("INDIGENIZE TOYS - LANGUAGE BEAR PILOT PACKAGE");
    lines.push("Submission: " + m.submission_id);
    lines.push("Created:    " + m.created_at);
    lines.push("");
    lines.push("Community:  " + m.pilot.community);
    lines.push("Language:   " + m.pilot.language);
    lines.push("Contact:    " + m.pilot.contact_name + " <" + m.pilot.email + ">" + (m.pilot.phone ? " " + m.pilot.phone : ""));
    if (m.pilot.notes) { lines.push("Notes:      " + m.pilot.notes); }
    lines.push("");
    lines.push("Total: " + m.total_recordings + " recordings, " + formatBytes(m.total_bytes) + " of " + formatBytes(m.capacity_bytes));
    lines.push("Left/right perspective: " + m.left_right_perspective + " (see config.js)");
    lines.push("");
    m.touchpoints.forEach((tp) => {
      lines.push(tp.folder + "/  (" + tp.label + ")");
      if (!tp.recordings.length) lines.push("    (empty)");
      tp.recordings.forEach((r) => {
        lines.push("    " + r.filename + "  " + formatBytes(r.bytes) + (r.duration_seconds != null ? "  " + formatDuration(r.duration_seconds) : "") +
          "  from: " + r.original_filename + " (" + r.source + ")");
      });
    });
    lines.push("");
    lines.push("Copy each folder's files onto the bear's matching folder. The numeric prefix keeps playback order.");
    return lines.join("\n");
  }

  async function downloadPackage() {
    const btn = $("download-btn");
    setStatus("review-status", "");
    const t = totals();
    if (!validateDetails()) { setStatus("review-status", "Please fill in the required pilot details in Step 1.", true); return; }
    if (!t.count) { setStatus("review-status", "Add at least one recording to the bear first.", true); return; }
    if (t.bytes > CFG.capacityBytes) { setStatus("review-status", "The recordings are over the bear's capacity. Remove or shorten some first.", true); return; }
    if (!$("ack").checked) { setStatus("review-status", "Please confirm you have permission to provide these recordings.", true); $("ack").focus(); return; }
    if (!window.JSZip) { setStatus("review-status", "The ZIP library did not load. Check assets/vendor/jszip.min.js.", true); return; }

    btn.disabled = true;
    setStatus("review-status", "Building the package...");
    try {
      const now = new Date();
      const id = state.submissionId || (state.submissionId = newSubmissionId());
      const details = readDetails();
      const manifest = buildManifest(id, details, now);

      const zip = new JSZip();
      const root = zip.folder(id);
      root.file("manifest.json", JSON.stringify(manifest, null, 2));
      root.file("SUMMARY.txt", buildSummary(manifest));
      TPS.forEach((tp) => {
        const folder = root.folder(tp.folder);   // created even when empty
        state.recordings[tp.id].forEach((r, i) => {
          folder.file(productionFilename(r, i + 1), r.blob);
        });
      });
      const blob = await zip.generateAsync({ type: "blob", compression: "STORE" });
      const filename = id + "_bear.zip";
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);

      $("result-id").textContent = id;
      $("result-text").textContent = "Saved as " + filename + " (" + formatBytes(blob.size) + "). " +
        "In the production portal this package would be delivered to Indigenize Toys automatically. " +
        "For this prototype, keep the file and send it to Indigenize Toys the way you agreed.";
      $("result").hidden = false;
      setStatus("review-status", "Package created.");
      $("result").scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (err) {
      console.error(err);
      setStatus("review-status", "Something went wrong while building the package: " + err.message, true);
    } finally {
      btn.disabled = false;
    }
  }

  function resetAll() {
    if (!confirm("Start over? This removes all recordings and details on this page.")) return;
    TPS.forEach((tp) => {
      state.recordings[tp.id].forEach((r) => URL.revokeObjectURL(r.url));
      state.recordings[tp.id] = [];
    });
    state.submissionId = null;
    $("details-form").reset();
    $("ack").checked = false;
    $("result").hidden = true;
    state.selected = TPS[0].id;
    setStatus("status-line", "");
    setStatus("review-status", "");
    renderAll();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ---------- 6. Init ---------- */

  function init() {
    $("help-link").href = CFG.helpUrl;
    $("meter-cap").textContent = formatBytes(CFG.capacityBytes);
    $("ack-text").textContent = CFG.acknowledgementText;
    $("bear-image").src = CFG.bearImage.src;
    $("bear-image").alt = CFG.bearImage.alt;
    $("file-input").accept = CFG.acceptedExtensions.map((e) => "." + e).join(",");

    $("file-input").addEventListener("change", (e) => { addFiles(e.target.files); e.target.value = ""; });
    $("record-btn").addEventListener("click", toggleRecording);
    $("prev-tp").addEventListener("click", () => selectTouchpoint(state.selected - 1));
    $("next-tp").addEventListener("click", () => selectTouchpoint(state.selected + 1));
    $("download-btn").addEventListener("click", downloadPackage);
    $("reset-btn").addEventListener("click", resetAll);
    $("details-form").addEventListener("input", renderReview);
    $("details-form").addEventListener("submit", (e) => e.preventDefault());

    // Drag-and-drop files onto the panel.
    const panel = $("tp-panel");
    ["dragenter", "dragover"].forEach((ev) => panel.addEventListener(ev, (e) => { e.preventDefault(); panel.classList.add("is-drop"); }));
    ["dragleave", "drop"].forEach((ev) => panel.addEventListener(ev, (e) => { e.preventDefault(); panel.classList.remove("is-drop"); }));
    panel.addEventListener("drop", (e) => addFiles(e.dataTransfer.files));

    if (!window.WavRecorder || !WavRecorder.isSupported()) {
      $("record-btn").disabled = true;
      $("record-hint").textContent = "Recording is not available in this browser. Upload a file instead.";
    }

    window.addEventListener("beforeunload", (e) => {
      if (totals().count && $("result").hidden) { e.preventDefault(); e.returnValue = ""; }
    });

    renderAll();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
