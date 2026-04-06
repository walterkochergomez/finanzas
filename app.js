import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, getDocs, deleteDoc, doc, updateDoc,orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// === CONFIGURACIÓN FIREBASE (RELLENA ESTO) ===
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

// Selectores
const mesSelector = document.getElementById('mes-actual');
const hoy = new Date();
mesSelector.value = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;

// --- AUTENTICACIÓN ---
const loginBtn = document.getElementById('btn-login');
if(loginBtn) {
    loginBtn.onclick = async () => {
        const provider = new GoogleAuthProvider();
        try { await signInWithPopup(auth, provider); } 
        catch (e) { console.error("Error en Login:", e); alert("Error al iniciar sesión."); }
    };
}

document.getElementById('btn-logout').onclick = () => signOut(auth);

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app-screen').style.display = 'flex';
        document.getElementById('user-name').innerText = user.displayName;
        document.getElementById('user-avatar').src = user.photoURL;
        cargarDatos(mesSelector.value);
    } else {
        currentUser = null;
        document.getElementById('login-screen').style.display = 'flex';
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

mesSelector.onchange = () => cargarDatos(mesSelector.value);

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

// --- GUARDAR DEUDA (CORREGIDO PARA ABONOS $0) ---
document.getElementById('form-deuda').onsubmit = async (e) => {
    e.preventDefault();
    if(!currentUser) return;

    const montoTotal = parseFloat(document.getElementById('monto-deuda').value);
    const abonoInput = document.getElementById('pagado-deuda').value;
    // Si el campo está vacío, el abono es 0
    const montoPagado = abonoInput === "" ? 0 : parseFloat(abonoInput);

    const nuevaDeuda = {
        userId: currentUser.uid,
        descripcion: document.getElementById('desc-deuda').value,
        montoTotal: montoTotal,
        montoPagado: montoPagado,
        periodo: mesSelector.value,
        fecha: Date.now()
    };

    try {
        await addDoc(collection(db, "deudas"), nuevaDeuda);
        e.target.reset();
        document.getElementById('pagado-deuda').value = 0;
        cargarDatos(mesSelector.value);
    } catch (err) { console.error("Error guardando deuda:", err); }
};

// --- CARGA DE DATOS ---
async function cargarDatos(periodo) {
    if(!currentUser) return;

    // Obtener Gastos
    const qG = query(collection(db, "gastos"), where("userId", "==", currentUser.uid), where("periodo", "==", periodo), orderBy("fecha", "desc"));
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

    // Obtener Deudas
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

    renderCharts(totalG, totalDPendiente, catsG);
}

// Auxiliares de renderizado
function renderItem(id, col, desc, monto, cat) {
    return `<div class="gasto-item">
        <div class="gasto-info"><h4>${desc}</h4><span>${cat}</span></div>
        <div class="gasto-monto">$${monto.toLocaleString()} 
        <button class="btn-delete" onclick="borrarDoc('${col}','${id}')"><i class="fa-solid fa-trash"></i></button></div>
    </div>`;
}

// --- RENDERIZAR ITEM DE DEUDA CON BOTÓN DE ABONO ---
function renderDeudaItem(id, desc, total, pagado, pendiente, arrastre) {
    // Solo mostramos el botón de abonar si hay deuda pendiente
    const btnAbonar = pendiente > 0 
        ? `<button class="btn-abono" onclick="abonarDeuda('${id}', ${pagado}, ${total})" title="Realizar Abono"><i class="fa-solid fa-plus"></i></button>` 
        : '';

    const estadoTexto = pendiente <= 0 ? `<span style="color:#10b981">Saldado</span>` : `<span class="text-danger">$${pendiente}</span>`;

    return `<div class="gasto-item ${arrastre ? 'arrastre' : ''}">
        <div class="gasto-info">
            <h4>${desc} ${arrastre ? '(Arrastre)' : ''}</h4>
            <span>Total: $${total.toLocaleString()} | Pagado:$${pagado.toLocaleString()}</span>
        </div>
        <div class="gasto-monto">
            ${estadoTexto}
            <div class="action-buttons">
                ${btnAbonar}
                <button class="btn-delete" onclick="borrarDoc('deudas','${id}')"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>
    </div>`;
}

// --- LÓGICA PARA REALIZAR EL ABONO ---
window.abonarDeuda = async (id, pagadoActual, total) => {
    const pendiente = total - pagadoActual;
    const ingreso = prompt(`Deuda pendiente: $${pendiente.toLocaleString()}\n¿Cuánto dinero deseas abonar ahora?`);
    
    if (ingreso !== null && ingreso !== "") {
        const montoAbono = parseFloat(ingreso);
        
        if (!isNaN(montoAbono) && montoAbono > 0) {
            if (montoAbono > pendiente) {
                alert("No puedes abonar más del total que debes.");
                return;
            }
            
            const nuevoPagado = pagadoActual + montoAbono;
            
            try {
                // Actualizamos el documento en Firebase
                await updateDoc(doc(db, "deudas", id), {
                    montoPagado: nuevoPagado
                });
                // Recargamos los datos para ver los cambios
                cargarDatos(document.getElementById('mes-actual').value);
            } catch (error) {
                console.error("Error al actualizar la deuda:", error);
                alert("Hubo un error al guardar el abono.");
            }
        } else {
            alert("Por favor, ingresa un monto válido mayor a 0.");
        }
    }
};

// Global para borrar
window.borrarDoc = async (col, id) => {
    if(confirm("¿Eliminar este registro?")) {
        await deleteDoc(doc(db, col, id));
        cargarDatos(mesSelector.value);
    }
};

function renderCharts(g, d, cats) {
    document.getElementById('total-gastos-stat').innerText = `$${g.toLocaleString()}`;
    document.getElementById('total-deudas-stat').innerText = `$${d.toLocaleString()}`;

    const c1 = document.getElementById('grafico-categorias').getContext('2d');
    if(chart1) chart1.destroy();
    chart1 = new Chart(c1, {
        type: 'doughnut',
        data: { labels: Object.keys(cats), datasets: [{ data: Object.values(cats), backgroundColor: ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6'] }] },
        options: { plugins: { legend: { position: 'bottom', labels: { color: '#fff' } } } }
    });

    const c2 = document.getElementById('grafico-comparativo').getContext('2d');
    if(chart2) chart2.destroy();
    chart2 = new Chart(c2, {
        type: 'bar',
        data: { labels: ['Gastos', 'Deudas'], datasets: [{ data: [g, d], backgroundColor: ['#3b82f6', '#ef4444'] }] },
        options: { scales: { y: { ticks: { color: '#fff' } }, x: { ticks: { color: '#fff' } } }, plugins: { legend: { display: false } } }
    });
}
