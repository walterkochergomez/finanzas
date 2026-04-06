import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// === REEMPLAZA ESTO CON LA CONFIGURACIÓN DE TU FIREBASE ===
const firebaseConfig = {
    apiKey: "AIzaSyAjWtEeVUDQFrPYGXRpRxK9J_Gf4M77lyw",
  authDomain: "organizador-academico-35d9d.firebaseapp.com",
  projectId: "organizador-academico-35d9d",
  storageBucket: "organizador-academico-35d9d.firebasestorage.app",
  messagingSenderId: "191522787552",
  appId: "1:191522787552:web:7261ba505d1558fc628085"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let chartCategorias = null;
let chartComparativo = null;

// --- ELEMENTOS DOM ---
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const mesSelector = document.getElementById('mes-actual');
const tabs = document.querySelectorAll('.nav-item');
const sections = document.querySelectorAll('.content-section');

// --- INICIALIZAR MES ---
const hoy = new Date();
mesSelector.value = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
mesSelector.addEventListener('change', () => cargarDatosDelMes(mesSelector.value));

// --- AUTENTICACIÓN ---
document.getElementById('btn-login').addEventListener('click', async () => {
    const provider = new GoogleAuthProvider();
    try { await signInWithPopup(auth, provider); } catch (error) { console.error("Error login:", error); }
});

document.getElementById('btn-logout').addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        loginScreen.classList.remove('active');
        appScreen.style.display = 'flex';
        document.getElementById('user-name').innerText = user.displayName.split(' ')[0];
        document.getElementById('user-avatar').src = user.photoURL;
        cargarDatosDelMes(mesSelector.value);
    } else {
        currentUser = null;
        loginScreen.classList.add('active');
        appScreen.style.display = 'none';
    }
});

// --- NAVEGACIÓN DE PESTAÑAS ---
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        sections.forEach(s => s.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tab.id.replace('btn-', 'tab-')).classList.add('active');
    });
});

// --- GUARDAR GASTO ---
document.getElementById('form-gasto').addEventListener('submit', async (e) => {
    e.preventDefault();
    const gasto = {
        userId: currentUser.uid,
        descripcion: document.getElementById('descripcion').value,
        monto: parseFloat(document.getElementById('monto').value),
        categoria: document.getElementById('categoria').value,
        periodo: mesSelector.value,
        fechaRegistro: Date.now()
    };
    try {
        await addDoc(collection(db, "gastos"), gasto);
        e.target.reset();
        cargarDatosDelMes(mesSelector.value);
    } catch (err) { console.error("Error guardando gasto", err); }
});

// --- GUARDAR DEUDA ---
document.getElementById('form-deuda').addEventListener('submit', async (e) => {
    e.preventDefault();
    const deuda = {
        userId: currentUser.uid,
        descripcion: document.getElementById('desc-deuda').value,
        montoTotal: parseFloat(document.getElementById('monto-deuda').value),
        montoPagado: parseFloat(document.getElementById('pagado-deuda').value),
        periodo: mesSelector.value,
        fechaRegistro: Date.now()
    };
    try {
        await addDoc(collection(db, "deudas"), deuda);
        e.target.reset();
        cargarDatosDelMes(mesSelector.value);
    } catch (err) { console.error("Error guardando deuda", err); }
});

