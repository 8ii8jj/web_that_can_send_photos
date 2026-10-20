import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Compresses an image file down to a small JPEG data URL so it can be stored
// directly inside the Firestore document — no Firebase Storage (and no paid
// Blaze plan) needed at all.
function compressImage(file, maxWidth = 1000, targetBytes = 180 * 1024) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth) {
          height = Math.round(height * (maxWidth / width));
          width = maxWidth;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);

        let quality = 0.8;
        let dataUrl = canvas.toDataURL("image/jpeg", quality);
        // base64 text is ~37% larger than the raw bytes it encodes
        while (dataUrl.length > targetBytes * 1.37 && quality > 0.3) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL("image/jpeg", quality);
        }
        resolve(dataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

let selectedFiles = [];

const fileInput = document.getElementById("s1-img-input");
const dropzone = document.getElementById("s1-dropzone");
const previewGrid = document.getElementById("s1-preview-grid");
const countBadge = document.getElementById("s1-img-count");
const errEl = document.getElementById("s1-img-error");
const form = document.getElementById("site1-form");
const submitBtn = document.getElementById("s1-submit-btn");

document.getElementById("s1-date").valueAsDate = new Date();

dropzone.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", (e) => {
  selectedFiles = Array.from(e.target.files);
  renderPreviews();
});

function renderPreviews() {
  countBadge.textContent = `${selectedFiles.length} / 5 ภาพ`;
  const valid = selectedFiles.length >= 3 && selectedFiles.length <= 5;
  countBadge.className = valid
    ? "text-xs px-2 py-0.5 rounded-full bg-emerald-100 font-semibold text-emerald-700"
    : "text-xs px-2 py-0.5 rounded-full bg-rose-100 font-semibold text-rose-700";
  errEl.classList.toggle("hidden", valid || selectedFiles.length === 0);

  previewGrid.innerHTML = "";
  previewGrid.classList.toggle("hidden", selectedFiles.length === 0);

  selectedFiles.forEach((file, i) => {
    const url = URL.createObjectURL(file);
    const cell = document.createElement("div");
    cell.className = "relative aspect-square rounded-lg overflow-hidden border border-slate-300 bg-slate-200";
    cell.innerHTML = `<img src="${url}" class="w-full h-full object-cover">
      <button type="button" data-i="${i}" class="remove-img absolute top-1 right-1 w-5 h-5 rounded-full bg-rose-500 text-white text-xs flex items-center justify-center">&times;</button>`;
    previewGrid.appendChild(cell);
  });

  previewGrid.querySelectorAll(".remove-img").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedFiles.splice(Number(btn.dataset.i), 1);
      renderPreviews();
    });
  });
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (selectedFiles.length < 3 || selectedFiles.length > 5) {
    errEl.classList.remove("hidden");
    showToast("กรุณาเลือกรูปภาพ 3 ถึง 5 รูปภาพเท่านั้น", "error");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> กำลังบีบอัดรูปภาพ...`;

  try {
    const imageUrls = await Promise.all(selectedFiles.map((f) => compressImage(f)));

    submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> กำลังส่งข้อมูล...`;

    await addDoc(collection(db, "submissions"), {
      fullName: document.getElementById("s1-name").value.trim(),
      activityTitle: document.getElementById("s1-title").value.trim(),
      activityDate: document.getElementById("s1-date").value,
      description: document.getElementById("s1-desc").value.trim(),
      imageUrls,
      status: "pending",
      createdAt: serverTimestamp()
    });

    form.reset();
    document.getElementById("s1-date").valueAsDate = new Date();
    selectedFiles = [];
    renderPreviews();
    showToast("ส่งข้อมูลสำเร็จ! รอการตรวจสอบจากผู้ดูแล", "success");
  } catch (err) {
    console.error(err);
    showToast("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> ส่งบันทึกความดี`;
  }
});

function showToast(msg, type = "success") {
  const toast = document.getElementById("toast");
  const text = document.getElementById("toast-text");
  const icon = document.getElementById("toast-icon");
  text.textContent = msg;
  icon.className = type === "error"
    ? "fa-solid fa-circle-xmark text-rose-400 text-sm"
    : "fa-solid fa-circle-check text-emerald-400 text-sm";
  toast.classList.remove("translate-y-20", "opacity-0");
  setTimeout(() => toast.classList.add("translate-y-20", "opacity-0"), 3500);
}
