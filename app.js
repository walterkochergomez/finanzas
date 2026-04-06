// Importaciones de Firebase (Asegúrate de poner tu configuración real)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    // Pega aquí la configuración que te da Firebase
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

// --- ELEMENTOS DEL DOM ---
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const mesSelector = document.getElementById('mes-actual');

// --- INICIALIZAR MES ACTUAL ---
const hoy = new Date();
const mesActualString = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
mesSelector.value = mesActualString;

// Al cambiar el mes, recargamos los datos
mesSelector.addEventListener('change', () => {
    cargarDatosDelMes(mesSelector.value);
});

// --- AUTENTICACIÓN ---
document.getElementById('btn-login').addEventListener('click', async () => {
    const provider = new GoogleAuthProvider();
    try { await signInWithPopup(auth, provider); } catch (error) { console.error("Error login:", error); }
});

document.getElementById('btn-logout').addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        loginScreen.style.display = 'none';
        appScreen.style.display = 'flex';
        document.getElementById('user-name').innerText = user.displayName.split(' ')[0];
        document.getElementById('user-avatar').src = user.photoURL;
        cargarDatosDelMes(mesSelector.value); // Cargar los datos de este usuario y este mes
    } else {
        currentUser = null;
        loginScreen.style.display = 'flex';
        appScreen.style.display = 'none';
    }
});

// --- LÓGICA DE DEUDAS Y ARRASTRE ---
document.getElementById('form-deuda').addEventListener('submit', async (e) => {
    e.preventDefault();
    const desc = document.getElementById('desc-deuda').value;
    const total = parseFloat(document.getElementById('monto-deuda').value);
    const pagado = parseFloat(document.getElementById('pagado-deuda').value);
    const periodo = mesSelector.value; // Guardamos en el mes que esté seleccionado

    try {
        await addDoc(collection(db, "deudas"), {
            userId: currentUser.uid,
            descripcion: desc,
            montoTotal: total,
            montoPagado: pagado,
            periodo: periodo,
            fechaRegistro: Date.now()
        });
        e.target.reset();
        cargarDatosDelMes(periodo); // Recargar
    } catch (e) {
        console.error("Error al añadir deuda: ", e);
    }
});

async function cargarDatosDelMes(periodo) {
    if (!currentUser) return;
    
    // 1. Cargar Gastos del mes (Lógica omitida, similar a deudas)
    
    // 2. Cargar Deudas
    const qDeudas = query(collection(db, "deudas"), where("userId", "==", currentUser.uid));
    const snapshot = await getDocs(qDeudas);
    
    const listaDeudasDiv = document.getElementById('lista-deudas');
    listaDeudasDiv.innerHTML = '';
    
    let totalAdeudadoMesActual = 0;

    snapshot.forEach(doc => {
        const deuda = doc.data();
        const id = doc.id;
        const pendiente = deuda.montoTotal - deuda.montoPagado;

        // Si la deuda es de ESTE mes
        if (deuda.periodo === periodo) {
            renderizarTarjetaDeuda(id, deuda.descripcion, deuda.montoTotal, deuda.montoPagado, pendiente, false);
            totalAdeudadoMesActual += pendiente;
        } 
        // LÓGICA DE ARRASTRE: Si la deuda es de un mes ANTERIOR y el pendiente es > 0
        else if (deuda.periodo < periodo && pendiente > 0) {
            renderizarTarjetaDeuda(id, `${deuda.descripcion} (Arrastre ${deuda.periodo})`, pendiente, 0, pendiente, true);
            totalAdeudadoMesActual += pendiente;
        }
    });
}

function renderizarTarjetaDeuda(id, desc, total, pagado, pendiente, esArrastre) {
    const div = document.createElement('div');
    // Si el pendiente es 0 o menor, está a favor/saldado (verde), si no, en contra (rojo)
    const estadoClase = pendiente <= 0 ? 'text-success' : 'text-danger';
    const estadoTexto = pendiente <= 0 ? 'Saldado / A favor' : `Pendiente: $${pendiente.toLocaleString()}`;

    div.className = `gasto-item ${esArrastre ? 'arrastre' : ''}`;
    div.innerHTML = `
        <div class="gasto-info">
            <h4>${desc}</h4>
            <span style="color: #94a3b8;">Total:$${total.toLocaleString()} | Pagado: $${pagado.toLocaleString()}</span>
        </div>
        <div class="gasto-monto">
            <span class="${estadoClase}" style="font-weight: bold;">${estadoTexto}</span>
        </div>
    `;
    document.getElementById('lista-deudas').appendChild(div);
}

// Navegación (Igual que antes)
// ...