// --- CARGAR DATOS Y PROCESAR ARRASTRE ---
async function cargarDatosDelMes(periodo) {
    if (!currentUser) return;
    
    // 1. Obtener Gastos
    const qGastos = query(collection(db, "gastos"), where("userId", "==", currentUser.uid), where("periodo", "==", periodo));
    const snapGastos = await getDocs(qGastos);
    const listaGastos = document.getElementById('lista-gastos');
    listaGastos.innerHTML = '';
    
    let totalGastos = 0;
    const gastosPorCat = {};

    snapGastos.forEach(doc => {
        const g = doc.data();
        totalGastos += g.monto;
        gastosPorCat[g.categoria] = (gastosPorCat[g.categoria] || 0) + g.monto;
        
        listaGastos.innerHTML += `
            <div class="gasto-item">
                <div class="gasto-info"><h4>${g.descripcion}</h4><span style="color:#94a3b8">${g.categoria}</span></div>
                <div class="gasto-monto">$${g.monto.toLocaleString()}
                    <button class="btn-delete" onclick="eliminarRegistro('gastos', '${doc.id}')"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>`;
    });

    // 2. Obtener Deudas
    const qDeudas = query(collection(db, "deudas"), where("userId", "==", currentUser.uid));
    const snapDeudas = await getDocs(qDeudas);
    const listaDeudas = document.getElementById('lista-deudas');
    listaDeudas.innerHTML = '';
    
    let totalDeudaPendiente = 0;

    snapDeudas.forEach(doc => {
        const d = doc.data();
        const pendiente = d.montoTotal - d.montoPagado;

        if (d.periodo === periodo) {
            renderizarDeuda(listaDeudas, doc.id, d.descripcion, d.montoTotal, d.montoPagado, pendiente, false);
            totalDeudaPendiente += pendiente;
        } else if (d.periodo < periodo && pendiente > 0) {
            renderizarDeuda(listaDeudas, doc.id, `${d.descripcion} (Arrastre ${d.periodo})`, pendiente, 0, pendiente, true);
            totalDeudaPendiente += pendiente;
        }
    });

    // 3. Actualizar Estadísticas
    actualizarEstadisticas(totalGastos, totalDeudaPendiente, gastosPorCat);
}

function renderizarDeuda(contenedor, id, desc, total, pagado, pendiente, esArrastre) {
    const estado = pendiente <= 0 ? `<span class="text-success">Saldado</span>` : `<span class="text-danger">Pendiente: $${pendiente.toLocaleString()}</span>`;
    contenedor.innerHTML += `
        <div class="gasto-item ${esArrastre ? 'arrastre' : ''}">
            <div class="gasto-info"><h4>${desc}</h4><span style="color:#94a3b8">Total:$${total.toLocaleString()} | Pag. $${pagado.toLocaleString()}</span></div>
            <div class="gasto-monto">${estado}
                <button class="btn-delete" onclick="eliminarRegistro('deudas', '${id}')"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>`;
}

// --- BORRAR REGISTRO (Exponemos la función al entorno global para que funcione en el onclick) ---
window.eliminarRegistro = async (coleccion, id) => {
    if(confirm('¿Estás seguro de eliminar este registro?')) {
        try {
            await deleteDoc(doc(db, coleccion, id));
            cargarDatosDelMes(mesSelector.value); // Recargar
        } catch (error) { console.error("Error borrando", error); }
    }
};

// --- ESTADÍSTICAS (Gráficos) ---
function actualizarEstadisticas(totalGastos, totalDeuda, gastosPorCat) {
    document.getElementById('total-gastos-stat').innerText = `$${totalGastos.toLocaleString()}`;
    document.getElementById('total-deudas-stat').innerText = `$${totalDeuda.toLocaleString()}`;

    // Gráfico Dona (Categorías)
    const ctxCat = document.getElementById('grafico-categorias').getContext('2d');
    if (chartCategorias) chartCategorias.destroy();
    chartCategorias = new Chart(ctxCat, {
        type: 'doughnut',
        data: {
            labels: Object.keys(gastosPorCat),
            datasets: [{
                data: Object.values(gastosPorCat),
                backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'],
                borderWidth: 0
            }]
        },
        options: { plugins: { legend: { position: 'right', labels: { color: '#fff' } } } }
    });

    // Gráfico Barras (Gastos vs Deudas)
    const ctxComp = document.getElementById('grafico-comparativo').getContext('2d');
    if (chartComparativo) chartComparativo.destroy();
    chartComparativo = new Chart(ctxComp, {
        type: 'bar',
        data: {
            labels: ['Flujo de Caja', 'Compromisos'],
            datasets: [{
                data: [totalGastos, totalDeuda],
                backgroundColor: ['#3b82f6', '#ef4444'],
                borderRadius: 8
            }]
        },
        options: {
            plugins: { legend: { display: false } },
            scales: { y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.1)' } }, x: { ticks: { color: '#fff' } } }
        }
    });
}
