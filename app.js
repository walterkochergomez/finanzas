let gastos = JSON.parse(localStorage.getItem('gastos')) || [];
let chartInstance = null;

// Selectores
const tabs = document.querySelectorAll('.nav-item');
const sections = document.querySelectorAll('.content-section');

// Manejo de Navegación
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        sections.forEach(s => s.classList.remove('active'));
        
        tab.classList.add('active');
        const target = tab.id.replace('btn-', 'tab-');
        document.getElementById(target).classList.add('active');

        if(target === 'tab-estadisticas') actualizarEstadisticas();
    });
});

// Guardar Gasto
document.getElementById('form-gasto').addEventListener('submit', (e) => {
    e.preventDefault();
    const desc = document.getElementById('descripcion').value;
    const monto = parseFloat(document.getElementById('monto').value);
    const cat = document.getElementById('categoria').value;

    const nuevoGasto = { id: Date.now(), descripcion: desc, monto, categoria: cat };
    gastos.push(nuevoGasto);
    localStorage.setItem('gastos', JSON.stringify(gastos));
    
    e.target.reset();
    renderizarHistorial();
});

// Función para Borrar Gasto
function eliminarGasto(id) {
    gastos = gastos.filter(g => g.id !== id);
    localStorage.setItem('gastos', JSON.stringify(gastos));
    renderizarHistorial();
    // Si estamos en la pestaña de estadísticas, refrescar gráfico
    if (document.getElementById('tab-estadisticas').classList.contains('active')) {
        actualizarEstadisticas();
    }
}

// Renderizar Historial
function renderizarHistorial() {
    const contenedor = document.getElementById('lista-gastos');
    contenedor.innerHTML = '';

    // Mostramos los últimos primero
    [...gastos].reverse().forEach(g => {
        const div = document.createElement('div');
        div.className = 'gasto-item';
        div.innerHTML = `
            <div class="gasto-info">
                <h4>${g.descripcion}</h4>
                <span>${g.categoria}</span>
            </div>
            <div class="gasto-monto">
                $${g.monto.toLocaleString()}
                <button class="btn-delete" onclick="eliminarGasto(${g.id})">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;
        contenedor.appendChild(div);
    });
}

// Estadísticas
function actualizarEstadisticas() {
    const total = gastos.reduce((acc, g) => acc + g.monto, 0);
    document.getElementById('total-gastado').innerText = `$${total.toLocaleString()}`;

    const dataMap = gastos.reduce((acc, g) => {
        acc[g.categoria] = (acc[g.categoria] || 0) + g.monto;
        return acc;
    }, {});

    const ctx = document.getElementById('grafico-categorias').getContext('2d');
    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(dataMap),
            datasets: [{
                data: Object.values(dataMap),
                backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'],
                borderWidth: 0,
                hoverOffset: 20
            }]
        },
        options: {
            plugins: {
                legend: { position: 'bottom', labels: { color: '#fff', font: { size: 14 } } }
            }
        }
    });
}

// Inicializar
renderizarHistorial();
