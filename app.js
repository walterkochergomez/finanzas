import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, getDocs, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// === CONFIGURACIÓN FIREBASE ===
const firebaseConfig = {
  apiKey: "AIzaSyCO5b4r8U01bSum87YPhnj-CS80-qaGmNE",
  authDomain: "finanzas-67c25.firebaseapp.com",
  projectId: "finanzas-67c25",
  storageBucket: "finanzas-67c25.firebasestorage.app",
  messagingSenderId: "387271798124",
  appId: "1:387271798124:web:53293a15ef659987ed1749",
  measurementId: "G-R90VV07EH7"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let chart1 = null;
let chart2 = null;

// --- INICIALIZACIÓN E INTERFAZ ---
const mesSelector = document.getElementById('mes-actual');
const hoy = new Date();
mesSelector.value = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;

// Función para cambiar mes con flechas
function cambiarMesOffset(offset) {
    let [year, month] = mesSelector.value.split('-').map(Number);
    let fecha = new Date(year, month - 1 + offset, 15);
    mesSelector.value = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
    cargarDatos(mesSelector.value);
}

document.getElementById('prev-month').onclick = () => cambiarMesOffset(-1);
document.getElementById('next-month').onclick = () => cambiarMesOffset(1);
mesSelector.onchange = () => cargarDatos(mesSelector.value);

document.getElementById('es-cuotas').addEventListener('change', (e) => {
    document.getElementById('div-cuotas').style.display = e.target.checked ? 'flex' : 'none';
});

function sumarMeses(periodo, mesesASumar) {
    let [year, month] = periodo.split('-').map(Number);
    month += mesesASumar;
    while (month > 12) { month -= 12; year += 1; }
    return `${year}-${String(month).padStart(2, '0')}`;
}

// --- AUTENTICACIÓN ---
const loginBtn = document.getElementById('btn-login');
if(loginBtn) {
    loginBtn.onclick = async () => {
        const provider = new GoogleAuthProvider();
        try { await signInWithPopup(auth, provider); } 
        catch (e) { console.error("Error en Login:", e); }
    };
}

document.getElementById('btn-logout').onclick = () => signOut(auth);

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('login-screen').classList.remove('active');
        document.getElementById('app-screen').style.display = 'flex';
        document.getElementById('user-name').innerText = user.displayName;
        document.getElementById('user-avatar').src = user.photoURL;
        cargarDatos(mesSelector.value);
    } else {
        currentUser = null;
        document.getElementById('login-screen').classList.add('active');
        document.getElementById('app-screen').style.display = 'none';
    }
});

// --- NAVEGACIÓN ---
document.querySelectorAll('.nav-item').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
        btn.classList.add('active');
        const target = btn.id.replace('btn-', 'tab-');
        document.getElementById(target).classList.add('active');
        if(target === 'tab-estadisticas') cargarDatos(mesSelector.value);
    };
});

// --- GUARDAR INGRESO ---
document.getElementById('form-ingreso').onsubmit = async (e) => {
    e.preventDefault();
    if(!currentUser) return;
    
    const nuevoIngreso = {
        userId: currentUser.uid,
        descripcion: document.getElementById('desc-ingreso').value,
        monto: parseFloat(document.getElementById('monto-ingreso').value),
        categoria: document.getElementById('cat-ingreso').value,
        periodo: mesSelector.value,
        fecha: Date.now()
    };

    try {
        await addDoc(collection(db, "ingresos"), nuevoIngreso);
        e.target.reset();
        cargarDatos(mesSelector.value);
    } catch (err) { console.error("Error guardando ingreso:", err); }
};

// --- GUARDAR GASTO ---
document.getElementById('form-gasto').onsubmit = async (e) => {
    e.preventDefault();
    if(!currentUser) return;
    
    const nuevoGasto = {
        userId: currentUser.uid,
        descripcion: document.getElementById('descripcion').value,
        monto: parseFloat(document.getElementById('monto').value),
        categoria: document.getElementById('categoria').value,
        periodo: mesSelector.value,
        fecha: Date.now()
    };

    try {
        await addDoc(collection(db, "gastos"), nuevoGasto);
        e.target.reset();
        cargarDatos(mesSelector.value);
    } catch (err) { console.error("Error guardando gasto:", err); }
};

