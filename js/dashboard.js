/**
 * DashboardManager Component
 * 
 * Manages the visualization of invoice data using Chart.js v4.
 * Handles data aggregation and chart rendering in the dashboard modal.
 */
class DashboardManager {
    constructor() {
        this.modal = document.getElementById('dashboardModal');
        this.btnOpen = document.getElementById('btnShowDashboard');
        this.btnClose = document.getElementById('btnCloseDashboard');
        
        this.charts = {
            monthly: null,
            providers: null,
            types: null
        };

        this.colors = ['#185FA5', '#0F6E56', '#854F0B', '#888780', '#D4537E'];
    }

    initialize() {
        if (!this.modal || !this.btnOpen || !this.btnClose) {
            console.error('DashboardManager: Required DOM elements not found');
            return;
        }

        this.setupEventListeners();
        console.log('DashboardManager initialized');
    }

    setupEventListeners() {
        this.btnOpen.addEventListener('click', () => this.openDashboard());
        this.btnClose.addEventListener('click', () => this.closeDashboard());
        
        document.getElementById('btnExportCSV').addEventListener('click', () => {
            const data = typeof window.getInvoiceData === 'function' ? window.getInvoiceData() : [];
            this.exportToCSV(data);
        });

        // Close on outside click
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.closeDashboard();
        });
    }

    openDashboard() {
        const data = typeof window.getInvoiceData === 'function' ? window.getInvoiceData() : [];
        
        if (!data || data.length === 0) {
            alert('No hay datos disponibles. Asegúrese de haber seleccionado una sociedad y que se vean facturas en la tabla.');
            return;
        }

        this.modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        
        // Small delay to ensure the DOM elements are visible and have dimensions
        setTimeout(() => {
            this.renderDashboard(data);
        }, 100);
    }

    closeDashboard() {
        this.modal.style.display = 'none';
        document.body.style.overflow = 'auto';
        
        // Destroy charts to free memory and prevent overlap
        Object.keys(this.charts).forEach(key => {
            if (this.charts[key]) {
                this.charts[key].destroy();
                this.charts[key] = null;
            }
        });
    }

    renderDashboard(data) {
        this.updateMetrics(data);
        this.renderTypesChart(data);
        this.renderProvidersChart(data);
        this.renderMonthlyChart(data);
    }

    updateMetrics(data) {
        const total = data.reduce((sum, inv) => sum + (inv.total || 0), 0);
        const docs = data.length;
        const provs = new Set(data.map(inv => inv.proveedor)).size;
        
        // Calculate average per month
        const months = new Set();
        data.forEach(inv => {
            const dateStr = inv.fechaISO || inv.fprovISO;
            if (dateStr) {
                const d = new Date(dateStr);
                if (!isNaN(d.getTime())) {
                    months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
                }
            }
        });
        const monthCount = Math.max(1, months.size);
        const avg = total / monthCount;

        // Update UI
        document.getElementById('stat-total').textContent = `€${total.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
        document.getElementById('stat-docs').textContent = docs;
        document.getElementById('stat-provs').textContent = provs;
        document.getElementById('stat-avg').textContent = `€${avg.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
        
        // Update exercise year label (using max year in data)
        const years = Array.from(months).map(m => m.substring(0, 4));
        if (years.length > 0) {
            const maxYear = Math.max(...years);
            document.getElementById('dash-exercise').textContent = `Ejercicio ${maxYear}`;
            document.getElementById('label-curr-year').textContent = maxYear;
            document.getElementById('label-prev-year').textContent = maxYear - 1;
        }
    }

    renderTypesChart(data) {
        const typeData = {};
        data.forEach(inv => {
            const type = inv.tipo || 'Otros';
            typeData[type] = (typeData[type] || 0) + 1;
        });

        const labels = Object.keys(typeData);
        const values = Object.values(typeData);
        const total = values.reduce((a, b) => a + b, 0);
        
        // Sort by value descending
        const combined = labels.map((l, i) => ({ label: l, value: values[i] }))
            .sort((a, b) => b.value - a.value);

        // Update Legend
        const legend = document.getElementById('types-legend');
        legend.innerHTML = '';
        combined.forEach((item, i) => {
            const percent = Math.round((item.value / total) * 100);
            const color = this.colors[i % this.colors.length];
            legend.innerHTML += `
                <span class="legend-item">
                    <span class="legend-dot" style="background:${color};"></span>
                    ${item.label} ${percent}%
                </span>`;
        });

        const ctx = document.getElementById('chartTypes').getContext('2d');
        this.charts.types = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: combined.map(c => c.label),
                datasets: [{
                    data: combined.map(c => c.value),
                    backgroundColor: this.colors.slice(0, combined.length),
                    borderWidth: 0,
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '62%',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const val = ctx.raw;
                                const p = Math.round((val / total) * 100);
                                return ` ${ctx.label}: ${p}% (${val} docs)`;
                            }
                        }
                    }
                }
            }
        });
    }

    renderProvidersChart(data) {
        const providerData = {};
        data.forEach(inv => {
            const prov = inv.proveedor || 'Desconocido';
            providerData[prov] = (providerData[prov] || 0) + (inv.total || 0);
        });

        const sorted = Object.keys(providerData)
            .map(p => ({ label: p, value: providerData[p] }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);

        const ctx = document.getElementById('chartProviders').getContext('2d');
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const tickColor = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)';
        const gridColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';

        this.charts.providers = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: sorted.map(s => s.label),
                datasets: [{
                    label: 'Importe (€)',
                    data: sorted.map(s => s.value),
                    backgroundColor: this.colors.slice(0, sorted.length),
                    borderWidth: 0,
                    borderRadius: 4,
                    borderSkipped: false
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => ` €${ctx.parsed.x.toLocaleString('es-ES')}`
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: gridColor },
                        ticks: {
                            color: tickColor,
                            font: { size: 11 },
                            callback: v => '€' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v)
                        },
                        border: { display: false }
                    },
                    y: {
                        grid: { display: false },
                        ticks: { color: tickColor, font: { size: 11 } },
                        border: { display: false }
                    }
                }
            }
        });
    }

    renderMonthlyChart(data) {
        const monthlyData = {};
        data.forEach(inv => {
            const dateStr = inv.fechaISO || inv.fprovISO;
            if (!dateStr) return;
            
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return;
            
            const year = d.getFullYear().toString();
            const month = d.getMonth() + 1; // 1-12
            
            if (!monthlyData[year]) monthlyData[year] = Array(12).fill(0);
            monthlyData[year][month - 1] += (inv.total || 0);
        });

        const years = Object.keys(monthlyData).sort();
        if (years.length === 0) return;

        const maxYear = years[years.length - 1];
        const prevYear = (parseInt(maxYear) - 1).toString();

        const labels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const tickColor = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)';
        const gridColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';

        const datasets = [
            {
                label: maxYear,
                data: monthlyData[maxYear] || Array(12).fill(0),
                borderColor: '#185FA5',
                backgroundColor: isDark ? 'rgba(24,95,165,0.15)' : 'rgba(24,95,165,0.08)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 3,
                pointBackgroundColor: '#185FA5'
            }
        ];

        if (monthlyData[prevYear]) {
            datasets.push({
                label: prevYear,
                data: monthlyData[prevYear],
                borderColor: '#B4B2A9',
                backgroundColor: 'transparent',
                borderWidth: 1.5,
                borderDash: [5, 4],
                fill: false,
                tension: 0.4,
                pointRadius: 2,
                pointBackgroundColor: '#B4B2A9'
            });
        }

        const ctx = document.getElementById('chartMonthly').getContext('2d');
        this.charts.monthly = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => ` ${ctx.dataset.label}: €${ctx.parsed.y.toLocaleString('es-ES')}`
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: tickColor, font: { size: 11 }, autoSkip: false },
                        border: { display: false }
                    },
                    y: {
                        grid: { color: gridColor },
                        ticks: {
                            color: tickColor,
                            font: { size: 11 },
                            callback: v => '€' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v)
                        },
                        border: { display: false }
                    }
                }
            }
        });
    }

    exportToCSV(data) {
        if (!data || data.length === 0) {
            alert('No hay datos para exportar.');
            return;
        }

        // Find the most recent month in the data
        const monthMap = {};
        data.forEach(inv => {
            const dateStr = inv.fechaISO || inv.fprovISO;
            if (dateStr) {
                const d = new Date(dateStr);
                if (!isNaN(d.getTime())) {
                    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                    monthMap[key] = (monthMap[key] || 0) + 1;
                }
            }
        });

        const sortedMonths = Object.keys(monthMap).sort();
        if (sortedMonths.length === 0) {
            alert('No se encontraron fechas válidas para filtrar por mes.');
            return;
        }

        const latestMonthKey = sortedMonths[sortedMonths.length - 1];
        const [lYear, lMonth] = latestMonthKey.split('-');
        
        const filteredData = data.filter(inv => {
            const dateStr = inv.fechaISO || inv.fprovISO;
            if (!dateStr) return false;
            const d = new Date(dateStr);
            return d.getFullYear() === parseInt(lYear) && (d.getMonth() + 1) === parseInt(lMonth);
        });

        const monthName = new Date(parseInt(lYear), parseInt(lMonth) - 1).toLocaleString('es-ES', { month: 'long' });
        const confirmExport = confirm(`Se van a exportar ${filteredData.length} facturas correspondientes a ${monthName} de ${lYear}.\n¿Desea continuar?`);
        
        if (!confirmExport) return;

        // Headers
        const headers = [
            'Nº Factura', 'Fecha Imputacion', 'Trimestre', 'Nº F. Prov', 
            'Fecha Prov', 'Proveedor', 'Descripcion', 'B. Imponible', 
            'IVA + RE', 'Total', 'Tipo'
        ];

        // Format each row
        const rows = filteredData.map(inv => [
            inv.num || '',
            inv.fecha || '',
            inv.trimestre || '',
            inv.numProv || '',
            inv.fprov || '',
            inv.proveedor || '',
            inv.desc || '',
            (inv.base || 0).toString().replace('.', ','),
            (inv.iva || 0).toString().replace('.', ','),
            (inv.total || 0).toString().replace('.', ','),
            inv.tipo || ''
        ]);

        // Join into CSV format using semicolon for Excel compatibility in Spanish
        const csvContent = [
            headers.join(';'),
            ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
        ].join('\n');

        // Create Blob and trigger download
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        link.setAttribute('href', url);
        link.setAttribute('download', `Listado_Facturas_${monthName}_${lYear}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.dashboardManager = new DashboardManager();
    window.dashboardManager.initialize();
});
