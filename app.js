// Elementos del DOM
const btnRegistro = document.getElementById('btn-registro');
const btnEstadisticas = document.getElementById('btn-estadisticas');
const tabRegistro = document.getElementById('tab-registro');
const tabEstadisticas = document.getElementById('tab-estadisticas');
const formGasto = document.getElementById('form-gasto');
const listaGastos = document.getElementById('lista-gastos');
const totalGastadoEl = document.getElementById('total-gastado');

// Variables globales
let gastos = JSON.parse(localStorage.getItem('gastos')) || [];
let chartInstance = null;

// --- NAVEGACIÓN DE PESTAÑAS ---
btnRegistro.addEventListener('click', () => {
    btnRegistro.classList.add('active');
    btnEstadisticas.classList.remove('active');
    tabRegistro.classList.add('active');
    tabEstadisticas.classList.remove('active');
});

btnEstadisticas.addEventListener('click', () => {
    btnEstadisticas.classList.add('active');
    btnRegistro.classList.remove('active');
    tabEstadisticas.classList.add('active');
    tabRegistro.classList.remove('active');
    actualizarEstadisticas();
});

// --- LÓGICA DE GASTOS ---
formGasto.addEventListener('submit', function(e) {
    e.preventDefault();

    const descripcion = document.getElementById('descripcion').value;
    const monto = parseFloat(document.getElementById('monto').value);
    const categoria = document.getElementById('categoria').value;

    const nuevoGasto = {
        id: Date.now(),
        descripcion,
        monto,
        categoria
    };

    gastos.push(nuevoGasto);
    localStorage.setItem('gastos', JSON.stringify(gastos));
    
    formGasto.reset();
    renderizarHistorial();
});

function renderizarHistorial() {
    listaGastos.innerHTML = '';
    gastos.forEach(gasto => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span><strong>${gasto.descripcion}</strong> <br> <small>${gasto.categoria}</small></span>
            <span>$${gasto.monto.toLocaleString('es-CL')}</span>
        `;
        listaGastos.appendChild(li);
    });
}

// --- ESTADÍSTICAS Y GRÁFICOS ---
function actualizarEstadisticas() {
    // Calcular el total
    const total = gastos.reduce((acc, gasto) => acc + gasto.monto, 0);
    totalGastadoEl.innerText = total.toLocaleString('es-CL');

    // Agrupar datos por categoría para el gráfico
    const gastosPorCategoria = gastos.reduce((acc, gasto) => {
        acc[gasto.categoria] = (acc[gasto.categoria] || 0) + gasto.monto;
        return acc;
    }, {});

    const labels = Object.keys(gastosPorCategoria);
    const data = Object.values(gastosPorCategoria);

    // Dibujar o actualizar el gráfico de Chart.js
    const ctx = document.getElementById('grafico-categorias').getContext('2d');
    
    if (chartInstance) {
        chartInstance.destroy(); // Destruimos el gráfico anterior si existe para evitar superposiciones
    }

    chartInstance = new Chart(ctx, {
        type: 'doughnut', // Gráfico de dona
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: [
                    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'
                ]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}

// Carga inicial
renderizarHistorial();