// --- GUARDAR DEUDA ---
document.getElementById('form-deuda').onsubmit = async (e) => {
    e.preventDefault();
    if(!currentUser) return;

    const descripcionBase = document.getElementById('desc-deuda').value;
    const montoTotal = parseFloat(document.getElementById('monto-deuda').value);
    const abonoInput = document.getElementById('pagado-deuda').value;
    const montoPagado = abonoInput === "" ? 0 : parseFloat(abonoInput);
    const periodoInicio = mesSelector.value;
    const esCuotas = document.getElementById('es-cuotas').checked;

    try {
        if (esCuotas) {
            const numCuotas = parseInt(document.getElementById('num-cuotas').value);
            if (isNaN(numCuotas) || numCuotas < 2) return alert("Cantidad de cuotas inválida");
            
            const valorCuota = Math.round(montoTotal / numCuotas);
            const promesas = [];
            
            for (let i = 0; i < numCuotas; i++) {
                const cuotaData = {
                    userId: currentUser.uid,
                    descripcion: `${descripcionBase} (Cuota ${i + 1}/${numCuotas})`,
                    montoTotal: valorCuota,
                    montoPagado: i === 0 ? montoPagado : 0, 
                    periodo: sumarMeses(periodoInicio, i),
                    fecha: Date.now() + i
                };
                promesas.push(addDoc(collection(db, "deudas"), cuotaData));
            }
            await Promise.all(promesas); 
        } else {
            await addDoc(collection(db, "deudas"), {
                userId: currentUser.uid,
                descripcion: descripcionBase,
                montoTotal: montoTotal,
                montoPagado: montoPagado,
                periodo: periodoInicio,
                fecha: Date.now()
            });
        }
        e.target.reset();
        document.getElementById('pagado-deuda').value = 0;
        document.getElementById('es-cuotas').checked = false;
        document.getElementById('div-cuotas').style.display = 'none';
        cargarDatos(mesSelector.value);
    } catch (err) { console.error("Error guardando deuda:", err); }
};

// --- CARGAR DATOS ---
async function cargarDatos(periodo) {
    if(!currentUser) return;

    // 1. Obtener Ingresos
    const qI = query(collection(db, "ingresos"), where("userId", "==", currentUser.uid), where("periodo", "==", periodo));
    const snapI = await getDocs(qI);
    const listaI = document.getElementById('lista-ingresos');
    listaI.innerHTML = '';
    let totalI = 0;
    snapI.forEach(docSnap => {
        const d = docSnap.data();
        totalI += d.monto;
        listaI.innerHTML += renderItem(docSnap.id, 'ingresos', d.descripcion, d.monto, d.categoria);
    });

    // 2. Obtener Gastos
    const qG = query(collection(db, "gastos"), where("userId", "==", currentUser.uid), where("periodo", "==", periodo));
    const snapG = await getDocs(qG);
    const listaG = document.getElementById('lista-gastos');
    listaG.innerHTML = '';
    let totalG = 0;
    const catsG = {};
    snapG.forEach(docSnap => {
        const d = docSnap.data();
        totalG += d.monto;
        catsG[d.categoria] = (catsG[d.categoria] || 0) + d.monto;
        listaG.innerHTML += renderItem(docSnap.id, 'gastos', d.descripcion, d.monto, d.categoria);
    });

    // 3. Obtener Deudas
    const qD = query(collection(db, "deudas"), where("userId", "==", currentUser.uid));
    const snapD = await getDocs(qD);
    const listaD = document.getElementById('lista-deudas');
    listaD.innerHTML = '';
    let totalDPendiente = 0;

    snapD.forEach(docSnap => {
        const d = docSnap.data();
        const pendiente = d.montoTotal - d.montoPagado;
        if(d.periodo === periodo || (d.periodo < periodo && pendiente > 0)) {
            const esArrastre = d.periodo < periodo;
            totalDPendiente += pendiente;
            listaD.innerHTML += renderDeudaItem(docSnap.id, d.descripcion, d.montoTotal, d.montoPagado, pendiente, esArrastre);
        }
    });

    renderCharts(totalI, totalG, totalDPendiente, catsG);
}

