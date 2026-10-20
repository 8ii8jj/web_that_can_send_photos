import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, doc, updateDoc, onSnapshot, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let submissions = [];
let activeFilter = "pending";
let unsubscribe = null;

const loginScreen = document.getElementById("login-screen");
const dashboard = document.getElementById("dashboard");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.classList.add("hidden");
  const email = document.getElementById("admin-email").value.trim();
  const password = document.getElementById("admin-password").value;
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    loginError.textContent = "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
    loginError.classList.remove("hidden");
  }
});

document.getElementById("logout-btn").addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, (user) => {
  if (user) {
    loginScreen.classList.add("hidden");
    dashboard.classList.remove("hidden");
    dashboard.classList.add("flex");
    document.getElementById("admin-email-label").textContent = user.email;
    subscribeToSubmissions();
  } else {
    dashboard.classList.add("hidden");
    dashboard.classList.remove("flex");
    loginScreen.classList.remove("hidden");
    if (unsubscribe) unsubscribe();
  }
});

function subscribeToSubmissions() {
  const q = query(collection(db, "submissions"), orderBy("createdAt", "desc"));
  unsubscribe = onSnapshot(q, (snap) => {
    submissions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    render();
  }, (err) => console.error(err));
}

window.setFilter = function (filter) {
  activeFilter = filter;
  document.querySelectorAll(".filter-btn").forEach((b) => {
    const active = b.dataset.filter === filter;
    b.className = active
      ? "filter-btn px-3 py-1.5 rounded-lg font-semibold bg-scout-600 text-white"
      : "filter-btn px-3 py-1.5 rounded-lg font-medium text-slate-600 hover:bg-slate-100";
  });
  render();
};

window.updateStatus = async function (id, status) {
  await updateDoc(doc(db, "submissions", id), { status });
};

window.openImgModal = function (src) {
  document.getElementById("modal-img").src = src;
  const modal = document.getElementById("img-modal");
  modal.classList.remove("hidden");
  modal.classList.add("flex");
};

window.closeImgModal = function () {
  const modal = document.getElementById("img-modal");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
};

function render() {
  document.getElementById("cnt-pending").textContent = submissions.filter((s) => s.status === "pending").length;
  document.getElementById("cnt-approved").textContent = submissions.filter((s) => s.status === "approved").length;
  document.getElementById("cnt-rejected").textContent = submissions.filter((s) => s.status === "rejected").length;
  document.getElementById("cnt-all").textContent = submissions.length;

  const list = activeFilter === "all" ? submissions : submissions.filter((s) => s.status === activeFilter);
  const container = document.getElementById("items-container");
  const empty = document.getElementById("empty-state");

  if (list.length === 0) {
    container.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  const tags = {
    pending: `<span class="px-2 py-0.5 text-xs font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-300">รอตรวจสอบ</span>`,
    approved: `<span class="px-2 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">อนุมัติแล้ว</span>`,
    rejected: `<span class="px-2 py-0.5 text-xs font-bold rounded-full bg-rose-100 text-rose-800 border border-rose-300">ไม่อนุมัติ</span>`
  };

  container.innerHTML = list.map((item) => `
    <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden text-sm">
      <div class="p-3 bg-slate-50 border-b border-slate-100 flex items-start justify-between gap-2">
        <div>
          <h4 class="font-bold text-slate-800">${escapeHtml(item.activityTitle || "")}</h4>
          <p class="text-xs text-slate-500 mt-0.5">${escapeHtml(item.fullName || "")} &bull; ${item.activityDate || ""}</p>
        </div>
        <div>${tags[item.status] || ""}</div>
      </div>
      <div class="p-3 space-y-2">
        <p class="text-slate-600 text-sm leading-relaxed">${escapeHtml(item.description || "")}</p>
        <div>
          <p class="text-[10px] font-semibold text-slate-400 mb-1">รูปภาพประกอบ (${(item.imageUrls || []).length} ภาพ):</p>
          <div class="grid grid-cols-5 gap-1.5">
            ${(item.imageUrls || []).map((url) => `
              <div onclick="openImgModal('${url}')" class="aspect-square rounded border border-slate-200 overflow-hidden bg-slate-100 cursor-pointer hover:opacity-80">
                <img src="${url}" class="w-full h-full object-cover">
              </div>`).join("")}
          </div>
        </div>
      </div>
      <div class="px-3 py-2 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
        ${item.status !== "approved" ? `<button onclick="updateStatus('${item.id}','approved')" class="px-3 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"><i class="fa-solid fa-check mr-1"></i>อนุมัติ</button>` : ""}
        ${item.status !== "rejected" ? `<button onclick="updateStatus('${item.id}','rejected')" class="px-3 py-1 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold"><i class="fa-solid fa-xmark mr-1"></i>ไม่อนุมัติ</button>` : ""}
      </div>
    </div>
  `).join("");
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