function renderItem(id, col, desc, monto, cat) {
    return `<div class="gasto-item">
        <div class="gasto-info"><h4>${desc}</h4><span>${cat}</span></div>
        <div class="gasto-monto">$${monto.toLocaleString()} 
        <button class="btn-delete" onclick="borrarDoc('${col}','${id}')"><i class="fa-solid fa-trash"></i></button></div>
    </div>`;
}

function renderDeudaItem(id, desc, total, pagado, pendiente, arrastre) {
    const btnAbonar = pendiente > 0 ? `<button class="btn-abono" onclick="abonarDeuda('${id}', ${pagado}, ${total})"><i class="fa-solid fa-plus"></i></button>` : '';
    const estadoTexto = pendiente <= 0 ? `<span class="text-success">Saldado</span>` : `<span class="text-danger">$${pendiente.toLocaleString()}</span>`;

    return `<div class="gasto-item ${arrastre ? 'arrastre' : ''}">
        <div class="gasto-info"><h4>${desc}</h4><span>Total: $${total.toLocaleString()} | Pagado:$${pagado.toLocaleString()}</span></div>
        <div class="gasto-monto">${estadoTexto}
            <div class="action-buttons">${btnAbonar}<button class="btn-delete" onclick="borrarDoc('deudas','${id}')"><i class="fa-solid fa-trash"></i></button></div>
        </div>
    </div>`;
}

window.borrarDoc = async (col, id) => {
    if(confirm("¿Eliminar este registro?")) {
        await deleteDoc(doc(db, col, id));
        cargarDatos(mesSelector.value);
    }
};

window.abonarDeuda = async (id, pagadoActual, total) => {
    const pendiente = total - pagadoActual;
    const ingreso = prompt(`Pendiente: $${pendiente.toLocaleString()}\n¿Cuánto deseas abonar?`);
    if (ingreso && !isNaN(parseFloat(ingreso)) && parseFloat(ingreso) > 0) {
        if (parseFloat(ingreso) > pendiente) return alert("No puedes abonar más de la deuda pendiente.");
        await updateDoc(doc(db, "deudas", id), { montoPagado: pagadoActual + parseFloat(ingreso) });
        cargarDatos(mesSelector.value);
    }
};

// --- GRÁFICOS ---
function renderCharts(i, g, d, cats) {
    document.getElementById('total-ingresos-stat').innerText = `$${i.toLocaleString()}`;
    document.getElementById('total-gastos-stat').innerText = `$${g.toLocaleString()}`;
    document.getElementById('total-deudas-stat').innerText = `$${d.toLocaleString()}`;

    const c1 = document.getElementById('grafico-categorias').getContext('2d');
    if(chart1) chart1.destroy();
    chart1 = new Chart(c1, {
        type: 'doughnut',
        data: { labels: Object.keys(cats), datasets: [{ data: Object.values(cats), backgroundColor: ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899'], borderWidth: 0 }] },
        options: { plugins: { legend: { position: 'bottom', labels: { color: '#fff' } } } }
    });

    const c2 = document.getElementById('grafico-comparativo').getContext('2d');
    if(chart2) chart2.destroy();
    chart2 = new Chart(c2, {
        type: 'bar',
        data: { 
            labels: ['Ingresos', 'Gastos', 'Deudas'], 
            datasets: [{ data: [i, g, d], backgroundColor: ['#10b981', '#3b82f6', '#ef4444'], borderRadius: 6 }] 
        },
        options: { scales: { y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.1)' } }, x: { ticks: { color: '#fff' } } }, plugins: { legend: { display: false } } }
    });
}
